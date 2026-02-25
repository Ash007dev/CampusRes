-- =============================================================================
-- US 3.7: Waitlist Cascade Notification - Migration
-- =============================================================================
-- Adds notification_expires_at so only user #1 gets notified, and if they
-- don't act within the window, the next user in queue gets notified.
-- =============================================================================

-- Add notification_expires_at column to waitlist
ALTER TABLE waitlist
    ADD COLUMN IF NOT EXISTS notification_expires_at TIMESTAMPTZ;

-- Index to efficiently find expired notifications in the cascade job
CREATE INDEX IF NOT EXISTS idx_waitlist_notification_expires
    ON waitlist(notification_expires_at)
    WHERE is_active = true AND notification_expires_at IS NOT NULL;

COMMENT ON COLUMN waitlist.notification_expires_at IS
    'Deadline by which the notified user must book, before cascading to the next person';
