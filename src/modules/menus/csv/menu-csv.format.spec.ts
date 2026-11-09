import {
  areSimilarNames,
  decodeCsvBuffer,
  detectSeparator,
  matchKey,
  normalizeHeader,
  parseCsv,
  parsePhotoUrl,
  parsePrice,
  parseYesNo,
  toMenuCsv,
  unescapeCell,
} from '@/modules/menus/csv/menu-csv.format';

describe('menu CSV format', () => {
  describe('decodeCsvBuffer', () => {
    it('reads UTF-8 with and without BOM', () => {
      const text = 'nombre\nCafé';
      expect(decodeCsvBuffer(Buffer.from(text, 'utf8'))).toBe(text);
      expect(decodeCsvBuffer(Buffer.from(`\uFEFF${text}`, 'utf8'))).toBe(text);
    });

    it('falls back to Windows-1252, as Excel saves a plain CSV', () => {
      const latin1 = Buffer.from([0x43, 0x61, 0x66, 0xe9]); // "Café"
      expect(decodeCsvBuffer(latin1)).toBe('Café');
    });
  });

  describe('detectSeparator', () => {
    it('picks the separator of the header line', () => {
      expect(detectSeparator('nombre,precio\n1;2;3')).toBe(',');
      expect(detectSeparator('nombre;precio;categoria\na,b')).toBe(';');
      expect(detectSeparator('nombre\tprecio')).toBe('\t');
    });

    it('ignores separators inside quotes', () => {
      expect(detectSeparator('"a,b,c";precio;x')).toBe(';');
    });
  });

  describe('parseCsv', () => {
    it('handles quotes, escaped quotes, line breaks and CRLF', () => {
      const text =
        'nombre,descripcion\r\n"Taco, el bueno","Con ""salsa""\ny limón"\r\nAgua,\r\n';
      expect(parseCsv(text, ',')).toEqual([
        ['nombre', 'descripcion'],
        ['Taco, el bueno', 'Con "salsa"\ny limón'],
        ['Agua', ''],
      ]);
    });

    it('keeps the last line without a line break', () => {
      expect(parseCsv('a;b\n1;2', ';')).toEqual([
        ['a', 'b'],
        ['1', '2'],
      ]);
    });
  });

  it('normalizes headers with accents, case and spaces', () => {
    expect(normalizeHeader(' Categoría ')).toBe('categoria');
    expect(normalizeHeader('DESCRIPCIÓN')).toBe('descripcion');
    expect(normalizeHeader('Foto URL')).toBe('foto_url');
    expect(normalizeHeader('foto-url')).toBe('foto_url');
    expect(normalizeHeader('costo')).toBeNull();
  });

  it('compares names without accents, case or extra spaces', () => {
    expect(matchKey('  Café   de  olla ')).toBe('CAFE DE OLLA');
    expect(matchKey('Piña')).toBe(matchKey('PINA'));
  });

  describe('parsePrice', () => {
    it.each([
      ['120', 120],
      ['120.5', 120.5],
      ['120,50', 120.5],
      ['$ 89.90', 89.9],
      ['1,200', 1200],
      ['1,200.50', 1200.5],
      ['1.200,50', 1200.5],
    ])('reads %s', (raw, expected) => {
      expect(parsePrice(raw)).toEqual({ value: expected });
    });

    it.each([
      ['', 'required'],
      ['abc', 'invalid'],
      ['12.345', 'invalid'],
      ['0', 'not_positive'],
      ['-5', 'invalid'],
      ['2000000', 'too_high'],
    ])('rejects %p', (raw, error) => {
      expect(parsePrice(raw)).toEqual({ error });
    });
  });

  it('reads yes and no, and empty as no change', () => {
    expect(parseYesNo('Sí')).toEqual({ value: true });
    expect(parseYesNo('si')).toEqual({ value: true });
    expect(parseYesNo('NO')).toEqual({ value: false });
    expect(parseYesNo(' ')).toEqual({ value: null });
    expect(parseYesNo('tal vez')).toEqual({ error: 'invalid' });
  });

  it('only accepts https photo URLs', () => {
    expect(parsePhotoUrl('https://example.com/a.jpg')).toEqual({
      value: 'https://example.com/a.jpg',
    });
    expect(parsePhotoUrl('')).toEqual({ value: null });
    expect(parsePhotoUrl('http://example.com/a.jpg')).toEqual({
      error: 'not_https',
    });
    expect(parsePhotoUrl('foto.jpg')).toEqual({ error: 'invalid' });
  });

  it('finds names that differ in a few letters', () => {
    expect(areSimilarNames('ROLL CALIFORNIA', 'ROLL CALIFORNIAS')).toBe(true);
    expect(areSimilarNames('TACO', 'TACOS')).toBe(true);
    expect(areSimilarNames('PAN', 'PAY')).toBe(false);
    expect(areSimilarNames('AGUA DE JAMAICA', 'AGUA DE HORCHATA')).toBe(false);
    expect(areSimilarNames('TACO', 'TACO')).toBe(false);
  });

  describe('toMenuCsv', () => {
    it('writes a BOM, quotes when needed and neutralizes formulas', () => {
      const csv = toMenuCsv([
        {
          name: 'TACO, EL BUENO',
          description: '=1+1',
          category: 'TACOS',
          price: 25,
          family: null,
          recommended: true,
          active: false,
          photoUrl: null,
        },
      ]);

      expect(csv.startsWith('\uFEFF')).toBe(true);
      expect(csv).toBe(
        '\uFEFFnombre,descripcion,categoria,precio,familia,recomendado,activo,foto_url\r\n' +
          `"TACO, EL BUENO",'=1+1,TACOS,25.00,,sí,no,\r\n`,
      );
    });

    it('round-trips through the parser', () => {
      const csv = toMenuCsv([
        {
          name: 'AGUA "FRESCA"',
          description: '-con hielo',
          category: 'BEBIDAS',
          price: 30.5,
          family: 'AGUAS',
          recommended: false,
          active: true,
          photoUrl: 'https://res.cloudinary.com/x/a.jpg',
        },
      ]);
      const [, row] = parseCsv(decodeCsvBuffer(Buffer.from(csv)), ',');

      expect(row.map(unescapeCell)).toEqual([
        'AGUA "FRESCA"',
        '-con hielo',
        'BEBIDAS',
        '30.50',
        'AGUAS',
        'no',
        'sí',
        'https://res.cloudinary.com/x/a.jpg',
      ]);
    });
  });
});
