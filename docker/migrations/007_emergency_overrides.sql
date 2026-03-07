-- Emergency Overrides table: stores admin-initiated override blocks
CREATE TABLE IF NOT EXISTS emergency_overrides (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    reason TEXT,
    created_by TEXT REFERENCES users(id),
    cancelled_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Junction table for override <-> room mapping
CREATE TABLE IF NOT EXISTS emergency_override_rooms (
    override_id UUID REFERENCES emergency_overrides(id) ON DELETE CASCADE,
    room_id TEXT REFERENCES rooms(id) ON DELETE CASCADE,
    PRIMARY KEY (override_id, room_id)
);
