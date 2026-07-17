require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const databaseUrl =
  process.env.DATABASE_URL || 'postgres://footcast:footcast@localhost:5432/footcast';

module.exports = {
  development: {
    url: databaseUrl,
    dialect: 'postgres',
    logging: false,
  },
  test: {
    url: process.env.DATABASE_URL_TEST || databaseUrl,
    dialect: 'postgres',
    logging: false,
  },
  production: {
    url: databaseUrl,
    dialect: 'postgres',
    logging: false,
  },
};
