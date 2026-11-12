import { buildDataSourceOptions, DatabaseSettings } from './database.config';

const base: DatabaseSettings = {
  host: 'db.local',
  port: 5432,
  username: 'app',
  password: 'secret',
  name: 'botbite',
  ssl: false,
  sslRejectUnauthorized: true,
};

describe('buildDataSourceOptions', () => {
  it('uses the separate DB_* values when there is no DATABASE_URL', () => {
    expect(buildDataSourceOptions(base)).toMatchObject({
      type: 'postgres',
      host: 'db.local',
      port: 5432,
      username: 'app',
      password: 'secret',
      database: 'botbite',
      ssl: false,
    });
    expect(buildDataSourceOptions(base)).not.toHaveProperty('url');
  });

  it('uses only DATABASE_URL when it is present', () => {
    const url = 'postgresql://user:pass@ep-test.neon.tech/neondb';
    const options = buildDataSourceOptions({ ...base, url, ssl: true });

    expect(options).toMatchObject({
      type: 'postgres',
      url,
      ssl: { rejectUnauthorized: true },
    });
    for (const key of ['host', 'port', 'username', 'password', 'database']) {
      expect(options).not.toHaveProperty(key);
    }
  });
});
