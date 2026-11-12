import configuration from './configuration';

describe('configuration', () => {
  const saved = { ...process.env };

  afterEach(() => {
    process.env = { ...saved };
  });

  it('keeps the panel session for 1 hour unless JWT_ACCESS_EXPIRY says otherwise', () => {
    delete process.env.JWT_ACCESS_EXPIRY;
    delete process.env.JWT_EXPIRES_IN;
    expect(configuration().jwt.accessExpiry).toBe('1h');

    process.env.JWT_ACCESS_EXPIRY = '30m';
    expect(configuration().jwt.accessExpiry).toBe('30m');
  });

  it('passes DATABASE_URL through only when it has a value', () => {
    process.env.DATABASE_URL = '';
    expect(configuration().database.url).toBeUndefined();

    process.env.DATABASE_URL = 'postgresql://user:pass@localhost/db';
    expect(configuration().database.url).toBe(
      'postgresql://user:pass@localhost/db',
    );
  });
});
