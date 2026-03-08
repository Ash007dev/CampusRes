import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from the server root
dotenv.config({ path: path.join(__dirname, '../.env') });

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function main() {
    console.log('Starting migration via direct connection...');

    try {
        await client.connect();

        const query = `
      DO $$ 
      BEGIN 
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rooms' AND column_name = 'noise_level') THEN
              ALTER TABLE rooms ADD COLUMN noise_level TEXT DEFAULT 'MODERATE' CHECK (noise_level IN ('SILENT', 'LOW', 'MODERATE', 'LOUD'));
          END IF;
      END $$;
      
      DO $$ 
      BEGIN 
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'event_noise_level') THEN
              ALTER TABLE bookings ADD COLUMN event_noise_level TEXT DEFAULT 'MODERATE' CHECK (event_noise_level IN ('SILENT', 'LOW', 'MODERATE', 'LOUD'));
          END IF;
      END $$;
      
      CREATE TABLE IF NOT EXISTS room_adjacencies (
          room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
          adjacent_room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (room_id, adjacent_room_id),
          CHECK (room_id != adjacent_room_id)
      );
      
      CREATE INDEX IF NOT EXISTS idx_room_adjacencies_room_id ON room_adjacencies(room_id);
      CREATE INDEX IF NOT EXISTS idx_room_adjacencies_adjacent_room_id ON room_adjacencies(adjacent_room_id);
      CREATE INDEX IF NOT EXISTS idx_rooms_noise_level ON rooms(noise_level);
      CREATE INDEX IF NOT EXISTS idx_bookings_event_noise_level ON bookings(event_noise_level);

      -- Seed some adjacencies if table is empty
      INSERT INTO room_adjacencies (room_id, adjacent_room_id)
      SELECT r1.id, r2.id
      FROM rooms r1, rooms r2
      WHERE r1.id < r2.id 
      AND r1.floor = r2.floor 
      AND r1.building = r2.building
      AND NOT EXISTS (SELECT 1 FROM room_adjacencies)
      LIMIT 10;
    `;

        await client.query(query);
        console.log('Migration completed successfully');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await client.end();
    }
}

main();