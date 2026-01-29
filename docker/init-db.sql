-- =============================================================================
-- Campus Resource Engine - Database Initialization Script
-- =============================================================================
-- This script runs when the PostgreSQL container is first created.
-- It enables the required extensions for the booking system.
-- =============================================================================

-- Enable btree_gist extension (required for EXCLUDE constraints with non-btree operators)
-- This allows us to use the tsrange type with GiST indexes
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Enable uuid-ossp for UUID generation (optional, Prisma uses cuid by default)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pg_trgm for text search (useful for room name search)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Log successful initialization
DO $$
BEGIN
  RAISE NOTICE 'Campus Resource Engine database initialized successfully!';
  RAISE NOTICE 'Extensions enabled: btree_gist, uuid-ossp, pg_trgm';
END
$$;
