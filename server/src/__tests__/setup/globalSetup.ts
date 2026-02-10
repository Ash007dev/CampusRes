/**
 * Vitest global setup — load .env before any tests run
 */
import dotenv from 'dotenv';
import { resolve } from 'path';

// process.cwd() is the server directory where vitest is invoked
dotenv.config({ path: resolve(process.cwd(), '.env') });
