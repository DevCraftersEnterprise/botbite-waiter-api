import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { EnvironmentVariables } from './env.validation';

const required = {
  PORT: '3000',
  JWT_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
  CLOUDINARY_CLOUD_NAME: 'cloud',
  CLOUDINARY_API_KEY: 'key',
  CLOUDINARY_API_SECRET: 'secret',
};

const separate = {
  DB_HOST: 'localhost',
  DB_PORT: '5432',
  DB_USERNAME: 'postgres',
  DB_PASSWORD: 'postgres',
  DB_NAME: 'botbite',
};

const failingFields = (env: Record<string, string>) =>
  validateSync(
    plainToInstance(EnvironmentVariables, env, {
      enableImplicitConversion: true,
    }),
    { skipMissingProperties: false },
  ).map((error) => error.property);

describe('EnvironmentVariables (database)', () => {
  it('accepts the separate DB_* values', () => {
    expect(failingFields({ ...required, ...separate })).toEqual([]);
  });

  it('accepts DATABASE_URL without the DB_* values', () => {
    expect(
      failingFields({
        ...required,
        DATABASE_URL:
          'postgresql://user:pass@ep-test.neon.tech/neondb?sslmode=require',
      }),
    ).toEqual([]);
  });

  it('asks for the DB_* values when there is no DATABASE_URL', () => {
    expect(failingFields(required)).toEqual(
      expect.arrayContaining([
        'DB_HOST',
        'DB_PORT',
        'DB_USERNAME',
        'DB_PASSWORD',
        'DB_NAME',
      ]),
    );
  });

  it('rejects a DATABASE_URL that is not Postgres', () => {
    expect(
      failingFields({ ...required, ...separate, DATABASE_URL: 'mysql://x/y' }),
    ).toEqual(['DATABASE_URL']);
  });
});
