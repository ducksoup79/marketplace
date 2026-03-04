# MarketPlace production

This folder is a **deployment-ready** copy of the app for a VPS.

- **backend/** – Node.js API (PostgreSQL, JWT, payments, messages)
- **frontend/** – React + Vite app (build to static files and serve with Nginx)
- **mobile_testing/** – Expo React Native app (for local testing)

See **[DEPLOY.md](./DEPLOY.md)** for step-by-step deployment (env, migrations, PM2, Nginx, SSL).

## Test the mobile app with Expo (no build)

In **mobile_testing/**:

```bash
# 1. Start the API (one terminal)
cd backend && npm run dev

# 2. Start Expo (another terminal)
cd mobile_app && npm start
```

Then press **`i`** for iOS simulator, **`a`** for Android emulator, or scan the QR code with **Expo Go** on your phone. No `npm run build` needed.

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
