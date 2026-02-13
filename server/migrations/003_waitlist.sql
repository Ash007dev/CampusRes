-- =============================================================================
-- US 3.7: Waitlist Feature - Database Migration
-- =============================================================================
-- Creates the waitlist table for users waiting for occupied rooms
-- =============================================================================

-- Create waitlist table
CREATE TABLE IF NOT EXISTS waitlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    desired_start_time TIMESTAMPTZ NOT NULL,
    desired_end_time TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    notified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_waitlist_user_id ON waitlist(user_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_room_id ON waitlist(room_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_active ON waitlist(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_waitlist_room_time ON waitlist(room_id, desired_start_time, desired_end_time);
CREATE INDEX IF NOT EXISTS idx_waitlist_created_at ON waitlist(created_at);

-- Create unique constraint to prevent duplicate waitlist entries
CREATE UNIQUE INDEX IF NOT EXISTS idx_waitlist_unique_active 
    ON waitlist(user_id, room_id, desired_start_time, desired_end_time) 
    WHERE is_active = true;

-- Enable Row Level Security
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

-- RLS Policies for waitlist

-- Users can view their own waitlist entries
CREATE POLICY "Users can view their own waitlist entries"
    ON waitlist
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can create their own waitlist entries
CREATE POLICY "Users can create their own waitlist entries"
    ON waitlist
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own waitlist entries
CREATE POLICY "Users can update their own waitlist entries"
    ON waitlist
    FOR UPDATE
    USING (auth.uid() = user_id);

-- Users can delete their own waitlist entries
CREATE POLICY "Users can delete their own waitlist entries"
    ON waitlist
    FOR DELETE
    USING (auth.uid() = user_id);

-- Admins can view all waitlist entries
CREATE POLICY "Admins can view all waitlist entries"
    ON waitlist
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'ADMIN'
        )
    );

-- Admins can manage all waitlist entries
CREATE POLICY "Admins can update all waitlist entries"
    ON waitlist
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'ADMIN'
        )
    );

-- Comment on table
COMMENT ON TABLE waitlist IS 'US 3.7: Waitlist entries for occupied rooms';
COMMENT ON COLUMN waitlist.user_id IS 'User waiting for the room';
COMMENT ON COLUMN waitlist.room_id IS 'Room they are waiting for';
COMMENT ON COLUMN waitlist.desired_start_time IS 'Desired booking start time';
COMMENT ON COLUMN waitlist.desired_end_time IS 'Desired booking end time';
COMMENT ON COLUMN waitlist.is_active IS 'Whether this entry is still active';
COMMENT ON COLUMN waitlist.notified_at IS 'When the user was notified about availability';
