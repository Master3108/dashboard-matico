# Matico Android App (Guia simple)

Esta guia te ayuda a convertir la web de Matico en app Android y activar "Captura de pantalla celular".

## Estado actual (ya implementado)

- Proyecto configurado con Capacitor.
- Plataforma Android creada en carpeta `android/`.
- Plugin nativo Android `MaticoScreenCapture` agregado.
- Boton "Captura de pantalla celular" conectado desde Oraculo.
- Fallback para navegador movil: "Subir archivo" desde galeria.

## Requisitos en tu computador

- Node.js instalado.
- Android Studio instalado.
- Android SDK configurado (desde Android Studio).
- Java JDK (normalmente Android Studio lo resuelve).

## Comandos rapidos

Desde la raiz del proyecto:

```bash
npm install
npm run build
npm run cap:sync
npm run cap:android
```

Esto abre Android Studio con el proyecto listo.

## Crear APK beta para probar en celular

### Opcion facil (debug)

```bash
npm run apk:debug
```

APK generado en:

`android/app/build/outputs/apk/debug/app-debug.apk`

### Opcion produccion (release)

```bash
npm run apk:release
```

APK generado en:

`android/app/build/outputs/apk/release/app-release-unsigned.apk`

Nota: para distribuir a usuarios finales, lo ideal es firmar el APK en Android Studio.

## Instalar APK en Android

1. Enviar APK por WhatsApp, Drive o cable USB.
2. En el telefono, abrir el APK.
3. Si aparece bloqueo, habilitar "Instalar apps desconocidas".
4. Instalar y abrir Matico.

## Probar captura directa

1. Abrir app Matico.
2. Ir a Oraculo -> "Foto/screenshot cuaderno".
3. Tocar "Captura de pantalla celular".
4. Aceptar permiso de captura de pantalla del sistema.
5. Verificar que la imagen llegue al flujo OCR y genere preguntas.

## Si algo falla

- Si no funciona captura directa, usar "Subir archivo" como respaldo.
- Revisar logs en Android Studio (`Logcat`) filtrando por `MaticoScreenCapturePlugin`.
- Confirmar que la app abre `https://srv1048418.hstgr.cloud`.

## Siguiente fase (opcional)

- iPhone (iOS) con ReplayKit.
- Publicacion en Play Store.
