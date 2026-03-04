# MarketPlace – VPS deployment

This folder contains a production-ready copy of the **Backend** and **Frontend**. Use it to deploy on a VPS (e.g. Ubuntu) with Node.js, PostgreSQL, and **Nginx or Apache 2**.

---

## 1. Server requirements

- **Node.js** 18+ (LTS)
- **PostgreSQL** 14+
- **Nginx** or **Apache 2** (reverse proxy / static file server)
- **PM2** (optional, for keeping the API running): `npm install -g pm2`

---

## 2. Backend

### 2.1 Database

- Create a PostgreSQL database and user:
  ```bash
  sudo -u postgres createuser -P marketplace_user
  sudo -u postgres createdb -O marketplace_user marketplace
  ```
- Load schema and seed (from `production/backend/`, with your DB credentials):
  ```bash
  psql -h localhost -U marketplace_user -d marketplace -f schema.sql
  psql -h localhost -U marketplace_user -d marketplace -f seed.sql
  ```
  (If you use a setup script instead, run that so tables and roles exist.)

### 2.2 Env and install

```bash
cd production/backend
cp .env.example .env
# Edit .env: set DB_*, JWT_SECRET, REFRESH_TOKEN_SECRET, PORT
npm install --production
```

### 2.3 Migrations (if needed)

Run migrations so message, payment, and other tables exist:

```bash
node migrations/run-messages-table.js
node migrations/run-payment-tables.js
node migrations/run-error-report-screenshot.js
node migrations/run-plan-description-features.js
node migrations/run-add-client-name.js
node migrations/run-sync-diamond-adverts.js
```

### 2.4 Run API

- **Direct:** `npm start` (or `node src/index.js`)
- **With PM2 (from `production/`):**  
  `pm2 start ecosystem.config.cjs`  
  Then: `pm2 save` and `pm2 startup` so it restarts on reboot.

API will listen on `PORT` (default 3001). Create `backend/logs` if you use PM2 and the ecosystem file’s log paths.

---

## 3. Frontend

### 3.1 Build

```bash
cd production/frontend
cp .env.production.example .env.production
# Edit .env.production: set VITE_API_URL to your public API URL (e.g. https://api.yourdomain.com)
npm install
npm run build
```

Output is in `frontend/dist/`. Serve this directory with Nginx, Apache 2, or any static file server.

---

## 4. Nginx (reverse proxy + static)

Example: site on `yourdomain.com`, API on `api.yourdomain.com`.

**API (e.g. `api.yourdomain.com`):**

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
        client_max_body_size 10M;
    }

    location /uploads {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
    }
}
```

**Frontend (e.g. `yourdomain.com`) – with security headers:**

Use the provided config that includes all security headers for the webapp:

```bash
sudo cp production/nginx/frontend-with-security-headers.conf /etc/nginx/sites-available/marketplace-frontend
# Edit server_name and root if needed, then:
sudo ln -s /etc/nginx/sites-available/marketplace-frontend /etc/nginx/sites-enabled/
```

Or paste the following into your frontend server block. Headers included:

| Header | What it protects against |
|--------|---------------------------|
| **Strict-Transport-Security** | Forces HTTPS — stops protocol downgrade attacks (set only in HTTPS server block) |
| **Content-Security-Policy** | XSS and code injection |
| **X-Frame-Options** | Clickjacking |
| **X-Content-Type-Options** | MIME sniffing attacks |
| **Referrer-Policy** | Data leakage via referrer |
| **Permissions-Policy** | Blocks abuse of camera/mic/geolocation |

Minimal frontend block with headers (if not using the full config file):

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    root /var/www/marketplace/frontend/dist;
    index index.html;

    add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' https:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

For HTTPS, use the SSL server block in `nginx/frontend-with-security-headers.conf` (includes **Strict-Transport-Security**).

- Point `root` to the path where you deployed `frontend/dist` (e.g. `/var/www/marketplace/frontend/dist`).
- Enable: `sudo ln -s /etc/nginx/sites-available/marketplace /etc/nginx/sites-enabled/` then `sudo nginx -t` and `sudo systemctl reload nginx`.

Use **SSL** (e.g. Certbot) so `VITE_API_URL` can be `https://api.yourdomain.com`.

---

## 4b. Apache 2 (alternative to Nginx)

If you use **Apache 2** instead of Nginx for the frontend, use the provided config with the same security headers:

**Enable required modules:**

```bash
sudo a2enmod headers rewrite
# For HTTPS: sudo a2enmod ssl
sudo systemctl reload apache2
```

**Frontend with security headers:**

```bash
sudo cp production/apache/frontend-with-security-headers.conf /etc/apache2/sites-available/marketplace-frontend.conf
# Edit ServerName and DocumentRoot in the file if needed, then:
sudo a2ensite marketplace-frontend
sudo systemctl reload apache2
```

- Set `DocumentRoot` to your `frontend/dist` path (e.g. `/var/www/marketplace/frontend/dist`).
- The config includes SPA fallback (RewriteRule to `index.html`) and the same headers as the Nginx config (see table in §4). For HTTPS and **Strict-Transport-Security**, uncomment the `<VirtualHost *:443>` block and set `SSLCertificateFile` / `SSLCertificateKeyFile` (e.g. from Certbot).

**API proxy with Apache** (if the API is on the same server):

```apache
# In a separate site or vhost for api.yourdomain.com
ProxyPass / http://127.0.0.1:3001/
ProxyPassReverse / http://127.0.0.1:3001/
# Enable: sudo a2enmod proxy proxy_http
```

---

## 5. Checklist

- [ ] PostgreSQL created and `.env` has correct `DB_*`
- [ ] `.env` has strong `JWT_SECRET` and `REFRESH_TOKEN_SECRET`
- [ ] Backend migrations run
- [ ] `backend/uploads` exists and is writable
- [ ] Frontend built with correct `VITE_API_URL` (https API URL)
- [ ] Nginx (or proxy) serves API and frontend; SSL for production
- [ ] API runs under PM2 (or systemd) and restarts on reboot
- [ ] Webapp served with security headers (use `nginx/frontend-with-security-headers.conf` or `apache/frontend-with-security-headers.conf`; enable HTTPS for HSTS)
