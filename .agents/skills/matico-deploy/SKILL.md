# MATICO: Real Deploy and Recovery Workflow

Use this guide when working on `dashboard-matico` deploys, production verification, or VPS recovery.

## Actual Production Topology

- Project path: `/var/www/dashboard-matico`
- Frontend is built with `vite` into `/var/www/dashboard-matico/dist`
- Backend runs directly with `pm2` using `server/server.js`
- Backend port: `3001`
- Public reverse proxy: `nginx`
- Public host: `srv1048418.hstgr.cloud`

## Do Not Assume Docker Is Active Production

This repo contains Docker artifacts, but the current working production flow is not Docker-first.

Avoid assuming:

- frontend on `8080`
- backend on `5000`
- `docker-compose up --build -d` is the standard deploy path

## Standard Release Sequence

### Local

```bash
git add .
git commit -m "your message"
git push origin main
```

### VPS

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
```

## Verification Commands

```bash
curl http://127.0.0.1:3001/api/health
curl -I https://srv1048418.hstgr.cloud
curl -i -X POST https://srv1048418.hstgr.cloud/webhook/MATICO -H "Content-Type: application/json" -d '{"accion":"login","email":"prueba@matico.ai","password":"123456"}'
pm2 status
pm2 logs matico-server --lines 100
```

## Nginx Expectations

The active site should:

- serve `/var/www/dashboard-matico/dist` for `/`
- proxy `/api/` to `127.0.0.1:3001`
- proxy `/webhook/` to `127.0.0.1:3001`
- proxy `/webhook-test/` to `127.0.0.1:3001`
- proxy `/uploads/` to `127.0.0.1:3001`

## Known Incident Pattern

If production shows:

- `502 Bad Gateway`
- `Unexpected token '<'`
- login failing on `/webhook/MATICO`

check this first:

```bash
nginx -T | grep -n "server_name srv1048418.hstgr.cloud"
nginx -T | grep -n "proxy_pass"
ls -l /etc/nginx/sites-enabled
```

On March 24, 2026 the root cause was:

- a backup file was accidentally left in `/etc/nginx/sites-enabled`
- nginx loaded both the real site and the backup
- the old block still proxied traffic to `127.0.0.1:8080`

Fix:

```bash
rm /etc/nginx/sites-enabled/<backup-file>
nginx -t
systemctl reload nginx
```

## Safety Rule

Never leave backups in `/etc/nginx/sites-enabled`.

Keep backups elsewhere so nginx does not activate them.
