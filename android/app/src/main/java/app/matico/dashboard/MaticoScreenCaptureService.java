package app.matico.dashboard;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
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
import android.view.View;
import android.view.WindowManager;
import android.widget.FrameLayout;
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

    private MediaProjection mediaProjection;
    private MediaProjectionManager projectionManager;
    private VirtualDisplay virtualDisplay;
    private ImageReader imageReader;
    private WindowManager windowManager;
    private View overlayView;
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

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getAction() : null;
        if (ACTION_START_SESSION.equals(action)) {
            int resultCode = intent.getIntExtra(EXTRA_RESULT_CODE, 0);
            Intent resultData = intent.getParcelableExtra(EXTRA_RESULT_DATA);
            startSession(resultCode, resultData);
            return START_STICKY;
        }
        if (ACTION_CAPTURE_NOW.equals(action)) {
            captureNow(false);
            return START_STICKY;
        }
        if (ACTION_CAPTURE_ONE_SHOT.equals(action)) {
            captureNow(false);
            return START_STICKY;
        }
        if (ACTION_STOP_SESSION.equals(action)) {
            stopSession();
            stopSelf();
            return START_NOT_STICKY;
        }
        return START_STICKY;
    }

    private void startSession(int resultCode, @Nullable Intent resultData) {
        if (projectionManager == null || resultData == null) return;
        if (mediaProjection != null) return;

        mediaProjection = projectionManager.getMediaProjection(resultCode, resultData);
        if (mediaProjection == null) return;

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

        startForeground(NOTIFICATION_ID, buildNotification());
        MaticoScreenCaptureStore.setActive(true);
        showOverlayWithRetry(0);
    }

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
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Detener", stopPendingIntent)
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
        if (windowManager == null || overlayView != null || Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return;
        if (!android.provider.Settings.canDrawOverlays(this)) {
            Log.w("MaticoOverlay", "canDrawOverlays=false: burbuja no puede mostrarse.");
            Toast.makeText(this, "Permiso 'Aparecer encima de apps' requerido para la burbuja CAP", Toast.LENGTH_LONG).show();
            return;
        }

        mainHandler.postDelayed(() -> {
            if (overlayView != null || windowManager == null) return;
            try {
                FrameLayout container = new FrameLayout(MaticoScreenCaptureService.this);
                GradientDrawable halo = new GradientDrawable();
                halo.setShape(GradientDrawable.OVAL);
                halo.setColor(0x332563EB);
                halo.setSize(170, 170);

                FrameLayout haloView = new FrameLayout(MaticoScreenCaptureService.this);
                haloView.setBackground(halo);
                FrameLayout.LayoutParams haloParams = new FrameLayout.LayoutParams(170, 170);
                haloParams.gravity = Gravity.CENTER;
                container.addView(haloView, haloParams);

                TextView button = new TextView(MaticoScreenCaptureService.this);
                button.setText("CAP");
                button.setTextColor(0xFFFFFFFF);
                button.setTextSize(12f);
                button.setGravity(Gravity.CENTER);
                GradientDrawable circle = new GradientDrawable();
                circle.setShape(GradientDrawable.OVAL);
                circle.setColor(0xFF2563EB);
                circle.setStroke(4, 0xFF93C5FD);
                button.setBackground(circle);
                FrameLayout.LayoutParams buttonParams = new FrameLayout.LayoutParams(92, 92);
                buttonParams.gravity = Gravity.CENTER;
                container.addView(button, buttonParams);

                button.setOnClickListener(v -> captureNow(true));
                overlayView = container;

                final int overlayType = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                    ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                    : WindowManager.LayoutParams.TYPE_PHONE;

                WindowManager.LayoutParams params = new WindowManager.LayoutParams(
                    170,
                    170,
                    overlayType,
                    WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                        | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
                    PixelFormat.TRANSLUCENT
                );
                params.gravity = Gravity.TOP | Gravity.END;
                params.x = dp(12);
                params.y = dp(160);
                windowManager.addView(overlayView, params);
                Log.d("MaticoOverlay", "Burbuja CAP mostrada correctamente.");
            } catch (Exception e) {
                Log.e("MaticoOverlay", "showOverlay fallo: " + e.getMessage(), e);
                overlayView = null;
                if (attempt + 1 < OVERLAY_MAX_ATTEMPTS) {
                    showOverlayWithRetry(attempt + 1);
                    return;
                }
                Toast.makeText(MaticoScreenCaptureService.this, "No se pudo mostrar burbuja CAP. Usa la notificacion para capturar.", Toast.LENGTH_LONG).show();
            }
        }, OVERLAY_RETRY_MS);
    }

    private void hideOverlay() {
        if (windowManager != null && overlayView != null) {
            try {
                windowManager.removeView(overlayView);
            } catch (Exception ignored) {
                // no-op
            }
        }
        overlayView = null;
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
        if (imageReader == null || width <= 0 || height <= 0) return;
        AtomicBoolean done = new AtomicBoolean(false);
        imageReader.setOnImageAvailableListener(reader -> {
            if (done.get()) return;
            Image image = null;
            try {
                image = reader.acquireLatestImage();
                if (image == null) return;

                Image.Plane[] planes = image.getPlanes();
                if (planes.length == 0) return;

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
                done.set(true);

                if (returnToApp) {
                    mainHandler.postDelayed(this::bringAppToFront, 220);
                }
            } catch (Exception ignored) {
                done.set(true);
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
            }
        }, 3000);
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
            mediaProjection.stop();
            mediaProjection = null;
        }
        MaticoScreenCaptureStore.setActive(false);
        stopForeground(true);
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
