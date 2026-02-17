PRAGMA foreign_keys = OFF;

CREATE TABLE users_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL,
  username_lower TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  email_lower TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  invite_code TEXT UNIQUE,
  invite_quota INTEGER NOT NULL DEFAULT 1,
  invite_used INTEGER NOT NULL DEFAULT 0,
  inviter_id INTEGER,
  country_signup TEXT NOT NULL,
  game_login_code_hash TEXT NOT NULL UNIQUE,
  game_login_code_rotated_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  game_login_code_plain TEXT,
  FOREIGN KEY (inviter_id) REFERENCES users(id)
);

INSERT INTO users_new (
  id,
  username,
  username_lower,
  email,
  email_lower,
  password_hash,
  invite_code,
  invite_quota,
  invite_used,
  inviter_id,
  country_signup,
  game_login_code_hash,
  game_login_code_rotated_at,
  created_at,
  game_login_code_plain
)
SELECT
  id,
  username,
  username_lower,
  email,
  email_lower,
  password_hash,
  invite_code,
  invite_quota,
  invite_used,
  inviter_id,
  country_signup,
  game_login_code_hash,
  game_login_code_rotated_at,
  created_at,
  game_login_code_plain
FROM users;

DROP TABLE users;
ALTER TABLE users_new RENAME TO users;

CREATE INDEX IF NOT EXISTS idx_users_inviter_id ON users(inviter_id);

PRAGMA foreign_keys = ON;
