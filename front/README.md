```markdown
# Frontend (Vue 3 + Vite)

Setup:
1. cd front
2. npm install
3. npm run dev

Notes:
- By default the frontend expects backend at http://localhost:4000. Adjust VITE_API_BASE_URL if needed.
- The frontend uses withCredentials:true so refresh cookies are sent.
- The session UI connects to /api/auth/events (SSE) — run backend on same host or ensure cookies & CORS allow credentials.
```