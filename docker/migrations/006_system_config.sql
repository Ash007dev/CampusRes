-- =============================================================================
-- Campus Resource Engine - System Configuration Table (US 5.9)
-- =============================================================================
-- Run this migration in Supabase SQL Editor to add system configuration
-- =============================================================================

-- Drop existing table if it exists (clean slate)
DROP TABLE IF EXISTS system_config CASCADE;

-- Create system_config table for dynamic settings
CREATE TABLE system_config (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    key TEXT UNIQUE NOT NULL,
    value TEXT NOT NULL,
    data_type TEXT NOT NULL CHECK (data_type IN ('string', 'number', 'boolean', 'json', 'time')),
    description TEXT,
    category TEXT NOT NULL DEFAULT 'general' CHECK (category IN ('general', 'booking', 'notification', 'security')),
    is_public BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by TEXT REFERENCES users(id) ON DELETE SET NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_system_config_key ON system_config(key);
CREATE INDEX IF NOT EXISTS idx_system_config_category ON system_config(category);
CREATE INDEX IF NOT EXISTS idx_system_config_is_public ON system_config(is_public);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_system_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_system_config_updated_at ON system_config;
CREATE TRIGGER trigger_update_system_config_updated_at
    BEFORE UPDATE ON system_config
    FOR EACH ROW
    EXECUTE FUNCTION update_system_config_updated_at();

-- Insert default configuration values
INSERT INTO system_config (key, value, data_type, description, category, is_public) VALUES
    ('campus_open_time', '08:00', 'time', 'Campus opening time (HH:MM format)', 'booking', true),
    ('campus_close_time', '20:00', 'time', 'Campus closing time (HH:MM format)', 'booking', true),
    ('max_booking_duration_hours', '4', 'number', 'Maximum booking duration in hours', 'booking', true),
    ('min_booking_duration_minutes', '30', 'number', 'Minimum booking duration in minutes', 'booking', true),
    ('advance_booking_days', '30', 'number', 'How many days in advance users can book', 'booking', true),
    ('booking_buffer_minutes', '15', 'number', 'Buffer time between bookings in minutes', 'booking', true),
    ('max_concurrent_bookings', '3', 'number', 'Maximum concurrent active bookings per user', 'booking', true),
    ('cancellation_deadline_hours', '2', 'number', 'Hours before booking start when cancellation is not allowed', 'booking', true),
    ('allow_weekend_bookings', 'true', 'boolean', 'Allow bookings on weekends', 'booking', true),
    ('maintenance_mode', 'false', 'boolean', 'System-wide maintenance mode', 'general', true),
    ('maintenance_message', 'System is under maintenance. Please try again later.', 'string', 'Message shown during maintenance', 'general', true),
    ('enable_waitlist', 'true', 'boolean', 'Enable waitlist feature', 'booking', true),
    ('reputation_threshold_booking', '50', 'number', 'Minimum reputation score to make bookings', 'booking', true),
    ('ghost_penalty_points', '-10', 'number', 'Reputation penalty for no-show', 'booking', false),
    ('successful_booking_points', '2', 'number', 'Reputation reward for completed booking', 'booking', false)
ON CONFLICT (key) DO NOTHING;

-- Add comments
COMMENT ON TABLE system_config IS 'Dynamic system configuration settings';
COMMENT ON COLUMN system_config.key IS 'Unique configuration key';
COMMENT ON COLUMN system_config.value IS 'Configuration value stored as text';
COMMENT ON COLUMN system_config.data_type IS 'Data type for value parsing: string, number, boolean, json, time';
COMMENT ON COLUMN system_config.category IS 'Configuration category: general, booking, notification, security';
COMMENT ON COLUMN system_config.is_public IS 'Whether this config is visible to non-admin users';

-- Log successful migration
DO $$
BEGIN
    RAISE NOTICE 'System configuration table migration completed successfully!';
END $$;
