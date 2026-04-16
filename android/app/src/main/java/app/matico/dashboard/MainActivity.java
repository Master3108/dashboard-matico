package app.matico.dashboard;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;

import java.util.ArrayList;
import java.util.List;

public class MainActivity extends BridgeActivity {

    private static final int PERMISSION_REQUEST_CODE = 1001;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(MaticoScreenCapturePlugin.class);
        super.onCreate(savedInstanceState);
        requestAppPermissions();
        enableWebViewCameraAccess();
    }

    /**
     * Solicita todos los permisos necesarios al arrancar la app.
     * Así el usuario los aprueba desde el inicio, antes de que la web los necesite.
     */
    private void requestAppPermissions() {
        List<String> permissions = new ArrayList<>();
        String[] required = {
            Manifest.permission.CAMERA,
            Manifest.permission.RECORD_AUDIO,
            Manifest.permission.MODIFY_AUDIO_SETTINGS,
        };

        // Android 13+ usa permisos granulares de medios
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissions.add(Manifest.permission.READ_MEDIA_IMAGES);
            permissions.add(Manifest.permission.READ_MEDIA_VIDEO);
        } else if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.S_V2) {
            permissions.add(Manifest.permission.READ_EXTERNAL_STORAGE);
        }

        for (String perm : required) {
            permissions.add(perm);
        }

        List<String> toRequest = new ArrayList<>();
        for (String perm : permissions) {
            if (ContextCompat.checkSelfPermission(this, perm) != PackageManager.PERMISSION_GRANTED) {
                toRequest.add(perm);
            }
        }

        if (!toRequest.isEmpty()) {
            ActivityCompat.requestPermissions(this, toRequest.toArray(new String[0]), PERMISSION_REQUEST_CODE);
        }
    }

    /**
     * Configura el WebView para que cuando la app web (la página web de Matico)
     * solicite acceso a cámara/micrófono vía getUserMedia, Android lo apruebe
     * automáticamente (ya pedimos el permiso nativo arriba).
     */
    private void enableWebViewCameraAccess() {
        try {
            WebView webView = getBridge().getWebView();
            if (webView == null) return;
            webView.getSettings().setMediaPlaybackRequiresUserGesture(false);
            webView.setWebChromeClient(new WebChromeClient() {
                @Override
                public void onPermissionRequest(PermissionRequest request) {
                    // Aprueba cámara y micrófono para la app web
                    request.grant(request.getResources());
                }
            });
        } catch (Exception ignored) {
            // Si falla, Capacitor usa su propio WebChromeClient como fallback
        }
    }
}
