-- =============================================================================
-- Campus Resource Engine - Peak Hour Limits Migration (US 9)
-- =============================================================================
-- Inserts default peak hour booking limits into system_config
-- =============================================================================

-- Peak max booking hours per day during peak hours (default 2)
INSERT INTO system_config (key, value, data_type, description, category, is_public, created_at, updated_at)
SELECT 'peak_max_booking_hours', '2', 'number', 'Maximum total booking hours per user per day during peak hours', 'booking', false, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM system_config WHERE key = 'peak_max_booking_hours');

-- Peak max number of bookings per day during peak hours (default 2)
INSERT INTO system_config (key, value, data_type, description, category, is_public, created_at, updated_at)
SELECT 'peak_max_bookings_per_day', '2', 'number', 'Maximum number of bookings per user per day during peak hours', 'booking', false, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM system_config WHERE key = 'peak_max_bookings_per_day');

-- Log successful migration
DO $$
BEGIN
    RAISE NOTICE 'Peak hour limits migration completed successfully!';
END $$;
