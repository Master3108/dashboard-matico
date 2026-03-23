# 🚀 Guía de Deploy - Dashboard Matico

## Estructura del Proyecto

```
dashboard-matico/
├── src/                    # Frontend React
├── server/                 # Backend Node.js
│   ├── server.js          # Servidor Express
│   └── package.json       # Dependencias backend
├── dist/                  # Build del frontend (generado)
└── uploads/               # PDFs guardados (generado automáticamente)
```

---

## 📦 PASO 1: Subir a GitHub

```bash
cd C:\Users\Usuario\.gemini\antigravity\scratch\dashboard-matico

# Inicializar git
git init

# Agregar todos los archivos
git add .

# Commit
git commit -m "feat: escaneo de cuadernos con backend Node.js - v2.0"

# Conectar con tu repo
git remote add origin https://github.com/Master3108/dashboard-matico.git

# Subir (forzar)
git push -u origin main --force
```

---

## 🖥️ PASO 2: Configurar VPS (Hostinger)

Conéctate a tu VPS vía SSH:

```bash
ssh root@srv1048418.hstgr.cloud
# o
ssh usuario@tu-ip
```

### 2.1 Instalar Node.js y npm

```bash
# Actualizar sistema
apt update && apt upgrade -y

# Instalar Node.js (versión 18 o superior)
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Verificar instalación
node -v  # Debe mostrar v18.x.x o superior
npm -v   # Debe mostrar 9.x.x o superior
```

### 2.2 Instalar PM2 (para mantener el servidor corriendo)

```bash
npm install -g pm2
```

### 2.3 Clonar el repositorio

```bash
cd /var/www
# o donde quieras instalarlo

git clone https://github.com/Master3108/dashboard-matico.git
cd dashboard-matico
```

### 2.4 Instalar dependencias del Backend

```bash
cd server
npm install

# Volver a la raíz
cd ..
```

### 2.5 Instalar dependencias del Frontend y hacer Build

```bash
# En la raíz del proyecto
npm install
npm run build

# Esto creará la carpeta dist/
```

### 2.6 Configurar PM2

```bash
# Iniciar el servidor con PM2
pm2 start server/server.js --name "matico-server"

# Guardar configuración
pm2 save

# Configurar inicio automático
pm2 startup systemd
# Te dará un comando, ejecútalo (algo como:
# sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u root --hp /root)
```

### 2.7 Configurar Nginx (Recomendado)

```bash
# Instalar nginx
apt install nginx -y

# Crear configuración
nano /etc/nginx/sites-available/matico
```

Pega esto:

```nginx
server {
    listen 80;
    server_name srv1048418.hstgr.cloud;  # Tu dominio o IP

    # Backend API
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Archivos estáticos (uploads)
    location /uploads/ {
        alias /var/www/dashboard-matico/server/uploads/;
        autoindex on;
    }

    # Frontend (React)
    location / {
        root /var/www/dashboard-matico/dist;
        try_files $uri $uri/ /index.html;
    }
}
```

Activar sitio:

```bash
# Crear symlink
ln -s /etc/nginx/sites-available/matico /etc/nginx/sites-enabled/

# Eliminar default si existe
rm /etc/nginx/sites-enabled/default

# Testear configuración
nginx -t

# Reiniciar nginx
systemctl restart nginx
```

### 2.8 Configurar SSL (HTTPS) - Opcional pero recomendado

```bash
# Instalar certbot
apt install certbot python3-certbot-nginx -y

# Generar certificado
certbot --nginx -d srv1048418.hstgr.cloud

# Seguir las instrucciones interactivas
```

---

## 🧪 PASO 3: Verificar que todo funciona

### Verificar backend:
```bash
curl http://localhost:3001/api/health
```
Debería responder:
```json
{"status":"OK","timestamp":"2026-01-23T...","uptime":...}
```

### Verificar lista de PDFs:
```bash
curl http://localhost:3001/api/list-notebooks
```
Debería responder:
```json
{"success":true,"count":0,"files":[]}
```

### Verificar frontend:
Abre tu navegador en: `https://srv1048418.hstgr.cloud`

---

## 🔄 Comandos útiles para mantenimiento

### Ver logs del servidor:
```bash
pm2 logs matico-server
```

### Reiniciar servidor:
```bash
pm2 restart matico-server
```

### Actualizar código (después de un git push):
```bash
cd /var/www/dashboard-matico
git pull origin main
npm install
npm run build
pm2 restart matico-server
```

### Ver espacio en disco:
```bash
df -h
du -sh server/uploads/
```

---

## 📁 Ubicación de los PDFs

Los PDFs escaneados se guardan en:
```
/var/www/dashboard-matico/server/uploads/notebooks/
```

La metadata está en:
```
/var/www/dashboard-matico/server/uploads/notebooks_metadata.json
```

---

## 🔧 Troubleshooting

### Error: "Cannot find module"
```bash
cd /var/www/dashboard-matico/server
npm install
```

### Error: "EACCES: permission denied"
```bash
chown -R www-data:www-data /var/www/dashboard-matico
chmod -R 755 /var/www/dashboard-matico
```

### Error: "Port 3001 already in use"
```bash
# Matar proceso en el puerto 3001
kill $(lsof -t -i:3001)
pm2 restart matico-server
```

### Error 502 Bad Gateway (Nginx)
```bash
# Verificar que el backend está corriendo
pm2 status
pm2 logs matico-server

# Verificar nginx
systemctl status nginx
nginx -t
```

---

## 📝 API Endpoints

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/save-notebook` | Guardar PDF escaneado |
| GET | `/api/list-notebooks` | Listar todos los PDFs |
| GET | `/api/view-notebook/:filename` | Ver PDF en navegador |
| GET | `/api/download-notebook/:filename` | Descargar PDF |
| DELETE | `/api/delete-notebook/:id` | Eliminar PDF |
| GET | `/api/stats` | Estadísticas |
| GET | `/api/health` | Health check |

---

## 🎉 Listo!

Tu Dashboard Matico ahora tiene:
- ✅ Frontend React en `/`
- ✅ Backend Node.js en `/api/*`
- ✅ Guardado de PDFs escaneados
- ✅ Listado de PDFs en el administrador
- ✅ Todo corriendo 24/7 con PM2

¡Prueba escanear un cuaderno y debería aparecer en el Administrador de PDFs! 📄✨
