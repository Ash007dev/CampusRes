-- =============================================================================
-- Campus Resource Engine - Feedback Table Migration (US 5.8)
-- =============================================================================
-- Run this migration in Supabase SQL Editor to add the feedback table
-- =============================================================================

-- Create feedback table (using TEXT for IDs to match existing tables)
CREATE TABLE IF NOT EXISTS feedback (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    booking_id TEXT REFERENCES bookings(id) ON DELETE SET NULL,
    category TEXT NOT NULL CHECK (category IN ('AC_ISSUE', 'CLEANLINESS', 'EQUIPMENT', 'NOISE', 'LIGHTING', 'OTHER')),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED')),
    priority TEXT NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
    admin_notes TEXT,
    resolved_at TIMESTAMPTZ,
    resolved_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_feedback_room_id ON feedback(room_id);
CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status);
CREATE INDEX IF NOT EXISTS idx_feedback_category ON feedback(category);
CREATE INDEX IF NOT EXISTS idx_feedback_priority ON feedback(priority);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at DESC);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_feedback_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    
    -- Auto-set resolved_at when status changes to RESOLVED
    IF NEW.status = 'RESOLVED' AND OLD.status != 'RESOLVED' THEN
        NEW.resolved_at = NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_feedback_updated_at ON feedback;
CREATE TRIGGER trigger_update_feedback_updated_at
    BEFORE UPDATE ON feedback
    FOR EACH ROW
    EXECUTE FUNCTION update_feedback_updated_at();

-- Add some comments for documentation
COMMENT ON TABLE feedback IS 'Stores user feedback and issue reports for rooms';
COMMENT ON COLUMN feedback.category IS 'Type of issue: AC_ISSUE, CLEANLINESS, EQUIPMENT, NOISE, LIGHTING, OTHER';
COMMENT ON COLUMN feedback.status IS 'Status: OPEN (new), IN_PROGRESS (being addressed), RESOLVED (fixed), CLOSED (no action)';
COMMENT ON COLUMN feedback.priority IS 'Priority: LOW, MEDIUM, HIGH, URGENT';
COMMENT ON COLUMN feedback.admin_notes IS 'Notes from admin about the feedback resolution';

-- Log successful migration
DO $$
BEGIN
    RAISE NOTICE 'Feedback table migration completed successfully!';
END $$;
