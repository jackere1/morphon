import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env
config();

export const CONFIG = {
  // Server
  PORT: parseInt(process.env.PORT || '3000', 10),

  // Database
  DATABASE_PATH: process.env.DATABASE_PATH || './data/cs-animations.db',

  // Video retention
  VIDEO_RETENTION_DAYS: parseInt(process.env.VIDEO_RETENTION_DAYS || '7', 10),
  MAX_CONCURRENT_RENDERS: parseInt(process.env.MAX_CONCURRENT_RENDERS || '1', 10),

  // AI Service
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',

  // Paths
  OUTPUT_DIR: resolve('./output'),
  WEB_DIR: resolve('./src/web'),
} as const;

// Validate required config
export function validateConfig(): void {
  const errors: string[] = [];

  if (!CONFIG.GEMINI_API_KEY) {
    errors.push('GEMINI_API_KEY is required in .env file');
  }

  if (errors.length > 0) {
    console.warn('[Config] Warnings:');
    errors.forEach(err => console.warn(`  - ${err}`));
  }
}
