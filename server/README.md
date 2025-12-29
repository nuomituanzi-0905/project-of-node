```markdown
# Server (Node) — Auth demo

Setup:
1. Copy `.env.example` to `.env` and edit values.
2. Start Redis (e.g., `docker run -p 6379:6379 redis`).
3. Install:
   npm install
4. Run:
   npm run dev

Default admin: username `admin`, password `admin123` (created on first run).

Endpoints:
- POST /api/auth/register
- POST /api/auth/login
- POST /api/auth/refresh
- POST /api/auth/logout
- GET /api/auth/sessions
- DELETE /api/auth/sessions/:jti
- GET /api/auth/events (SSE)
- GET /api/user/info
- GET /api/admin/panel (admin only)
```