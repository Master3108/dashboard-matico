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

APK debug path:

- `android\app\build\outputs\apk\debug\app-debug.apk`

## Captura Celular (Android)

- Flujo oficial: sesion persistente + burbuja flotante + cola de capturas.
- Ya no se usa captura one-shot en modulos moviles de cuaderno.
- Secuencia de uso:
  1. Pulsa `Captura de pantalla celular`.
  2. Acepta permiso de captura y selecciona pantalla completa.
  3. Navega por el celular y usa la burbuja azul `CAP`.
  4. Vuelve a Matico y pulsa `Importar cola`.

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
