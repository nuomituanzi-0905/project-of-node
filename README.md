# Full Project: Backend (Node) + Frontend (Vue 3 / Vite)

This repository contains two separate projects:

- `server/` — Node.js backend (Express) with JWT + Redis auth, refresh-token rotation, session management, SSE events, device/IP metadata.
- `front/` — Vue 3 (Vite) frontend demonstrating login, silent refresh, protected requests, session management UI and SSE for session events.

High-level
- Backend stores refresh tokens in Redis with metadata (jti, createdAt, ip, userAgent).
- Refresh tokens are set as httpOnly cookies; access tokens are returned in response bodies and kept in memory by the SPA.
- Sessions can be listed and revoked. SSE notifies clients of session revocations.
- The frontend and backend are isolated in separate folders and can be run independently.

Quick start (development)
1. Start Redis (e.g., via Docker):
   docker run -p 6379:6379 redis

2. Backend
   cd server
   cp .env.example .env
   # Edit .env if needed (JWT_SECRET, FRONTEND_URL)
   npm install
   npm run dev
   # Backend starts on PORT (default 4000)

3. Frontend
   cd front
   npm install
   npm run dev
   # Frontend starts on Vite dev port 5173

CORS & cookies
- The backend will use FRONTEND_URL from `.env` to allow cross-origin requests with credentials.
- Ensure FRONTEND_URL matches the running dev server origin (default http://localhost:5173).

Notes
- The backend uses a JSON file `server/data/db.json` for simple storage in demos. Replace with a real DB for production.
- Use HTTPS and set COOKIE_SECURE=true in production.



Trust proxy note
----------------
If you run the server behind a reverse proxy (for example nginx in the production docker-compose),
and you want Express to use `X-Forwarded-*` headers (so `req.ip` reflects the real client IP),
set the `TRUST_PROXY` environment variable explicitly to a truthy value:

- Add `TRUST_PROXY=true` to `server/.env`, or
- Add `TRUST_PROXY=true` to the `server.environment` section in your docker-compose.

Example docker-compose `server` environment (production):
    environment:
      - NODE_ENV=production
      - PORT=4000
      - REDIS_URL=redis://redis:6379
      - FRONTEND_URL=http://localhost
      - JWT_SECRET=change_this_to_a_strong_secret
      - COOKIE_SECURE=true
      - TRUST_PROXY=true

Important: the server will only enable trust proxy when `TRUST_PROXY` is explicitly set.
This prevents accidentally trusting forwarded headers in environments where no reverse proxy is used.