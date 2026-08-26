-- Migration 0002: RBAC + Telegram OTP Authentication
-- Phase 1: Database & RBAC foundation

-- ============================================================
-- ROLES
-- ============================================================
CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  level INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO roles (code, name, level) VALUES
  ('ADMIN',       'Administrator',    100),
  ('MANAGER',     'Manager',          50),
  ('OFFICER',     'Officer',         30),
  ('ACCOUNT_MANAGER', 'Account Manager', 10)
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- PERMISSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS permissions (
  id SERIAL PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO permissions (code, name, description) VALUES
  -- User management
  ('user.view',               'Lihat Pengguna',            'Dapat melihat daftar dan detail pengguna'),
  ('user.create',             'Buat Pengguna',             'Dapat membuat pengguna baru'),
  ('user.update',             'Ubah Pengguna',             'Dapat mengubah data pengguna'),
  ('user.delete',             'Hapus Pengguna',            'Dapat menghapus pengguna'),
  ('user.manage',             'Kelola Pengguna',           'Dapat mengelola semua aspek pengguna'),

  -- Role management
  ('role.view',               'Lihat Role',                'Dapat melihat daftar role'),
  ('role.manage',             'Kelola Role',                'Dapat mengelola role dan permission'),

  -- Telegram settings
  ('telegram.settings.view',   'Lihat Pengaturan Telegram', 'Dapat melihat pengaturan Telegram'),
  ('telegram.settings.manage', 'Kelola Pengaturan Telegram', 'Dapat mengubah pengaturan Telegram Bot'),

  -- Telegram access code
  ('telegram.access_code.generate', 'Terbitkan Kode Akses', 'Dapat menerbitkan Kode Akses Telegram'),

  -- Telegram account management
  ('telegram.account.view',    'Lihat Akun Telegram',       'Dapat melihat status link Telegram pengguna'),
  ('telegram.account.unlink',  'Putuskan Koneksi Telegram', 'Dapat memutuskan koneksi Telegram pengguna'),

  -- Session management
  ('auth.session.view',       'Lihat Sesi',                'Dapat melihat daftar sesi aktif'),
  ('auth.session.revoke',      'Cabut Sesi',                'Dapat mencabut sesi pengguna'),

  -- Audit logs
  ('auth.log.view',           'Lihat Log Autentikasi',      'Dapat melihat log aktivitas keamanan')
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- ROLE PERMISSIONS (many-to-many)
-- ============================================================
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id       INTEGER NOT NULL REFERENCES roles(id)       ON DELETE CASCADE,
  permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- ADMIN: semua permission
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p WHERE r.code = 'ADMIN'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- MANAGER: semua kecuali user.delete dan role.manage
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code = 'MANAGER'
  AND p.code NOT IN ('user.delete', 'role.manage')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- OFFICER: user management + telegram + session view
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code = 'OFFICER'
  AND p.code IN (
    'user.view', 'user.create', 'user.update',
    'telegram.settings.view', 'telegram.settings.manage',
    'telegram.access_code.generate',
    'telegram.account.view', 'telegram.account.unlink',
    'auth.session.view', 'auth.session.revoke',
    'auth.log.view'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ACCOUNT_MANAGER: hanya lihat dan Telegram account view
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code = 'ACCOUNT_MANAGER'
  AND p.code IN ('telegram.account.view')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ============================================================
-- MODIFY account_managers
-- ============================================================
ALTER TABLE account_managers
  ADD COLUMN IF NOT EXISTS role_id INTEGER REFERENCES roles(id),
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS telegram_user_id VARCHAR(50),
  ADD COLUMN IF NOT EXISTS telegram_username VARCHAR(255),
  ADD COLUMN IF NOT EXISTS telegram_display_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS telegram_linked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS telegram_linked_by_access_code_id INTEGER,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Migrate existing role text -> role_id FK
UPDATE account_managers am SET role_id = r.id
FROM roles r
WHERE
  (am.role = 'ADMIN'         AND r.code = 'ADMIN')
  OR (am.role = 'MANAGER'    AND r.code = 'MANAGER')
  OR (am.role = 'OFFICER'    AND r.code = 'OFFICER')
  OR (am.role = 'AM'         AND r.code = 'ACCOUNT_MANAGER')
  AND am.role_id IS NULL;

-- Set status based on aktif column
UPDATE account_managers
SET status = CASE WHEN aktif = false THEN 'INACTIVE' ELSE 'ACTIVE' END
WHERE status = 'ACTIVE' AND aktif = false;

-- Make role_id NOT NULL after migration
ALTER TABLE account_managers ALTER COLUMN role_id SET NOT NULL;

-- ============================================================
-- TELEGRAM ACCESS CODES (new Kode Akses system)
-- ============================================================
CREATE TABLE IF NOT EXISTS telegram_access_codes (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER NOT NULL REFERENCES account_managers(id) ON DELETE CASCADE,
  code_hash       VARCHAR(255) NOT NULL,
  created_by      INTEGER REFERENCES account_managers(id),
  expires_at      TIMESTAMPTZ NOT NULL,
  used_at         TIMESTAMPTZ,
  status          VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  -- 'ACTIVE' | 'USED' | 'EXPIRED' | 'REVOKED'
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_access_codes_user_id ON telegram_access_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_access_codes_status  ON telegram_access_codes(status);
CREATE INDEX IF NOT EXISTS idx_access_codes_expires ON telegram_access_codes(expires_at);

-- ============================================================
-- OTP CHALLENGES
-- ============================================================
CREATE TABLE IF NOT EXISTS otp_challenges (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER NOT NULL REFERENCES account_managers(id) ON DELETE CASCADE,
  challenge_id    VARCHAR(50) NOT NULL UNIQUE,
  otp_hash        VARCHAR(255) NOT NULL,
  channel         VARCHAR(20) NOT NULL DEFAULT 'TELEGRAM',
  expires_at      TIMESTAMPTZ NOT NULL,
  attempt_count   INTEGER NOT NULL DEFAULT 0,
  verified_at     TIMESTAMPTZ,
  status          VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  -- 'PENDING' | 'OTP_SENT' | 'VERIFIED' | 'EXPIRED' | 'BLOCKED' | 'DELIVERY_FAILED' | 'REVOKED'
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_otp_challenges_user_id     ON otp_challenges(user_id);
CREATE INDEX IF NOT EXISTS idx_otp_challenges_challenge_id ON otp_challenges(challenge_id);
CREATE INDEX IF NOT EXISTS idx_otp_challenges_status       ON otp_challenges(status);
CREATE INDEX IF NOT EXISTS idx_otp_challenges_expires     ON otp_challenges(expires_at);

-- ============================================================
-- SESSIONS (replaces express-session in-memory store)
-- ============================================================
CREATE TABLE IF NOT EXISTS sessions (
  id                  SERIAL PRIMARY KEY,
  user_id             INTEGER NOT NULL REFERENCES account_managers(id) ON DELETE CASCADE,
  refresh_token_hash  VARCHAR(255) NOT NULL,
  device_id           VARCHAR(100),
  ip_address          VARCHAR(45),
  user_agent          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at          TIMESTAMPTZ NOT NULL,
  revoked_at          TIMESTAMPTZ,
  status              VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
  -- 'ACTIVE' | 'REVOKED' | 'EXPIRED'
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id    ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status     ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_expires   ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_device_id ON sessions(device_id);

-- ============================================================
-- AUTHENTICATION LOGS (immutable audit trail)
-- ============================================================
CREATE TABLE IF NOT EXISTS auth_logs (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER REFERENCES account_managers(id) ON DELETE SET NULL,
  event_type      VARCHAR(50) NOT NULL,
  -- LOGIN_ATTEMPT | CREDENTIAL_VERIFIED | CREDENTIAL_FAILED
  -- OTP_REQUESTED | OTP_SENT | OTP_DELIVERY_FAILED | OTP_VERIFIED | OTP_FAILED | OTP_EXPIRED | OTP_BLOCKED
  -- LOGIN_SUCCESS | LOGOUT
  -- TELEGRAM_LINKED | TELEGRAM_UNLINKED
  -- ACCESS_CODE_CREATED | ACCESS_CODE_USED | ACCESS_CODE_EXPIRED
  -- SESSION_CREATED | SESSION_REVOKED
  -- USER_DISABLED
  login_method    VARCHAR(30),
  -- EMAIL | NIK_PRESENTATION
  challenge_id    VARCHAR(50),
  session_id      INTEGER REFERENCES sessions(id) ON DELETE SET NULL,
  ip_address      VARCHAR(45),
  user_agent      TEXT,
  device_id       VARCHAR(100),
  status          VARCHAR(20) NOT NULL DEFAULT 'SUCCESS',
  -- SUCCESS | FAILURE
  failure_reason  VARCHAR(100),
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_logs_user_id     ON auth_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_logs_event_type  ON auth_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_auth_logs_created_at  ON auth_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_auth_logs_ip_address ON auth_logs(ip_address);
