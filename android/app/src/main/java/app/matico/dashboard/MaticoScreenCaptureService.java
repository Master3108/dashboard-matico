package app.matico.dashboard;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.Bitmap;
import android.graphics.PixelFormat;
import android.graphics.drawable.GradientDrawable;
import android.hardware.display.DisplayManager;
import android.hardware.display.VirtualDisplay;
import android.media.Image;
import android.media.ImageReader;
import android.media.projection.MediaProjection;
import android.media.projection.MediaProjectionManager;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.Base64;
import android.util.DisplayMetrics;
import android.util.Log;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewConfiguration;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;
import java.util.concurrent.atomic.AtomicBoolean;

public class MaticoScreenCaptureService extends Service {
    public static final String ACTION_START_SESSION = "app.matico.dashboard.ACTION_START_SESSION";
    public static final String ACTION_CAPTURE_NOW = "app.matico.dashboard.ACTION_CAPTURE_NOW";
    public static final String ACTION_STOP_SESSION = "app.matico.dashboard.ACTION_STOP_SESSION";
    public static final String ACTION_CAPTURE_ONE_SHOT = "app.matico.dashboard.ACTION_CAPTURE_ONE_SHOT";
    public static final String EXTRA_RESULT_CODE = "resultCode";
    public static final String EXTRA_RESULT_DATA = "resultData";

    private static final String CHANNEL_ID = "matico_capture_channel";
    private static final int NOTIFICATION_ID = 44221;
    private static final int OVERLAY_RETRY_MS = 450;
    private static final int OVERLAY_MAX_ATTEMPTS = 4;
    private static final int OVERLAY_FRAME_PADDING_DP = 10;
    private static final int OVERLAY_FRAME_STROKE_DP = 3;

    // Pill "Captura pantalla" (estado A)
    private static final int BUBBLE_WIDTH_DP = 150;
    private static final int BUBBLE_HEIGHT_DP = 56;
    private static final int BUBBLE_MARGIN_DP = 16;
    private static final int BUBBLE_BOTTOM_OFFSET_DP = 180;

    // Prompt post-captura (estado B) con dos botones: Otra / Finalizar
    private static final int PROMPT_WIDTH_DP = 300;
    private static final int PROMPT_HEIGHT_DP = 64;
    private static final int PROMPT_BUTTON_MARGIN_DP = 6;

    // Listener estatico para que el Plugin Capacitor sepa cuando el usuario toco "Finalizar".
    public interface SessionFinalizedListener {
        void onFinalized(int queueCount);
    }

    private static SessionFinalizedListener sessionFinalizedListener;

    public static void setSessionFinalizedListener(@Nullable SessionFinalizedListener listener) {
        sessionFinalizedListener = listener;
    }

    private MediaProjection mediaProjection;
    private MediaProjectionManager projectionManager;
    private VirtualDisplay virtualDisplay;
    private ImageReader imageReader;
    private WindowManager windowManager;
    private View frameOverlayView;
    private View captureBubbleView;   // Estado A: "Captura pantalla"
    private View promptOverlayView;   // Estado B: "Otra / Finalizar"
    private WindowManager.LayoutParams captureBubbleLayoutParams;
    private WindowManager.LayoutParams promptLayoutParams;
    private Handler mainHandler;
    private int width;
    private int height;
    private int density;

    @Override
    public void onCreate() {
        super.onCreate();
        mainHandler = new Handler(Looper.getMainLooper());
        projectionManager = (MediaProjectionManager) getSystemService(Context.MEDIA_PROJECTION_SERVICE);
        windowManager = (WindowManager) getSystemService(Context.WINDOW_SERVICE);
        createNotificationChannel();
    }

    // Helper discreto: solo lo dejamos para errores reales, no para diagnostico de cada paso.
    private void toast(String msg) {
        if (mainHandler != null) {
            mainHandler.post(() -> Toast.makeText(MaticoScreenCaptureService.this, msg, Toast.LENGTH_SHORT).show());
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        try {
            String action = intent != null ? intent.getAction() : null;
            if (ACTION_START_SESSION.equals(action)) {
                int resultCode = intent.getIntExtra(EXTRA_RESULT_CODE, 0);
                Intent resultData = intent.getParcelableExtra(EXTRA_RESULT_DATA);
                startSession(resultCode, resultData);
                return START_NOT_STICKY;
            }
            if (ACTION_CAPTURE_NOW.equals(action)) {
                captureNow(true);
                return START_NOT_STICKY;
            }
            if (ACTION_CAPTURE_ONE_SHOT.equals(action)) {
                captureNow(false);
                return START_NOT_STICKY;
            }
            if (ACTION_STOP_SESSION.equals(action)) {
                // Mismo comportamiento que el boton "Finalizar" del overlay: notificar al
                // plugin para que los modulos JS puedan reaccionar (auto-procesar la cola).
                finalizeSessionFromOverlay();
                return START_NOT_STICKY;
            }
        } catch (Throwable error) {
            Log.e("MaticoCaptureService", "onStartCommand fallo: " + error.getMessage(), error);
            try {
                stopSession();
            } catch (Throwable ignored) {
                // no-op
            }
            stopSelf();
        }
        return START_NOT_STICKY;
    }

    private void startSession(int resultCode, @Nullable Intent resultData) {
        // PASO 1: foreground SIEMPRE primero. Evita ForegroundServiceDidNotStartInTimeException.
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(
                    NOTIFICATION_ID,
                    buildNotification(),
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION
                );
            } else {
                startForeground(NOTIFICATION_ID, buildNotification());
            }
        } catch (Throwable fgError) {
            Log.e("MaticoCaptureService", "startForeground fallo: " + fgError.getMessage(), fgError);
            toast("Matico: no pudo iniciar servicio en primer plano");
            stopSelf();
            return;
        }

        try {
            if (projectionManager == null || resultData == null || windowManager == null) {
                Log.w("MaticoCaptureService", "No se pudo iniciar sesion: servicios del sistema no disponibles.");
                stopSession();
                stopSelf();
                return;
            }
            if (mediaProjection != null) return;

            mediaProjection = projectionManager.getMediaProjection(resultCode, resultData);
            if (mediaProjection == null) {
                Log.w("MaticoCaptureService", "MediaProjection devolvio null (token consumido o invalido).");
                toast("Matico: permiso de captura invalido, reintenta.");
                stopSession();
                stopSelf();
                return;
            }

            // Android 14+ exige registrar callback ANTES de createVirtualDisplay.
            mediaProjection.registerCallback(projectionCallback, mainHandler);

            DisplayMetrics metrics = new DisplayMetrics();
            windowManager.getDefaultDisplay().getRealMetrics(metrics);
            width = metrics.widthPixels;
            height = metrics.heightPixels;
            density = metrics.densityDpi;

            imageReader = ImageReader.newInstance(width, height, PixelFormat.RGBA_8888, 2);
            virtualDisplay = mediaProjection.createVirtualDisplay(
                "MaticoScreenCaptureDisplay",
                width,
                height,
                density,
                DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
                imageReader.getSurface(),
                null,
                mainHandler
            );

            MaticoScreenCaptureStore.setActive(true);
            showOverlayWithRetry(0);
        } catch (Throwable error) {
            Log.e("MaticoCaptureService", "startSession fallo: " + error.getMessage(), error);
            toast("Matico: error iniciando captura (" + error.getClass().getSimpleName() + ")");
            stopSession();
            stopSelf();
        }
    }

    // Callback obligatorio desde Android 14 (API 34).
    private final MediaProjection.Callback projectionCallback = new MediaProjection.Callback() {
        @Override
        public void onStop() {
            Log.d("MaticoCaptureService", "MediaProjection.onStop: el sistema detuvo la captura.");
            if (mainHandler != null) {
                mainHandler.post(() -> {
                    try {
                        stopSession();
                    } finally {
                        stopSelf();
                    }
                });
            }
        }
    };

    private Notification buildNotification() {
        Intent captureIntent = new Intent(this, MaticoScreenCaptureService.class);
        captureIntent.setAction(ACTION_CAPTURE_NOW);
        PendingIntent capturePendingIntent = PendingIntent.getService(
            this,
            1001,
            captureIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
        );

        Intent stopIntent = new Intent(this, MaticoScreenCaptureService.class);
        stopIntent.setAction(ACTION_STOP_SESSION);
        PendingIntent stopPendingIntent = PendingIntent.getService(
            this,
            1002,
            stopIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
        );

        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Matico captura activa")
            .setContentText("Navega y toca capturar cuando quieras.")
            .setSmallIcon(android.R.drawable.ic_menu_camera)
            .setOngoing(true)
            .addAction(android.R.drawable.ic_menu_camera, "Capturar", capturePendingIntent)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Finalizar", stopPendingIntent)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            "Matico captura",
            NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription("Captura de pantalla de Matico");
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) {
            manager.createNotificationChannel(channel);
        }
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private void showOverlayWithRetry(int attempt) {
        if (windowManager == null || Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return;
        if (frameOverlayView != null || captureBubbleView != null || promptOverlayView != null) return;
        if (!android.provider.Settings.canDrawOverlays(this)) {
            Log.w("MaticoOverlay", "canDrawOverlays=false: marco/boton no pueden mostrarse.");
            toast("Matico: activa 'Aparecer encima' para mostrar la burbuja.");
            return;
        }

        mainHandler.postDelayed(() -> {
            if (windowManager == null) return;
            if (frameOverlayView != null || captureBubbleView != null || promptOverlayView != null) return;
            try {
                // Marco azul
                FrameLayout frameContainer = new FrameLayout(MaticoScreenCaptureService.this);
                frameContainer.setPadding(
                    dp(OVERLAY_FRAME_PADDING_DP),
                    dp(OVERLAY_FRAME_PADDING_DP),
                    dp(OVERLAY_FRAME_PADDING_DP),
                    dp(OVERLAY_FRAME_PADDING_DP)
                );
                View borderView = new View(MaticoScreenCaptureService.this);
                GradientDrawable frameDrawable = new GradientDrawable();
                frameDrawable.setShape(GradientDrawable.RECTANGLE);
                frameDrawable.setColor(0x151D4ED8);
                frameDrawable.setCornerRadius(dp(20));
                frameDrawable.setStroke(dp(OVERLAY_FRAME_STROKE_DP), 0xCC60A5FA);
                borderView.setBackground(frameDrawable);
                frameContainer.addView(borderView, new FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.MATCH_PARENT,
                    FrameLayout.LayoutParams.MATCH_PARENT
                ));

                // Pill "Captura pantalla" (estado A)
                TextView bubble = buildCaptureBubbleView();
                attachDragToCaptureBubble(bubble);

                // Prompt "Otra / Finalizar" (estado B) - pre-construido y oculto
                LinearLayout prompt = buildPromptView();

                frameOverlayView = frameContainer;
                captureBubbleView = bubble;
                promptOverlayView = prompt;

                windowManager.addView(frameOverlayView, buildFrameLayoutParams());
                captureBubbleLayoutParams = buildCaptureBubbleLayoutParams();
                windowManager.addView(captureBubbleView, captureBubbleLayoutParams);
                promptLayoutParams = buildPromptLayoutParams();
                // Mostramos el prompt oculto (GONE) hasta que haya una captura exitosa.
                promptOverlayView.setVisibility(View.GONE);
                windowManager.addView(promptOverlayView, promptLayoutParams);

                Log.d("MaticoOverlay", "Marco + pill 'Captura pantalla' + prompt oculto listos.");
            } catch (Exception e) {
                Log.e("MaticoOverlay", "showOverlay fallo: " + e.getMessage(), e);
                hideOverlay();
                if (attempt + 1 < OVERLAY_MAX_ATTEMPTS) {
                    showOverlayWithRetry(attempt + 1);
                    return;
                }
                toast("Matico: no pudo pintarse la burbuja. Usa la notificacion.");
            }
        }, OVERLAY_RETRY_MS);
    }

    private TextView buildCaptureBubbleView() {
        TextView bubble = new TextView(this);
        bubble.setText("Captura\npantalla");
        bubble.setTextColor(0xFFFFFFFF);
        bubble.setTextSize(13f);
        bubble.setGravity(Gravity.CENTER);
        bubble.setAllCaps(false);
        bubble.setTypeface(bubble.getTypeface(), android.graphics.Typeface.BOLD);
        bubble.setLineSpacing(0f, 0.95f);
        GradientDrawable bubbleDrawable = new GradientDrawable();
        bubbleDrawable.setShape(GradientDrawable.RECTANGLE);
        bubbleDrawable.setColor(0xFF2563EB); // azul Matico
        bubbleDrawable.setCornerRadius(dp(BUBBLE_HEIGHT_DP / 2));
        bubbleDrawable.setStroke(dp(2), 0xFFFFFFFF);
        bubble.setBackground(bubbleDrawable);
        bubble.setElevation(dp(6));
        return bubble;
    }

    // Prompt con dos botones (Otra captura / Finalizar) que se muestra tras cada captura.
    private LinearLayout buildPromptView() {
        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER);

        TextView another = new TextView(this);
        another.setText("Otra captura");
        another.setTextColor(0xFFFFFFFF);
        another.setTextSize(13f);
        another.setAllCaps(false);
        another.setGravity(Gravity.CENTER);
        another.setTypeface(another.getTypeface(), android.graphics.Typeface.BOLD);
        GradientDrawable anotherBg = new GradientDrawable();
        anotherBg.setShape(GradientDrawable.RECTANGLE);
        anotherBg.setColor(0xFF2563EB); // azul
        anotherBg.setCornerRadius(dp(BUBBLE_HEIGHT_DP / 2));
        anotherBg.setStroke(dp(2), 0xFFFFFFFF);
        another.setBackground(anotherBg);
        another.setPadding(dp(14), dp(8), dp(14), dp(8));
        another.setElevation(dp(6));
        another.setOnClickListener(v -> showCaptureBubble());

        TextView finish = new TextView(this);
        finish.setText("Finalizar");
        finish.setTextColor(0xFFFFFFFF);
        finish.setTextSize(13f);
        finish.setAllCaps(false);
        finish.setGravity(Gravity.CENTER);
        finish.setTypeface(finish.getTypeface(), android.graphics.Typeface.BOLD);
        GradientDrawable finishBg = new GradientDrawable();
        finishBg.setShape(GradientDrawable.RECTANGLE);
        finishBg.setColor(0xFF16A34A); // verde "enviar"
        finishBg.setCornerRadius(dp(BUBBLE_HEIGHT_DP / 2));
        finishBg.setStroke(dp(2), 0xFFFFFFFF);
        finish.setBackground(finishBg);
        finish.setPadding(dp(14), dp(8), dp(14), dp(8));
        finish.setElevation(dp(6));
        finish.setOnClickListener(v -> finalizeSessionFromOverlay());

        LinearLayout.LayoutParams leftLp = new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, 1f);
        leftLp.setMargins(0, 0, dp(PROMPT_BUTTON_MARGIN_DP), 0);
        LinearLayout.LayoutParams rightLp = new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, 1f);
        rightLp.setMargins(dp(PROMPT_BUTTON_MARGIN_DP), 0, 0, 0);

        row.addView(another, leftLp);
        row.addView(finish, rightLp);
        return row;
    }

    private WindowManager.LayoutParams buildFrameLayoutParams() {
        WindowManager.LayoutParams params = new WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.MATCH_PARENT,
            resolveOverlayType(),
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                | WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE
                | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN
                | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT
        );
        params.gravity = Gravity.TOP | Gravity.START;
        return params;
    }

    private WindowManager.LayoutParams buildCaptureBubbleLayoutParams() {
        WindowManager.LayoutParams params = new WindowManager.LayoutParams(
            dp(BUBBLE_WIDTH_DP),
            dp(BUBBLE_HEIGHT_DP),
            resolveOverlayType(),
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN
                | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT
        );
        params.gravity = Gravity.TOP | Gravity.START;
        params.x = Math.max(0, width - dp(BUBBLE_WIDTH_DP) - dp(BUBBLE_MARGIN_DP));
        params.y = Math.max(0, height - dp(BUBBLE_HEIGHT_DP) - dp(BUBBLE_BOTTOM_OFFSET_DP));
        return params;
    }

    private WindowManager.LayoutParams buildPromptLayoutParams() {
        WindowManager.LayoutParams params = new WindowManager.LayoutParams(
            dp(PROMPT_WIDTH_DP),
            dp(PROMPT_HEIGHT_DP),
            resolveOverlayType(),
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN
                | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT
        );
        params.gravity = Gravity.TOP | Gravity.START;
        // Centrado horizontal, un poco mas arriba que la pill
        params.x = Math.max(0, (width - dp(PROMPT_WIDTH_DP)) / 2);
        params.y = Math.max(0, height - dp(PROMPT_HEIGHT_DP) - dp(BUBBLE_BOTTOM_OFFSET_DP));
        return params;
    }

    // Estado A: muestra la pill "Captura pantalla", oculta el prompt.
    private void showCaptureBubble() {
        if (captureBubbleView != null) captureBubbleView.setVisibility(View.VISIBLE);
        if (promptOverlayView != null) promptOverlayView.setVisibility(View.GONE);
    }

    // Estado B: muestra el prompt "Otra / Finalizar", oculta la pill.
    private void showPostCapturePrompt() {
        if (captureBubbleView != null) captureBubbleView.setVisibility(View.GONE);
        if (promptOverlayView != null) promptOverlayView.setVisibility(View.VISIBLE);
    }

    // Handler del boton "Finalizar" en el prompt.
    private void finalizeSessionFromOverlay() {
        int queueCount = MaticoScreenCaptureStore.queueCount();
        SessionFinalizedListener listener = sessionFinalizedListener;
        // 1. volver a Matico
        bringAppToFront();
        // 2. parar sesion (libera overlay, proyeccion, foreground)
        stopSession();
        // 3. avisar al plugin para que emita el evento a JS
        if (listener != null) {
            try {
                listener.onFinalized(queueCount);
            } catch (Throwable ignored) {
                // no-op
            }
        }
        stopSelf();
    }

    // Permite arrastrar la pill y, si el dedo apenas se mueve, dispara la captura (tap).
    private void attachDragToCaptureBubble(View bubble) {
        final int touchSlop = ViewConfiguration.get(this).getScaledTouchSlop();
        final int bubbleWidthPx = dp(BUBBLE_WIDTH_DP);
        final int bubbleHeightPx = dp(BUBBLE_HEIGHT_DP);
        final int marginPx = dp(BUBBLE_MARGIN_DP);

        bubble.setOnTouchListener(new View.OnTouchListener() {
            private int startX;
            private int startY;
            private float downRawX;
            private float downRawY;
            private boolean dragging;

            @Override
            public boolean onTouch(View v, MotionEvent event) {
                if (captureBubbleLayoutParams == null) return false;
                switch (event.getActionMasked()) {
                    case MotionEvent.ACTION_DOWN:
                        startX = captureBubbleLayoutParams.x;
                        startY = captureBubbleLayoutParams.y;
                        downRawX = event.getRawX();
                        downRawY = event.getRawY();
                        dragging = false;
                        v.setAlpha(0.85f);
                        return true;

                    case MotionEvent.ACTION_MOVE: {
                        float dx = event.getRawX() - downRawX;
                        float dy = event.getRawY() - downRawY;
                        if (!dragging && (Math.abs(dx) > touchSlop || Math.abs(dy) > touchSlop)) {
                            dragging = true;
                        }
                        if (dragging && windowManager != null && captureBubbleView != null) {
                            int maxX = Math.max(0, width - bubbleWidthPx);
                            int maxY = Math.max(0, height - bubbleHeightPx);
                            captureBubbleLayoutParams.x = Math.max(0, Math.min(maxX, startX + (int) dx));
                            captureBubbleLayoutParams.y = Math.max(0, Math.min(maxY, startY + (int) dy));
                            try {
                                windowManager.updateViewLayout(captureBubbleView, captureBubbleLayoutParams);
                            } catch (Exception ignored) {
                                // no-op
                            }
                        }
                        return true;
                    }

                    case MotionEvent.ACTION_UP:
                    case MotionEvent.ACTION_CANCEL:
                        v.setAlpha(1f);
                        if (!dragging) {
                            v.performClick();
                            captureNow(false); // <-- no volvemos a Matico tras cada captura
                        } else if (windowManager != null && captureBubbleView != null) {
                            int midX = width / 2;
                            captureBubbleLayoutParams.x = (captureBubbleLayoutParams.x + bubbleWidthPx / 2) < midX
                                ? marginPx
                                : Math.max(0, width - bubbleWidthPx - marginPx);
                            try {
                                windowManager.updateViewLayout(captureBubbleView, captureBubbleLayoutParams);
                            } catch (Exception ignored) {
                                // no-op
                            }
                        }
                        return true;
                }
                return false;
            }
        });
    }

    private int resolveOverlayType() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            : WindowManager.LayoutParams.TYPE_PHONE;
    }

    private void hideOverlay() {
        if (windowManager != null && frameOverlayView != null) {
            try {
                windowManager.removeView(frameOverlayView);
            } catch (Exception ignored) {
                // no-op
            }
        }
        if (windowManager != null && captureBubbleView != null) {
            try {
                windowManager.removeView(captureBubbleView);
            } catch (Exception ignored) {
                // no-op
            }
        }
        if (windowManager != null && promptOverlayView != null) {
            try {
                windowManager.removeView(promptOverlayView);
            } catch (Exception ignored) {
                // no-op
            }
        }
        frameOverlayView = null;
        captureBubbleView = null;
        promptOverlayView = null;
        captureBubbleLayoutParams = null;
        promptLayoutParams = null;
    }

    private void bringAppToFront() {
        try {
            Intent launchIntent = getPackageManager().getLaunchIntentForPackage(getPackageName());
            if (launchIntent == null) return;
            launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            startActivity(launchIntent);
        } catch (Exception ignored) {
            // no-op
        }
    }

    private void captureNow(boolean returnToApp) {
        if (imageReader == null || width <= 0 || height <= 0) {
            return;
        }

        // Intento 1: drenar cualquier frame ya en el buffer.
        Image existing = null;
        try {
            existing = imageReader.acquireLatestImage();
        } catch (Exception ignored) {
            // no-op
        }
        if (existing != null) {
            boolean ok = processImageAndStore(existing);
            try { existing.close(); } catch (Exception ignored) {}
            if (ok) {
                onCaptureStored(returnToApp);
                return;
            }
        }

        // Intento 2: esperar el proximo frame con listener.
        AtomicBoolean done = new AtomicBoolean(false);
        imageReader.setOnImageAvailableListener(reader -> {
            if (done.get()) return;
            Image image = null;
            try {
                image = reader.acquireLatestImage();
                if (image == null) return;
                boolean ok = processImageAndStore(image);
                done.set(true);
                if (ok) {
                    onCaptureStored(returnToApp);
                }
            } catch (Exception e) {
                done.set(true);
                Log.e("MaticoCaptureService", "captureNow ERROR " + e.getClass().getSimpleName(), e);
            } finally {
                if (image != null) image.close();
                if (done.get() && imageReader != null) {
                    imageReader.setOnImageAvailableListener(null, null);
                }
            }
        }, mainHandler);

        mainHandler.postDelayed(() -> {
            if (done.compareAndSet(false, true) && imageReader != null) {
                imageReader.setOnImageAvailableListener(null, null);
                toast("Matico: no llego el frame (3s). Mueve la pantalla e intenta de nuevo.");
            }
        }, 3000);
    }

    // Hook ejecutado tras guardar una captura: muestra el prompt "Otra / Finalizar".
    private void onCaptureStored(boolean returnToApp) {
        int total = MaticoScreenCaptureStore.queueCount();
        toast("Captura " + total + " guardada.");
        mainHandler.post(this::showPostCapturePrompt);
        if (returnToApp) {
            mainHandler.postDelayed(this::bringAppToFront, 120);
        }
    }

    private boolean processImageAndStore(Image image) {
        try {
            Image.Plane[] planes = image.getPlanes();
            if (planes.length == 0) return false;

            ByteBuffer buffer = planes[0].getBuffer();
            int pixelStride = planes[0].getPixelStride();
            int rowStride = planes[0].getRowStride();
            int rowPadding = rowStride - pixelStride * width;

            Bitmap bitmap = Bitmap.createBitmap(
                width + (rowPadding / pixelStride),
                height,
                Bitmap.Config.ARGB_8888
            );
            bitmap.copyPixelsFromBuffer(buffer);
            Bitmap croppedBitmap = Bitmap.createBitmap(bitmap, 0, 0, width, height);

            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            croppedBitmap.compress(Bitmap.CompressFormat.JPEG, 88, baos);
            byte[] imageBytes = baos.toByteArray();
            String base64Image = Base64.encodeToString(imageBytes, Base64.NO_WRAP);
            MaticoScreenCaptureStore.push(base64Image, "image/jpeg");

            try { bitmap.recycle(); } catch (Exception ignored) {}
            try { if (croppedBitmap != bitmap) croppedBitmap.recycle(); } catch (Exception ignored) {}
            return true;
        } catch (Exception e) {
            Log.e("MaticoCaptureService", "processImageAndStore fallo: " + e.getMessage(), e);
            return false;
        }
    }

    private void stopSession() {
        hideOverlay();
        if (virtualDisplay != null) {
            virtualDisplay.release();
            virtualDisplay = null;
        }
        if (imageReader != null) {
            try {
                imageReader.setOnImageAvailableListener(null, null);
                imageReader.close();
            } catch (Exception ignored) {
                // no-op
            }
            imageReader = null;
        }
        if (mediaProjection != null) {
            try {
                mediaProjection.unregisterCallback(projectionCallback);
            } catch (Exception ignored) {
                // no-op
            }
            try {
                mediaProjection.stop();
            } catch (Exception ignored) {
                // no-op
            }
            mediaProjection = null;
        }
        MaticoScreenCaptureStore.setActive(false);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                stopForeground(STOP_FOREGROUND_REMOVE);
            } else {
                stopForeground(true);
            }
        } catch (Exception ignored) {
            // no-op
        }
    }

    @Override
    public void onDestroy() {
        stopSession();
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
