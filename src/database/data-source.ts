import 'reflect-metadata';
import { config } from 'dotenv';
import { join } from 'path';
import { DataSource } from 'typeorm';
import configuration from '../config/configuration';
import { buildDataSourceOptions, SOURCE_EXTENSION } from './database.config';

// Usado solo por la CLI de TypeORM (migraciones). Usa rutas relativas porque
// la CLI no resuelve los alias `@/` en este archivo de entrada.
config();

export default new DataSource({
  ...buildDataSourceOptions(configuration().database),
  entities: [join(__dirname, '..', '**', `*.entity${SOURCE_EXTENSION}`)],
});
