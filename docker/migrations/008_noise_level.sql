-- =============================================================================
-- Campus Resource Engine - Noise Level & Room Adjacency Migration (US 5)
-- =============================================================================
-- Adds noise-level classification to rooms and bookings, plus room adjacency
-- table for preventing incompatible event scheduling.
-- =============================================================================

-- Add noise_level to rooms (default MODERATE)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'rooms' AND column_name = 'noise_level'
    ) THEN
        ALTER TABLE rooms ADD COLUMN noise_level TEXT DEFAULT 'MODERATE'
            CHECK (noise_level IN ('SILENT', 'LOW', 'MODERATE', 'LOUD'));
    END IF;
END $$;

-- Add event_noise_level to bookings (default MODERATE)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'bookings' AND column_name = 'event_noise_level'
    ) THEN
        ALTER TABLE bookings ADD COLUMN event_noise_level TEXT DEFAULT 'MODERATE'
            CHECK (event_noise_level IN ('SILENT', 'LOW', 'MODERATE', 'LOUD'));
    END IF;
END $$;

-- Create room adjacencies table for tracking which rooms are adjacent
CREATE TABLE IF NOT EXISTS room_adjacencies (
    room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    adjacent_room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (room_id, adjacent_room_id),
    CHECK (room_id != adjacent_room_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_room_adjacencies_room_id ON room_adjacencies(room_id);
CREATE INDEX IF NOT EXISTS idx_room_adjacencies_adjacent_room_id ON room_adjacencies(adjacent_room_id);
CREATE INDEX IF NOT EXISTS idx_rooms_noise_level ON rooms(noise_level);
CREATE INDEX IF NOT EXISTS idx_bookings_event_noise_level ON bookings(event_noise_level);

-- Add comments
COMMENT ON TABLE room_adjacencies IS 'Tracks which rooms are physically adjacent for noise compatibility checks';
COMMENT ON COLUMN rooms.noise_level IS 'Room noise tolerance: SILENT, LOW, MODERATE, LOUD';
COMMENT ON COLUMN bookings.event_noise_level IS 'Noise level of the booked event: SILENT, LOW, MODERATE, LOUD';

-- Log successful migration
DO $$
BEGIN
    RAISE NOTICE 'Noise level and room adjacency migration completed successfully!';
END $$;
