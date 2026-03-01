# MarketPlace production

This folder is a **deployment-ready** copy of the app for a VPS.

- **backend/** – Node.js API (PostgreSQL, JWT, payments, messages)
- **frontend/** – React + Vite app (build to static files and serve with Nginx)

See **[DEPLOY.md](./DEPLOY.md)** for step-by-step deployment (env, migrations, PM2, Nginx, SSL).

## Quick start on the server

```bash
# Backend
cd backend && cp .env.example .env && npm install --production
# Edit .env, run migrations, then:
npm start
# Or from production/: pm2 start ecosystem.config.cjs

# Frontend (build once, then serve dist/ with Nginx)
cd frontend && cp .env.production.example .env.production && npm install && npm run build
```
