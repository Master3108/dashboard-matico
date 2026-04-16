# Captura Directa Móvil (Paso a Paso)

Este documento es para habilitar el botón **"Captura directa app"** en Android/iPhone.

## 1) Preparar el proyecto

Desde la raíz del proyecto:

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios
npx cap init matico app.matico.dashboard
```

Cuando pregunte la carpeta web, usa:

```text
dist
```

## 2) Build web + sincronizar móvil

```bash
npm run build
npx cap add android
npx cap add ios
npx cap sync
```

## 3) Crear plugin nativo `MaticoScreenCapture`

Debes crear un plugin nativo llamado `MaticoScreenCapture` con método:

- `captureScreenshot()`

Salida esperada:

```json
{
  "imageBase64": "...",
  "imageMimeType": "image/jpeg"
}
```

## 4) Android (MediaProjection)

- Abrir Android Studio:

```bash
npx cap open android
```

- Implementar permiso/flujo de `MediaProjection`.
- Mostrar prompt del sistema.
- Al aceptar, capturar frame y devolver base64.

## 5) iOS (ReplayKit)

- Abrir Xcode:

```bash
npx cap open ios
```

- Implementar flujo con `ReplayKit`.
- Solicitar permiso al usuario.
- Capturar imagen y devolver base64.

## 6) Probar en teléfono

```bash
npm run build
npx cap sync
```

Luego compilar y ejecutar desde Android Studio/Xcode.

## 7) Qué pasa hoy en web

- En navegador móvil normal, la captura directa no existe por seguridad del sistema.
- Por eso Matico muestra fallback: **subir screenshot desde galería**.

---

Si quieres, el siguiente paso es que te entregue el **plugin Android completo** (Java/Kotlin) para copiar y pegar.
