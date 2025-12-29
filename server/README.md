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

Trust proxy (req.ip / X-Forwarded-For)
-------------------------------------
When the server runs behind a reverse proxy (for example nginx in front of the Node app),
the real client IP will be present in the `X-Forwarded-For` header. Express must be
configured to "trust" the proxy for `req.ip` to reflect the true client IP.

This project enables `app.set('trust proxy', true)` only when the `TRUST_PROXY`
environment variable is explicitly set to a truthy value (`1`, `true`, or `yes`).
This avoids implicitly trusting forwarded headers in non-proxy environments.

To enable trust proxy:
- Set `TRUST_PROXY=true` in your `.env`, or
- Add `TRUST_PROXY=true` to the server service environment in your docker-compose.

Example .env line:
TRUST_PROXY=true

Example docker-compose snippet (add under `server.environment`):
    environment:
      - NODE_ENV=production
      - PORT=4000
      - REDIS_URL=redis://redis:6379
      - FRONTEND_URL=http://localhost
      - JWT_SECRET=change_this_to_a_strong_secret
      - COOKIE_SECURE=true
      - TRUST_PROXY=true

When enabled the server logs will indicate that "Express trust proxy is ENABLED".
This is important for accurate client IP detection when storing session ip metadata and when you rely
on `req.ip` behind a proxy.