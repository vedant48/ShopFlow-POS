-- ==============================================================================
-- ShopFlow D1 Migration 0001: Authentication & Sessions
-- ==============================================================================

-- 1. Sessions Table for device trust and refresh tokens
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  shop_id TEXT NOT NULL REFERENCES shops(id),
  device_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_shop ON sessions(shop_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);

-- 2. Unique Index on User Phone Numbers
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone ON users(phone);

-- 3. Rate Limiting Table for Login Protection
CREATE TABLE IF NOT EXISTS auth_rate_limits (
  key TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL DEFAULT 1,
  first_attempt_at INTEGER NOT NULL,
  last_attempt_at INTEGER NOT NULL
);
