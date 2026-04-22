# Dashboard Matico

Proyecto principal de Matico (frontend React + backend Node + deploy Docker en VPS Hostinger).

## Reference First

Before deploying or updating production, read:

- `README-DEPLOY.md`

That file contains the official command order:

1. Update local machine.
2. Update VPS Docker containers.

## Quick Commands

### Local build

```powershell
cd C:\Users\Usuario\.gemini\antigravity\scratch\dashboard-matico
npm install
npm run build
```

### Run local dev

```powershell
cd C:\Users\Usuario\.gemini\antigravity\scratch\dashboard-matico
npm run dev
```

### Android sync/build (Capacitor)

```powershell
cd C:\Users\Usuario\.gemini\antigravity\scratch\dashboard-matico
npx cap sync android
cd android
.\gradlew.bat assembleDebug
```

APK debug path (nombre con versionName):

- `android\app\build\outputs\apk\debug\MaticoApp-debug-v<versionName>.apk`
- Ejemplo actual (v1.5-captura-prompt): `MaticoApp-debug-v1.5-captura-prompt.apk`

## Captura Celular (Android)

Flujo oficial v1.5: sesion persistente + pill flotante arrastrable + prompt
"Otra captura / Finalizar" tras cada captura + cola + auto-envio al modulo.

### Secuencia de uso (lo que ve el estudiante)

1. Dentro de Matico, entra al modulo (Cuaderno, Evidencias, etc.) y pulsa
   **`Captura de pantalla celular`**.
2. Android muestra el dialogo de permiso de captura: acepta y selecciona
   **Pantalla completa**. (La primera vez tambien hay que activar
   "Aparecer encima" / `SYSTEM_ALERT_WINDOW` para Matico.)
3. Matico se oculta y deja visible:
   - Un **marco azul** alrededor de la pantalla (solo decorativo).
   - La **pill azul `Captura pantalla`** (arrastrable y con snap al borde).
4. Navega por el celular (otra app, galeria, etc.) y toca la pill cuando
   quieras capturar. El frame se guarda en la cola nativa.
5. **Inmediatamente despues de cada captura**, la pill se reemplaza por
   un prompt centrado con dos botones:
   - **`Otra captura`** (azul): oculta el prompt y vuelve a mostrar la pill
     para seguir capturando.
   - **`Finalizar`** (verde): cierra la sesion de captura, regresa a Matico
     y dispara automaticamente la funcion de procesamiento del modulo que
     inicio la sesion (OCR / analisis / envio, segun el modulo).
6. Si prefieres cerrar desde fuera, la notificacion persistente de Matico
   tambien tiene los botones `Capturar` y `Finalizar` y se comportan igual
   que los del overlay.

### Comportamiento tecnico por modulo

- `EvidenceIntake.jsx`: al recibir el evento `captureSessionFinalized`, importa
  la cola automaticamente (silencioso) y agrega cada captura a la lista de
  evidencias. El modulo padre continua con su submit normal.
- `CuadernoMission.jsx`: al recibir el evento, importa la cola y llama a
  `submitScan(assets)` automaticamente (auto-envio al backend Oracle).
- Fallback: ambos modulos tambien escuchan `window.focus` y
  `document.visibilitychange` por si el evento nativo no llega.

### APIs nuevas (JS / Capacitor)

- Bridge: `src/mobile/screenCaptureBridge.js`
  - `onNativeCaptureSessionFinalized(callback) -> unsubscribe`
    Subscribe al evento `captureSessionFinalized` del plugin nativo.
    Retorna una funcion para desuscribirse (usarla en el cleanup de `useEffect`).
- Plugin Capacitor: evento `captureSessionFinalized` con payload
  `{ active: false, queueCount: number }`.

### Componentes nativos involucrados

- `MaticoScreenCaptureService.java` — foreground service que monta el overlay
  y el `MediaProjection`; gestiona los dos estados (pill / prompt) y el boton
  Finalizar.
- `MaticoScreenCapturePlugin.java` — registra un `SessionFinalizedListener` en
  `load()` y emite `notifyListeners("captureSessionFinalized", ...)` a JS.
- `MaticoScreenCaptureStore.java` — cola en memoria de capturas (base64).

### Rebuild tras cambios de captura

Siempre que toques el service/plugin nativo o el bridge:

```powershell
cd C:\Users\Usuario\.gemini\antigravity\scratch\dashboard-matico
npm run build
npx cap sync android
cd android
.\gradlew.bat assembleDebug
```

Luego instala el APK desde `android\app\build\outputs\apk\debug\MaticoApp-debug-v<versionName>.apk`.
Si Android se queja de "aplicacion ya instalada", desinstala primero o sube el
`versionCode` en `android/app/build.gradle`.

### Troubleshooting

- La pill no aparece: revisa que "Aparecer encima de otras apps" este activo
  para Matico en Ajustes -> Aplicaciones -> Matico -> Permisos especiales.
- El tap no captura: asegurate de haber seleccionado "Pantalla completa" al
  dar el permiso (no "Solo esta app"). Si la pantalla esta estatica, el
  servicio drena el ultimo frame del buffer; si aun asi falla, mueve algo
  en pantalla y vuelve a tocar.
- Finalizar no procesa: confirma que el modulo esta montado cuando tocas
  Finalizar (no navegues a otra ruta de Matico despues de iniciar la sesion).

## Main Files (Feature Map)

- Universal evidence intake: `src/components/EvidenceIntake.jsx`
- Oracle notebook flow: `src/components/OracleNotebookExamBuilder.jsx`
- Exam screenshot/scan flow: `src/components/ExamCaptureModal.jsx`
- Notebook mission flow: `src/components/CuadernoMission.jsx`
- Main app wiring (prep/weak sessions): `src/App.jsx`
- Backend APIs and OCR/oracle logic: `server/index.js`
- Mobile native bridge: `src/mobile/screenCaptureBridge.js`
- Android native capture components:
  - `android/app/src/main/java/app/matico/dashboard/MaticoScreenCapturePlugin.java`
  - `android/app/src/main/java/app/matico/dashboard/MaticoScreenCaptureService.java`
  - `android/app/src/main/java/app/matico/dashboard/MaticoScreenCaptureStore.java`
