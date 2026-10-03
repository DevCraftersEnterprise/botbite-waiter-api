import { BadRequestException } from '@nestjs/common';
import {
  assertFileContent,
  uploadOptions,
} from '@/common/uploads/upload-options';

const file = (buffer: Buffer) => ({ buffer }) as Express.Multer.File;

describe('assertFileContent', () => {
  it('accepts a real PDF', () => {
    expect(() =>
      assertFileContent(file(Buffer.from('%PDF-1.7 ...')), 'pdf'),
    ).not.toThrow();
  });

  it('rejects HTML disguised as PDF', () => {
    expect(() =>
      assertFileContent(file(Buffer.from('<html><script>')), 'pdf'),
    ).toThrow(BadRequestException);
  });

  it('accepts PNG and JPEG images', () => {
    expect(() =>
      assertFileContent(
        file(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d])),
        'image',
      ),
    ).not.toThrow();
    expect(() =>
      assertFileContent(file(Buffer.from([0xff, 0xd8, 0xff, 0xe0])), 'image'),
    ).not.toThrow();
  });

  it('rejects SVG images (they can carry scripts)', () => {
    expect(() =>
      assertFileContent(file(Buffer.from('<svg onload="x()">')), 'image'),
    ).toThrow(BadRequestException);
  });

  it('rejects binary content in CSV uploads', () => {
    expect(() =>
      assertFileContent(file(Buffer.from([0x00, 0x01, 0x02])), 'csv'),
    ).toThrow(BadRequestException);
  });

  it('requires a file', () => {
    expect(() => assertFileContent(undefined, 'csv')).toThrow(
      BadRequestException,
    );
  });
});

describe('uploadOptions', () => {
  it('limits the file size', () => {
    expect(uploadOptions('image').limits?.fileSize).toBe(5 * 1024 * 1024);
  });

  it('filters by mimetype and extension', () => {
    const { fileFilter } = uploadOptions('pdf');
    const callback = jest.fn();

    fileFilter!(
      {} as never,
      { originalname: 'menu.pdf', mimetype: 'application/pdf' } as never,
      callback,
    );
    expect(callback).toHaveBeenLastCalledWith(null, true);

    fileFilter!(
      {} as never,
      { originalname: 'menu.html', mimetype: 'text/html' } as never,
      callback,
    );
    expect(callback.mock.lastCall?.[0]).toBeInstanceOf(BadRequestException);
  });
});
