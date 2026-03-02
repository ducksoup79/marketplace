# MarketPlace Backend — Deployment Guide

This guide covers how to deploy the Node.js + Express API and PostgreSQL database to production.

---

## Before You Deploy

1. **Environment variables** — Never commit `.env`. On the server, set these (or use your platform’s env/config UI):

   | Variable | Description | Example |
   |----------|-------------|---------|
   | `DB_HOST` | PostgreSQL host | `localhost` or managed DB host |
   | `DB_PORT` | PostgreSQL port | `5432` |
   | `DB_USER` | Database user | `marketplace_app` |
   | `DB_PASSWORD` | Database password | Strong random password |
   | `DB_NAME` | Database name | `marketplace` |
   | `JWT_SECRET` | Signing secret for access tokens | 32+ random characters |
   | `REFRESH_TOKEN_SECRET` | Signing secret for refresh tokens | 32+ random characters |
   | `PORT` | Port the app listens on | `3001` or platform default |
   | `ADMIN_EMAIL` | Admin login email | Your choice |
   | `ADMIN_PASSWORD` | Admin password (for setup) | Strong password |

2. **Node version** — Use Node.js 18+ (same as local). Set via `engines` in `package.json` or your platform’s config.

3. **Database** — Run schema and seed once per environment (see below). Do not run `npm run setup` on every deploy.

---

## Browser & device compatibility (frontend)

The MarketPlace frontend (React + Vite) is built for **modern browsers and phones**. It should work correctly on:

| Environment | Support |
|-------------|--------|
| **Desktop** | Chrome, Firefox, Safari, Edge (current and previous major version) |
| **Phones** | iOS Safari 14+, Chrome and Samsung Internet on Android 8+ |
| **Tablets** | Same as phones; layout responds at 768px and 480px breakpoints |

**What’s in place**

- **Viewport & responsive:** `width=device-width, initial-scale=1` and media queries at 768px and 480px so layout adapts on small screens.
- **Touch-friendly:** Buttons and nav use at least 44px height on narrow viewports.
- **APIs:** Uses `fetch`, `FormData`, and standard DOM; no legacy or desktop-only APIs.
- **PayPal:** PayPal’s JS SDK supports the same modern browsers as above.

**Not supported**

- **Internet Explorer 11** — React 18 and Vite do not support IE. Use a modern browser.
- **Very old phones** — Devices that cannot run a recent OS (e.g. Android &lt; 8 or old iOS) may have an outdated WebView and can hit JS or layout issues.

**Widening support (optional)**  
To support slightly older Safari (e.g. 14) or older Android WebViews, add a build target in the frontend’s `vite.config.js`:

```js
export default defineConfig({
  plugins: [react()],
  build: { target: 'es2020' },  // broader support; omit for default (newer only)
  // ... rest
});
```

---

## Option 1: VPS (DigitalOcean, Linode, AWS EC2, etc.)

### 1.1 Server setup

- Ubuntu 22.04 (or similar).
- Install Node.js 20 LTS and PostgreSQL 14+:

```bash
# Node (using NodeSource)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# PostgreSQL
sudo apt update && sudo apt install -y postgresql postgresql-contrib
sudo systemctl start postgresql && sudo systemctl enable postgresql
```

### 1.2 PostgreSQL

```bash
sudo -u postgres psql -c "CREATE USER marketplace_app WITH PASSWORD 'your_secure_password';"
sudo -u postgres psql -c "CREATE DATABASE marketplace OWNER marketplace_app;"
```

### 1.3 Deploy app

```bash
# Clone or upload your project
cd /var/www  # or your chosen path
git clone <your-repo-url> marketplace-backend
cd marketplace-backend
```

Create `.env` (or use a secrets manager):

```bash
cp .env.example .env
nano .env   # set DB_*, JWT_SECRET, REFRESH_TOKEN_SECRET, PORT, ADMIN_*
```

Install, run DB setup once, then start with PM2:

```bash
npm ci --omit=dev
npm run setup
PORT=3001 node src/index.js
# Or with PM2 (recommended):
npm install -g pm2
pm2 start src/index.js --name marketplace-api
pm2 save && pm2 startup
```

### 1.4 Reverse proxy (Nginx)

Example Nginx server block so the API is available on port 80/443:

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Then enable HTTPS with Certbot: `sudo apt install certbot python3-certbot-nginx && sudo certbot --nginx`.

### 1.5 Reverse proxy (Apache2)

Use Apache2 as the reverse proxy in front of the Node app (e.g. on Ubuntu/Debian):

**1. Install Apache and enable proxy modules**

```bash
sudo apt update && sudo apt install -y apache2
sudo a2enmod proxy proxy_http headers
sudo systemctl restart apache2
```

**2. Create a VirtualHost**

Create a config file (replace `api.yourdomain.com` with your domain or server name):

```bash
sudo nano /etc/apache2/sites-available/marketplace-api.conf
```

Paste the following (adjust `ServerName` and ensure the Node app is listening on `127.0.0.1:3001`):

```apache
<VirtualHost *:80>
    ServerName api.yourdomain.com

    ProxyPreserveHost On
    ProxyPass / http://127.0.0.1:3001/
    ProxyPassReverse / http://127.0.0.1:3001/

    RequestHeader set X-Forwarded-Proto "http"
</VirtualHost>
```

**3. Enable the site and restart Apache**

```bash
sudo a2ensite marketplace-api.conf
sudo systemctl reload apache2
```

**4. Enable HTTPS with Certbot**

```bash
sudo apt install -y certbot python3-certbot-apache
sudo certbot --apache -d api.yourdomain.com
```

Certbot will create an SSL VirtualHost and redirect HTTP to HTTPS. After that, your config may include a `<VirtualHost *:443>` block with `SSLEngine on` and the same `ProxyPass` / `ProxyPassReverse` lines; the proxy target stays `http://127.0.0.1:3001`.

**5. Optional: WebSocket or long-lived connections**

If you add WebSockets or long-lived requests later, enable:

```bash
sudo a2enmod proxy_wstunnel
```

and use `ProxyPass` / `ProxyPassReverse` with `ws://` as needed.

---

## Option 2: Railway

1. Create a project at [railway.app](https://railway.app).
2. **PostgreSQL**: Add a PostgreSQL service; note the `DATABASE_URL` (or individual host/user/password).
3. **Backend**: Add a service from your GitHub repo (or upload). Set root directory to the backend folder if the repo is monorepo.
4. **Env**: In the service → Variables, set:
   - `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` (from the Postgres service, or derive from `DATABASE_URL`).
   - `JWT_SECRET`, `REFRESH_TOKEN_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and optionally `PORT`.
5. **Build**: Build command `npm ci` (or `npm install`). Start command: `npm start` or `node src/index.js`.
6. **Database setup**: Run schema/seed once:
   - Railway dashboard → your backend service → “Run command” / one-off run, or use Railway CLI:
   - `railway run npm run setup`
7. Deploy; Railway assigns a URL. You can add a custom domain in settings.

---

## Option 3: Render

1. Go to [render.com](https://render.com).
2. **PostgreSQL**: Create a new PostgreSQL database; note host, port, user, password, database name.
3. **Web Service**: New → Web Service → connect repo. Select the backend directory.
4. **Build**: Build command `npm install` (or `npm ci`). Start command `npm start` or `node src/index.js`.
5. **Env**: In Environment, add `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `JWT_SECRET`, `REFRESH_TOKEN_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `PORT` (Render often sets PORT automatically).
6. **DB setup**: After first deploy, run setup once via Shell (Render dashboard → Shell): `npm run setup`.
7. Deploy; use the generated URL or add a custom domain.

---

## Option 4: Fly.io

1. Install [Fly CLI](https://fly.io/docs/hands-on/install-flyctl/) and log in: `fly auth login`.
2. **Postgres**: `fly postgres create` (or attach an existing Postgres app). Attach it to your app: `fly postgres attach <postgres-app-name>`.
3. **App**: From your backend directory:

```bash
fly launch
# Choose app name, region; do not deploy yet.
```

4. **Docker**: Fly uses Docker. Create `Dockerfile` in the backend root:

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
EXPOSE 3001
CMD ["node", "src/index.js"]
```

5. Set secrets (env): `fly secrets set JWT_SECRET=... REFRESH_TOKEN_SECRET=... ADMIN_EMAIL=... ADMIN_PASSWORD=...`
   - DB_* are often set automatically when you attach Postgres; if not, set them from the Postgres app’s credentials.
6. **DB setup**: One-off: `fly ssh console` then `npm run setup`, or use a release command in `fly.toml` to run setup on first deploy only.
7. Deploy: `fly deploy`.

---

## Option 5: Docker (self‑hosted or any cloud)

Example **Dockerfile** (backend only):

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
EXPOSE 3001
CMD ["node", "src/index.js"]
```

Example **docker-compose.yml** (app + Postgres for a single machine):

```yaml
services:
  api:
    build: .
    ports:
      - "3001:3001"
    environment:
      DB_HOST: db
      DB_PORT: 5432
      DB_USER: marketplace
      DB_PASSWORD: ${DB_PASSWORD}
      DB_NAME: marketplace
      JWT_SECRET: ${JWT_SECRET}
      REFRESH_TOKEN_SECRET: ${REFRESH_TOKEN_SECRET}
      ADMIN_EMAIL: ${ADMIN_EMAIL}
      ADMIN_PASSWORD: ${ADMIN_PASSWORD}
      PORT: 3001
    depends_on:
      db:
        condition: service_healthy

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: marketplace
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: marketplace
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U marketplace"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  pgdata:
```

Create a `.env` file beside `docker-compose.yml` with `DB_PASSWORD`, `JWT_SECRET`, `REFRESH_TOKEN_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`.

Run:

```bash
docker compose up -d db
# Wait for Postgres to be healthy, then run setup (one-time)
docker compose run --rm api npm run setup
docker compose up -d api
```

---

## Troubleshooting

### Subscriptions not showing on client settings page

The client Settings → Subscription tab calls `GET /api/misc/roles`. If the database was created from the base schema only, the `client_role` table may be missing `plan_description` and `plan_features`. The API now falls back to a minimal query so Basic/Silver/Diamond still appear. For full plan copy (descriptions and features), run the migration on the **production** server:

```bash
cd /path/to/production/backend
node migrations/run-plan-description-features.js
```

Ensure `.env` is set so the script can connect to the same database. After the migration, redeploy or restart the API; no app code change is required.

### Report issue: column "screenshot_path" of relation "error_report" does not exist

The report-issue flow can attach a screenshot; that requires the `screenshot_path` column on `error_report`. The API will still accept reports without it (screenshot is omitted). To enable screenshot attachments, run the migration on the **production** server:

```bash
cd /path/to/production/backend
node migrations/run-error-report-screenshot.js
```

Restart the API after the migration.

---

## Checklist

- [ ] Set all required env vars on the server/platform (no `.env` in git).
- [ ] Use strong, unique `JWT_SECRET` and `REFRESH_TOKEN_SECRET`.
- [ ] Run `npm run setup` once per environment (creates DB, schema, seed + admin).
- [ ] Use HTTPS in production (Nginx, Apache2 + Certbot, or platform TLS).
- [ ] Restrict DB access (firewall / private network / allowed IPs).
- [ ] Use `npm ci --omit=dev` in production builds when possible.
- [ ] Consider process manager (PM2) or platform process management for restarts and logs.

---

## Quick reference: run setup once

After the database is created and env vars are set:

```bash
npm run setup
```

This creates the `marketplace` DB (if using the setup script against a superuser), applies `schema.sql`, and seeds data including the admin user (password from `ADMIN_PASSWORD`). Do not run it on every deploy.
