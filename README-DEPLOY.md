# Deploy Guide - Dashboard Matico

This file documents the current production setup for `dashboard-matico` so any developer or AI can verify how the project is actually deployed.

## Current Production Architecture

- VPS path: `/var/www/dashboard-matico`
- Frontend build: `/var/www/dashboard-matico/dist`
- Backend process: `pm2` running `server/index.js`
- Backend port: `127.0.0.1:3001`
- Public domain: `https://srv1048418.hstgr.cloud`
- Reverse proxy: `nginx` on the VPS

## Important: Current Setup Is Not Docker-Based

The repository still contains Docker files, but the working production setup is currently:

- `nginx` serves the frontend from `/var/www/dashboard-matico/dist`
- `nginx` proxies `/api/`, `/webhook/`, `/webhook-test/`, and `/uploads/` to `127.0.0.1:3001`
- `pm2` runs the Node backend directly

Do not assume production uses:

- frontend on `127.0.0.1:8080`
- backend on `127.0.0.1:5000`
- `docker-compose up --build -d`

That was an older setup and caused production confusion.

## Standard Update Commands

Run this on the VPS after pushing to GitHub:

```bash
cd /var/www/dashboard-matico
git pull origin main
npm install
npm run build
cd server
npm install
cd ..
pm2 restart matico-server
pm2 save
nginx -t
systemctl reload nginx
curl -I https://srv1048418.hstgr.cloud
```

## Backend Health Checks

Useful checks after deploy:

```bash
curl http://127.0.0.1:3001/api/health
pm2 status
pm2 logs matico-server --lines 100
ss -ltnp | grep -E ':3001|:443|:80'
```

## Webhook and Login Verification

The frontend login uses:

- `/webhook/MATICO`

Quick production verification:

```bash
curl -i -X POST https://srv1048418.hstgr.cloud/webhook/MATICO \
  -H "Content-Type: application/json" \
  -d '{"accion":"register","email":"prueba@matico.ai","password":"123456","name":"Prueba"}'

curl -i -X POST https://srv1048418.hstgr.cloud/webhook/MATICO \
  -H "Content-Type: application/json" \
  -d '{"accion":"login","email":"prueba@matico.ai","password":"123456"}'
```

Expected result:

- `200 OK`
- JSON response from Express
- no HTML `502 Bad Gateway`

## Nginx Reference

The active site should point to the real app, not to an old Docker container.

Expected behavior:

- `location /` serves `/var/www/dashboard-matico/dist`
- `location /api/` proxies to `http://127.0.0.1:3001/api/`
- `location /webhook/` proxies to `http://127.0.0.1:3001/webhook/`
- `location /webhook-test/` proxies to `http://127.0.0.1:3001/webhook-test/`
- `location /uploads/` proxies to `http://127.0.0.1:3001/uploads/`

## Incident Log: March 24, 2026

Production login failed with:

- `502 Bad Gateway`
- frontend error: `Unexpected token '<'`

Root cause:

1. `nginx` was forwarding the domain to `127.0.0.1:8080`
2. an old Docker-related path was still involved
3. a backup file was mistakenly left inside `/etc/nginx/sites-enabled`
4. that created two server blocks with the same `server_name`
5. the old block was still proxying traffic to the wrong target

Symptoms that revealed the issue:

- `nginx -t` warning about `conflicting server name "srv1048418.hstgr.cloud"`
- `curl` to public `/webhook/MATICO` returned HTML `502`
- `curl` to `http://127.0.0.1:3001/webhook/MATICO` returned JSON from Express

What fixed it:

1. update the active nginx site to serve the frontend from `/var/www/dashboard-matico/dist`
2. proxy webhook and API traffic to `127.0.0.1:3001`
3. remove the backup file from `/etc/nginx/sites-enabled`
4. reload nginx

Command that removed the conflicting site:

```bash
rm /etc/nginx/sites-enabled/matico.backup-20260324-173119
nginx -t
systemctl reload nginx
```

## Critical Rule for Future Changes

Do not leave backup files inside:

- `/etc/nginx/sites-enabled`

If you want a backup, store it in:

- `/etc/nginx/sites-available`
- another backup folder
- a timestamped file outside the enabled directory

Otherwise nginx may load the backup as a live site.

## Frontend Text and Cache Note

If one browser shows old text but another browser shows the correct text:

- verify the current `dist` build first
- then clear browser cache and local storage

Useful browser-side reset:

```js
localStorage.clear();
sessionStorage.clear();
caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))).then(() => location.reload());
```

## Repo Notes

- Main frontend entry: `src/App.jsx`
- Login screen posts to `/webhook/MATICO` from `src/components/LoginPage.jsx`
- Backend entry used in production: `server/server.js`

If an AI or teammate is debugging production, start with this file before changing nginx, pm2, or webhook behavior.

## Backend Entry Clarification

- The active backend entry for this repo is `server/index.js`
- `server/server.js` is a legacy compatibility file and should not be used for production deploys
- The frontend session report flow (`accion: "send_session_report"`) is implemented in `server/index.js`
- If `pm2` is still pointing at `server/server.js`, email/report features can fail or never run

Useful `pm2` checks on the VPS:

```bash
cd /var/www/dashboard-matico/server
pm2 show matico-server
pm2 delete matico-server || true
pm2 start index.js --name matico-server
pm2 save
```
