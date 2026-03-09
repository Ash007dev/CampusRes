-- =============================================================================
-- Campus Resource Engine - No-Show Escalation Migration (US 4)
-- =============================================================================
-- Adds escalating no-show tier tracking to users table
-- =============================================================================

-- Add no_show_tier column (0=clean, 1=warning, 2=3-day block, 3=7-day block, 4=30-day block)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'no_show_tier'
    ) THEN
        ALTER TABLE users ADD COLUMN no_show_tier INTEGER DEFAULT 0;
    END IF;
END $$;

-- Add no_show_tier_updated_at for tracking when tier was last escalated
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'no_show_tier_updated_at'
    ) THEN
        ALTER TABLE users ADD COLUMN no_show_tier_updated_at TIMESTAMPTZ;
    END IF;
END $$;

-- Add index for querying users by no-show tier
CREATE INDEX IF NOT EXISTS idx_users_no_show_tier ON users(no_show_tier);

-- Add comments
COMMENT ON COLUMN users.no_show_tier IS 'No-show escalation tier: 0=clean, 1=warning, 2=3-day block, 3=7-day block, 4=30-day block';
COMMENT ON COLUMN users.no_show_tier_updated_at IS 'Timestamp of last no-show tier change (for 60-day reset logic)';

-- Log successful migration
DO $$
BEGIN
    RAISE NOTICE 'No-show escalation migration completed successfully!';
END $$;
