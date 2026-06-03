-- Users table for platform authentication (Microsoft SQL Server).
-- Run once against your database (FMFJan2026).
--
-- New signups are created with is_active = 0 (locked out).
-- Activate a user manually:
--   UPDATE bbdo_users SET is_active = 1 WHERE email = 'person@example.com';
-- Deactivate:
--   UPDATE bbdo_users SET is_active = 0 WHERE email = 'person@example.com';

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'bbdo_users')
BEGIN
  CREATE TABLE bbdo_users (
    id            INT IDENTITY(1,1) PRIMARY KEY,
    email         NVARCHAR(255) NOT NULL UNIQUE,
    password_hash NVARCHAR(255) NOT NULL,
    is_active     BIT NOT NULL DEFAULT 0,
    created_at    DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
  );
END;
