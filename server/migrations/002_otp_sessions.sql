-- OTP Sessions Table for MFA
-- Stores OTP verification sessions with device binding and attempt tracking

CREATE TABLE IF NOT EXISTS otp_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  otp_hash VARCHAR(255) NOT NULL, -- Hashed OTP for security
  attempts INTEGER DEFAULT 0, -- Track failed attempts
  max_attempts INTEGER DEFAULT 3, -- Lock after 3 failed attempts
  device_fingerprint TEXT, -- Browser/device identifier
  ip_address VARCHAR(45), -- IPv4 or IPv6
  is_verified BOOLEAN DEFAULT false,
  is_locked BOOLEAN DEFAULT false, -- Locked after max attempts
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  
  -- Indexes
  CONSTRAINT otp_sessions_user_active UNIQUE (user_id, is_verified) WHERE is_verified = false
);

-- Index for cleanup of expired sessions
CREATE INDEX IF NOT EXISTS idx_otp_sessions_expires_at ON otp_sessions(expires_at);

-- Index for user lookups
CREATE INDEX IF NOT EXISTS idx_otp_sessions_user_id ON otp_sessions(user_id);

COMMENT ON TABLE otp_sessions IS 'Stores OTP verification sessions for MFA with attempt tracking and device binding';
COMMENT ON COLUMN otp_sessions.otp_hash IS 'Bcrypt hash of the OTP code';
COMMENT ON COLUMN otp_sessions.device_fingerprint IS 'Browser fingerprint or device identifier';
COMMENT ON COLUMN otp_sessions.attempts IS 'Number of failed OTP verification attempts';
COMMENT ON COLUMN otp_sessions.is_locked IS 'Session locked after max failed attempts';
