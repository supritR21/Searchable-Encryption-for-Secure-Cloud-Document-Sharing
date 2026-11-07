import dotenv from 'dotenv';
import path from 'path';

// Load .env from workspace root if present, or local directory
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config();

export const ENV = {
  PORT: parseInt(process.env.PORT || '4000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://ciphershare:ciphershare_secret_password@localhost:5432/ciphershare_db?schema=public',
  JWT_SECRET: process.env.JWT_SECRET || 'super_secret_jwt_key_at_least_32_bytes_ciphershare_proj',
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:3000',
  JWT_EXPIRES_IN: '7d',
};
