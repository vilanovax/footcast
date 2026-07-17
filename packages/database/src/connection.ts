import { Sequelize } from 'sequelize';
import { initModels, type DbModels } from './models/index.js';

export interface Database {
  sequelize: Sequelize;
  models: DbModels;
}

let singleton: Database | null = null;

export function createDatabase(databaseUrl: string): Database {
  const sequelize = new Sequelize(databaseUrl, {
    dialect: 'postgres',
    logging: false,
  });
  const models = initModels(sequelize);
  return { sequelize, models };
}

export function getDatabase(databaseUrl: string): Database {
  if (!singleton) {
    singleton = createDatabase(databaseUrl);
  }
  return singleton;
}

export async function authenticateDatabase(db: Database): Promise<void> {
  await db.sequelize.authenticate();
}

export async function closeDatabase(db: Database): Promise<void> {
  await db.sequelize.close();
  singleton = null;
}
