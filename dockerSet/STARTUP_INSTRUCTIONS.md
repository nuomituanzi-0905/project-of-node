```markdown
Starting the project (two options)

Prerequisites:
- Docker & docker-compose OR Node.js + npm (for concurrently dev).
- Redis is required for the server (docker-compose will provide it).

Option A — Local development using concurrently (runs server and front dev servers):
1. Install top-level tooling:
   npm install

2. Install server and front dependencies:
   npm --prefix server install
   npm --prefix front install

3. Run both dev servers:
   npm run dev

This runs:
- server: `npm --prefix server run dev` (server/dev uses nodemon)
- front: `npm --prefix front run dev` (Vite dev server)

Option B — Run with Docker Compose (Redis + server + front):
1. Ensure Docker daemon is running.
2. From repo root:
   docker-compose up --build

This builds and runs three services:
- redis on 6379
- server on 4000
- front on 5173

Open the frontend in your browser: http://localhost:5173

Stopping:
- Ctrl+C the docker-compose process or:
  docker-compose down

Notes:
- The server container is configured to use Redis at redis://redis:6379.
- FRONTEND_URL in the server environment is set to http://localhost:5173 (used for CORS).
- Update JWT_SECRET in docker-compose.yml or server/.env for security.
```