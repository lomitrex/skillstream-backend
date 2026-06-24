import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

export const pgPool = new Pool({
  connectionString: process.env.PG_URI,
});

export const initPgDb = async (): Promise<void> => {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      role VARCHAR(50) DEFAULT 'student',
      refresh_token TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
  try {
    await pgPool.query(createTableQuery);
    console.log('PostgreSQL database initialized successfully');
  } catch (error) {
    console.error('PostgreSQL initialization failed:', error);
    process.exit(1);
  }
};