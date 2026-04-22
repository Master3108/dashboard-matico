package app.matico.dashboard;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.PixelFormat;
import android.hardware.display.DisplayManager;
import android.hardware.display.VirtualDisplay;
import android.media.Image;
import android.media.ImageReader;
import android.media.projection.MediaProjection;
import android.media.projection.MediaProjectionConfig;
import android.media.projection.MediaProjectionManager;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.util.Base64;
import android.util.DisplayMetrics;
import android.view.WindowManager;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;
import java.util.concurrent.atomic.AtomicBoolean;

@CapacitorPlugin(name = "MaticoScreenCapture")
public class MaticoScreenCapturePlugin extends Plugin {
    private MediaProjectionManager oneShotProjectionManager;
    private final Handler oneShotHandler = new Handler(Looper.getMainLooper());

    @Override
    public void load() {
        super.load();
        // El service avisa al plugin cuando el usuario toca "Finalizar" en el overlay.
        MaticoScreenCaptureService.setSessionFinalizedListener(queueCount -> {
            JSObject payload = new JSObject();
            payload.put("queueCount", queueCount);
            payload.put("active", false);
            notifyListeners("captureSessionFinalized", payload);
        });
    }

    @Override
    protected void handleOnDestroy() {
        MaticoScreenCaptureService.setSessionFinalizedListener(null);
        super.handleOnDestroy();
    }

    @PluginMethod
    public void captureScreenshot(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.LOLLIPOP) {
            call.reject("screen_capture_not_supported");
            return;
        }
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("activity_unavailable");
            return;
        }
        oneShotProjectionManager = (MediaProjectionManager) activity.getSystemService(Context.MEDIA_PROJECTION_SERVICE);
        if (oneShotProjectionManager == null) {
            call.reject("media_projection_unavailable");
            return;
        }
        startActivityForResult(call, oneShotProjectionManager.createScreenCaptureIntent(), "handleOneShotCapturePermission");
    }

    @ActivityCallback
    private void handleOneShotCapturePermission(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result == null || result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            call.reject("screen_capture_permission_denied");
            return;
        }

        try {
            Activity activity = getActivity();
            if (activity == null || oneShotProjectionManager == null) {
                call.reject("activity_unavailable");
                return;
            }

            MediaProjection projection = oneShotProjectionManager.getMediaProjection(result.getResultCode(), result.getData());
            if (projection == null) {
                call.reject("media_projection_start_failed");
                return;
            }

            DisplayMetrics metrics = new DisplayMetrics();
            WindowManager windowManager = (WindowManager) activity.getSystemService(Context.WINDOW_SERVICE);
            if (windowManager == null) {
                projection.stop();
                call.reject("window_manager_unavailable");
                return;
            }
            windowManager.getDefaultDisplay().getRealMetrics(metrics);

            int width = metrics.widthPixels;
            int height = metrics.heightPixels;
            int density = metrics.densityDpi;
            ImageReader reader = ImageReader.newInstance(width, height, PixelFormat.RGBA_8888, 2);
            VirtualDisplay display = projection.createVirtualDisplay(
                "MaticoOneShotCapture",
                width,
                height,
                density,
                DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
                reader.getSurface(),
                null,
                oneShotHandler
            );

            AtomicBoolean resolved = new AtomicBoolean(false);
            reader.setOnImageAvailableListener(r -> {
                if (resolved.get()) return;
                Image image = null;
                try {
                    image = r.acquireLatestImage();
                    if (image == null) return;
                    Image.Plane[] planes = image.getPlanes();
                    if (planes.length == 0) return;

                    ByteBuffer buffer = planes[0].getBuffer();
                    int pixelStride = planes[0].getPixelStride();
                    int rowStride = planes[0].getRowStride();
                    int rowPadding = rowStride - pixelStride * width;

                    Bitmap bitmap = Bitmap.createBitmap(width + (rowPadding / pixelStride), height, Bitmap.Config.ARGB_8888);
                    bitmap.copyPixelsFromBuffer(buffer);
                    Bitmap croppedBitmap = Bitmap.createBitmap(bitmap, 0, 0, width, height);

                    ByteArrayOutputStream baos = new ByteArrayOutputStream();
                    croppedBitmap.compress(Bitmap.CompressFormat.JPEG, 88, baos);
                    String base64Image = Base64.encodeToString(baos.toByteArray(), Base64.NO_WRAP);

                    JSObject ret = new JSObject();
                    ret.put("imageBase64", base64Image);
                    ret.put("imageMimeType", "image/jpeg");
                    resolved.set(true);
                    call.resolve(ret);
                } catch (Exception e) {
                    if (resolved.compareAndSet(false, true)) {
                        call.reject("screen_capture_failed", e);
                    }
                } finally {
                    if (image != null) image.close();
                    if (resolved.get()) {
                        try {
                            reader.setOnImageAvailableListener(null, null);
                            reader.close();
                            display.release();
                            projection.stop();
                        } catch (Exception ignored) {
                            // no-op
                        }
                    }
                }
            }, oneShotHandler);

            oneShotHandler.postDelayed(() -> {
                if (resolved.compareAndSet(false, true)) {
                    try {
                        reader.setOnImageAvailableListener(null, null);
                        reader.close();
                        display.release();
                        projection.stop();
                    } catch (Exception ignored) {
                        // no-op
                    }
                    call.reject("screen_capture_timeout");
                }
            }, 3500);
        } catch (Exception e) {
            call.reject("screen_capture_error", e);
        }
    }

    @PluginMethod
    public void startCaptureSession(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.LOLLIPOP) {
            call.reject("screen_capture_not_supported");
            return;
        }

        Activity activity = getActivity();
        if (activity == null) {
            call.reject("activity_unavailable");
            return;
        }

        if (!Settings.canDrawOverlays(activity)) {
            try {
                Intent intent = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:" + activity.getPackageName()));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                activity.startActivity(intent);
                call.reject("overlay_permission_required");
            } catch (Exception e) {
                call.reject("overlay_permission_required", e);
            }
            return;
        }

        MediaProjectionManager manager = (MediaProjectionManager) activity.getSystemService(Context.MEDIA_PROJECTION_SERVICE);
        if (manager == null) {
            call.reject("media_projection_unavailable");
            return;
        }

        Intent captureIntent;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            MediaProjectionConfig config = MediaProjectionConfig.createConfigForDefaultDisplay();
            captureIntent = manager.createScreenCaptureIntent(config);
        } else {
            captureIntent = manager.createScreenCaptureIntent();
        }
        startActivityForResult(call, captureIntent, "handleCaptureSessionPermission");
    }

    @ActivityCallback
    private void handleCaptureSessionPermission(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result == null || result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            call.reject("screen_capture_permission_denied");
            return;
        }

        try {
            Intent serviceIntent = new Intent(getContext(), MaticoScreenCaptureService.class);
            serviceIntent.setAction(MaticoScreenCaptureService.ACTION_START_SESSION);
            serviceIntent.putExtra(MaticoScreenCaptureService.EXTRA_RESULT_CODE, result.getResultCode());
            serviceIntent.putExtra(MaticoScreenCaptureService.EXTRA_RESULT_DATA, result.getData());

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                getContext().startForegroundService(serviceIntent);
            } else {
                getContext().startService(serviceIntent);
            }
        } catch (Throwable error) {
            Exception ex = (error instanceof Exception) ? (Exception) error : new Exception(error);
            call.reject("screen_capture_service_start_failed", ex);
            return;
        }

        try {
            Intent homeIntent = new Intent(Intent.ACTION_MAIN);
            homeIntent.addCategory(Intent.CATEGORY_HOME);
            homeIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(homeIntent);
        } catch (Exception ignored) {
            // no-op
        }

        JSObject ret = new JSObject();
        ret.put("active", true);
        ret.put("queueCount", MaticoScreenCaptureStore.queueCount());
        call.resolve(ret);
    }

    @PluginMethod
    public void stopCaptureSession(PluginCall call) {
        Intent serviceIntent = new Intent(getContext(), MaticoScreenCaptureService.class);
        serviceIntent.setAction(MaticoScreenCaptureService.ACTION_STOP_SESSION);
        getContext().startService(serviceIntent);

        JSObject ret = new JSObject();
        ret.put("active", false);
        ret.put("queueCount", MaticoScreenCaptureStore.queueCount());
        call.resolve(ret);
    }

    @PluginMethod
    public void captureNow(PluginCall call) {
        Intent serviceIntent = new Intent(getContext(), MaticoScreenCaptureService.class);
        serviceIntent.setAction(MaticoScreenCaptureService.ACTION_CAPTURE_NOW);
        getContext().startService(serviceIntent);

        JSObject ret = new JSObject();
        ret.put("queued", true);
        ret.put("queueCount", MaticoScreenCaptureStore.queueCount());
        call.resolve(ret);
    }

    @PluginMethod
    public void getCaptureSessionState(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("active", MaticoScreenCaptureStore.isActive());
        ret.put("queueCount", MaticoScreenCaptureStore.queueCount());
        call.resolve(ret);
    }

    @PluginMethod
    public void listQueuedCaptures(PluginCall call) {
        JSArray items = MaticoScreenCaptureStore.toJsArray();
        JSObject ret = new JSObject();
        ret.put("items", items);
        call.resolve(ret);
    }

    @PluginMethod
    public void clearQueuedCaptures(PluginCall call) {
        int cleared = MaticoScreenCaptureStore.clear();
        JSObject ret = new JSObject();
        ret.put("cleared", cleared);
        ret.put("queueCount", MaticoScreenCaptureStore.queueCount());
        call.resolve(ret);
    }
}
