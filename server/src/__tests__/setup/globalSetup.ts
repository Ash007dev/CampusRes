/**
 * Vitest global setup — load .env before any tests run
 */
import dotenv from 'dotenv';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Find the server root directory (3 levels up from this file: setup/ -> src/ -> server/)
const serverRoot = resolve(__dirname, '../../../');

dotenv.config({ path: resolve(serverRoot, '.env') });
