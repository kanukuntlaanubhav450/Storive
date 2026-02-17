-- Migration: Secure OTP Storage
-- 1. Rename otp to otp_hash in pending_registrations
ALTER TABLE pending_registrations RENAME COLUMN otp TO otp_hash;

-- 2. Add an index to speed up expiration queries
CREATE INDEX IF NOT EXISTS idx_pending_registrations_expires ON pending_registrations (otp_expires_at);

-- 3. Create a function to clean up expired registrations
CREATE OR REPLACE FUNCTION clean_expired_registrations()
RETURNS TRIGGER AS $$
BEGIN
    -- Run cleanup probabilistically (e.g., 1% of the time) to avoid performance impact
    IF random() < 0.01 THEN
        DELETE FROM pending_registrations WHERE otp_expires_at < NOW();
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 4. Create a trigger to run cleanup occasionally (AFTER INSERT OR UPDATE)
DROP TRIGGER IF EXISTS trigger_clean_expired_registrations ON pending_registrations;
CREATE TRIGGER trigger_clean_expired_registrations
AFTER INSERT OR UPDATE ON pending_registrations
FOR EACH STATEMENT
EXECUTE FUNCTION clean_expired_registrations();
