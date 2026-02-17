CREATE TABLE IF NOT EXISTS users (
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
  FOREIGN KEY (inviter_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS invite_uses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  inviter_id INTEGER NOT NULL,
  invitee_id INTEGER NOT NULL,
  signup_ip TEXT NOT NULL,
  signup_country TEXT NOT NULL,
  used_at TEXT NOT NULL,
  FOREIGN KEY (inviter_id) REFERENCES users(id),
  FOREIGN KEY (invitee_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_users_inviter_id ON users(inviter_id);
CREATE INDEX IF NOT EXISTS idx_invite_uses_inviter_id ON invite_uses(inviter_id);
