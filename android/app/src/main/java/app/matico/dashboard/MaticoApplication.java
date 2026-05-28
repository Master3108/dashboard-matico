package app.matico.dashboard;

import android.app.Application;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.media.AudioAttributes;
import android.os.Build;

public class MaticoApplication extends Application {

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannels();
    }

    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = getSystemService(NotificationManager.class);

            // Canal principal de alarmas Matico
            NotificationChannel alarmChannel = new NotificationChannel(
                "matico-alarms",
                "Alarmas Matico",
                NotificationManager.IMPORTANCE_HIGH
            );
            alarmChannel.setDescription("Alarmas de estudio y reportes para padres y estudiantes");
            alarmChannel.enableVibration(true);
            alarmChannel.setVibrationPattern(new long[]{0, 500, 200, 500, 200, 500});
            alarmChannel.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);

            AudioAttributes audioAttributes = new AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_ALARM)
                .build();
            alarmChannel.setSound(
                android.provider.Settings.System.DEFAULT_ALARM_ALERT_URI,
                audioAttributes
            );

            manager.createNotificationChannel(alarmChannel);
        }
    }
}
