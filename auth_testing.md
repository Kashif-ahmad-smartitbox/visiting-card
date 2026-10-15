# Auth testing notes
- JWT cookies (access_token 15m, refresh_token 7d) via /api/auth/login|register. Bearer header also accepted.
- Google: session_token cookie stored in db.user_sessions {user_id, session_token, expires_at ISO}.
- To fake a Google session: insert users {user_id, email, name, org_id or null, role:"admin", active:true} + user_sessions {user_id, session_token, expires_at: ISO 7 days ahead}; then send cookie session_token or Authorization: Bearer <token>.
- Brute force: 5 failed logins per ip:email -> 429 for 15 min.

# Image testing rules
- Accepted: image/jpeg, image/png, image/webp, application/pdf. Sample card: /app/tests/test_card.png
- Don't send blank/solid images.
