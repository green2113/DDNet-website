-- ============================================
-- 지정 계정 카지노 지갑 5000 지급
-- D1: Run all in transaction 권장
-- ============================================

-- 1) 대상 확인 (실행 전)
SELECT id, username, username_lower
FROM users
WHERE username IN ('명탄', '어리', '1725', 'HAYDEN', 'qwerty12')
   OR username_lower IN ('명탄', '어리', '1725', 'hayden', 'qwerty12');

-- 2) 잔액 5000 설정 (행 없으면 생성)
INSERT OR REPLACE INTO user_casino_balances (user_id, balance, updated_at)
SELECT id, 5000, datetime('now')
FROM users
WHERE username IN ('명탄', '어리', '1725', 'HAYDEN', 'qwerty12')
   OR username_lower IN ('명탄', '어리', '1725', 'hayden', 'qwerty12');

-- 3) 결과 확인
SELECT u.id, u.username, c.balance, c.updated_at
FROM users u
LEFT JOIN user_casino_balances c ON c.user_id = u.id
WHERE u.username IN ('명탄', '어리', '1725', 'HAYDEN', 'qwerty12')
   OR u.username_lower IN ('명탄', '어리', '1725', 'hayden', 'qwerty12');
