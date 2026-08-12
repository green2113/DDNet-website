-- ============================================
-- 카지노 경제 초기화 + 지정 계정 5000 지급
-- D1: Run all in transaction 권장
--
-- 지갑 500 / 은행·주식 보유 삭제 / 시세 초기가
-- 명탄, 어리, 1725, HAYDEN, qwerty12 → 지갑 5000
-- ============================================

-- 0) 대상 계정 확인
SELECT id, username, COALESCE(display_name, username) AS display_name
FROM users
WHERE username IN ('명탄', '어리', '1725', 'HAYDEN', 'qwerty12')
   OR username_lower IN ('명탄', '어리', '1725', 'hayden', 'qwerty12')
   OR COALESCE(display_name, '') IN ('명탄', '어리', '1725', 'HAYDEN', 'qwerty12')
   OR COALESCE(display_name_lower, '') IN ('명탄', '어리', '1725', 'hayden', 'qwerty12');

-- 1) 전원 지갑 500 (행 없으면 생성)
INSERT OR REPLACE INTO user_casino_balances (user_id, balance, updated_at)
SELECT id, 500, datetime('now')
FROM users;

-- 2) 은행 잔액 삭제
DELETE FROM user_bank_balances;

-- 3) 주식 보유 삭제
DELETE FROM user_stock_holdings;

-- 4) 주식 시세 초기가 (NOVA/PIXEL/FLUX/MIRA)
INSERT OR REPLACE INTO stock_market_state (ticker, price, updated_at) VALUES
  ('NOVA', 1000, datetime('now')),
  ('PIXEL', 2000, datetime('now')),
  ('FLUX', 2500, datetime('now')),
  ('MIRA', 3000, datetime('now'));

-- 5) 세금 풀 0 (테이블이 없으면 생성)
CREATE TABLE IF NOT EXISTS casino_tax_pool (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  balance INTEGER NOT NULL DEFAULT 0 CHECK(balance >= 0),
  updated_at TEXT NOT NULL
);
INSERT OR REPLACE INTO casino_tax_pool (id, balance, updated_at)
VALUES (1, 0, datetime('now'));

-- 6) 지정 계정 지갑 5000
INSERT OR REPLACE INTO user_casino_balances (user_id, balance, updated_at)
SELECT id, 5000, datetime('now')
FROM users
WHERE username IN ('명탄', '어리', '1725', 'HAYDEN', 'qwerty12')
   OR username_lower IN ('명탄', '어리', '1725', 'hayden', 'qwerty12')
   OR COALESCE(display_name, '') IN ('명탄', '어리', '1725', 'HAYDEN', 'qwerty12')
   OR COALESCE(display_name_lower, '') IN ('명탄', '어리', '1725', 'hayden', 'qwerty12');

-- 7) 결과 확인
SELECT u.id, u.username, COALESCE(u.display_name, u.username) AS display_name, c.balance
FROM users u
LEFT JOIN user_casino_balances c ON c.user_id = u.id
WHERE u.username IN ('명탄', '어리', '1725', 'HAYDEN', 'qwerty12')
   OR u.username_lower IN ('명탄', '어리', '1725', 'hayden', 'qwerty12')
   OR COALESCE(u.display_name, '') IN ('명탄', '어리', '1725', 'HAYDEN', 'qwerty12')
   OR COALESCE(u.display_name_lower, '') IN ('명탄', '어리', '1725', 'hayden', 'qwerty12');

SELECT COUNT(*) AS wallets, MIN(balance) AS min_balance, MAX(balance) AS max_balance
FROM user_casino_balances;

SELECT ticker, price FROM stock_market_state ORDER BY ticker;
