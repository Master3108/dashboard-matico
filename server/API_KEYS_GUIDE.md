# Guía de Configuración de API Keys (Matico AI)

El backend de Matico (`server/index.js`) puede funcionar con múltiples proveedores de inteligencia artificial (Kimi/Moonshot, DeepSeek, OpenAI).

La configuración de qué IA utilizar se define enteramente en el archivo `/var/www/dashboard-matico/server/.env` de tu servidor VPS.

## 1. Usar DeepSeek (Recomendado)

DeepSeek ha demostrado ser más rápido y estable. Para activarlo, el archivo `server/.env` debe tener la variable `DEEPSEEK_API_KEY` y **NO** tener la variable `KIMI_API_KEY`.

**Ejemplo del `.env` para DeepSeek:**
```env
PORT=5000
DEEPSEEK_API_KEY=sk-14c11e6d5d54492b95c1743a52dfe526

# Google Sheets Config
GOOGLE_SHEETS_ID=1l1GLMXh8_Uo_O7XJOY7ZJxh1TER2hxrXTOsc_EcByHo
GOOGLE_SERVICE_ACCOUNT_EMAIL=matico-server@matico-app.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEv...[Tu_Llave]...\n-----END PRIVATE KEY-----\n"
```

## 2. Usar Kimi / Moonshot

Si prefieres usar Kimi, debes proporcionar la variable `KIMI_API_KEY`. **Nota importante:** Si ambas variables existen, el código dará prioridad a Kimi automáticamente.

*Advertencia sobre Kimi:* Las claves recién creadas pueden arrojar el error `{"error": "401 Invalid Authentication"}` si la cuenta no tiene fondos, si no ha sido verificada en la plataforma china, o si la clave fue revocada.

**Ejemplo del `.env` para Kimi:**
```env
PORT=5000
KIMI_API_KEY=sk-TuClaveSecretaKimiAqui

# Google Sheets Config
GOOGLE_SHEETS_ID=1l1GLMXh8_Uo_O7XJOY7ZJxh1TER2hxrXTOsc_EcByHo
...
```

## 3. ¿Cómo Aplicar los Cambios en el VPS?

Cada vez que modifiques una API Key en el archivo `server/.env`, el contenedor de Docker que ejecuta el servidor de Node.js no se enterará hasta que lo reconstruyas.

Ejecuta exactamente estos comandos en el VPS:

```bash
cd /var/www/dashboard-matico
docker rm -f dashboard-matico_server_1
docker-compose build --no-cache server
docker-compose up -d
```

## 4. ¿Cómo comprobar si la llave funciona antes de subirla?

Puedes probar si una llave es rechazada por el proveedor directamente desde la terminal del VPS.

**Prueba para DeepSeek:**
```bash
curl -X POST "https://api.deepseek.com/chat/completions" \
     -H "Authorization: Bearer sk-14c11e6d5d54492b95c1743a52dfe526" \
     -H "Content-Type: application/json" \
     -d '{"model": "deepseek-chat", "messages": [{"role": "user", "content": "Hola"}]}'
```
*(Si responde "¡Hola!", la llave funciona. Si dice "Authentication Fails", está caducada o mal escrita).*

**Prueba para Kimi/Moonshot:**
```bash
curl -X POST "https://api.moonshot.cn/v1/chat/completions" \
     -H "Authorization: Bearer TuClaveKimiAqui" \
     -H "Content-Type: application/json" \
     -d '{"model": "moonshot-v1-8k", "messages": [{"role": "user", "content": "Hola"}]}'
```
*(Si dice "Invalid Authentication", la plataforma de Kimi rechazó la llave directamente).*
