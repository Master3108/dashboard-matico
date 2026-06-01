/**
 * NativeAlarmBridge.js — Bridge entre AlarmService y Capacitor LocalNotifications
 *
 * Detecta si corre en Capacitor (Android APK) y usa notificaciones nativas
 * que funcionan con la app cerrada. En web, no hace nada (AlarmService usa setInterval).
 */

let LocalNotifications = null;
let isNative = false;

/**
 * Inicializa el bridge. Debe llamarse una vez al arranque.
 * @returns {boolean} true si estamos en entorno nativo
 */
export async function initNativeAlarms() {
    try {
        // Detectar Capacitor
        if (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNativePlatform()) {
            const mod = await import('@capacitor/local-notifications');
            LocalNotifications = mod.LocalNotifications;

            // Pedir permiso de notificaciones
            const permResult = await LocalNotifications.requestPermissions();
            if (permResult.display === 'granted') {
                isNative = true;
                console.log('[NativeAlarmBridge] Native notifications enabled');
            } else {
                console.warn('[NativeAlarmBridge] Notification permission denied');
                isNative = false;
            }
        }
    } catch (err) {
        console.warn('[NativeAlarmBridge] Not available (web mode):', err.message);
        isNative = false;
    }
    return isNative;
}

/**
 * @returns {boolean} Si estamos en modo nativo
 */
export function isNativeMode() {
    return isNative;
}

/**
 * Programa alarmas nativas RECURRENTES (semanales) basado en la configuración.
 *
 * Usa schedule repetitivo del plugin (schedule.on + repeats), una notificación
 * por cada día activo de cada alarma. Así suenan todas las semanas sin depender
 * de que el usuario abra la app, y sobreviven reinicios del teléfono.
 *
 * @param {Array} alarms - Array de alarm configs del API
 */
// Capacitor LocalNotifications usa weekday 1=domingo ... 7=sábado
const WEEKDAY_MAP = { dom: 1, lun: 2, mar: 3, mie: 4, jue: 5, vie: 6, sab: 7 };

export async function scheduleNativeAlarms(alarms) {
    if (!isNative || !LocalNotifications) return;

    // Cancelar todas las notificaciones pendientes primero (evita duplicados al re-programar)
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length > 0) {
        await LocalNotifications.cancel({ notifications: pending.notifications });
    }

    const notifications = [];
    let notifId = 1;

    for (const alarm of alarms) {
        if (!alarm.enabled) continue;

        const daysActive = typeof alarm.days_active === 'string'
            ? JSON.parse(alarm.days_active)
            : alarm.days_active || ['lun', 'mar', 'mie', 'jue', 'vie'];

        // Una notificación recurrente por cada día activo
        for (const dayKey of daysActive) {
            const weekday = WEEKDAY_MAP[dayKey];
            if (!weekday) continue;

            notifications.push(buildNotification(notifId++, alarm, {
                on: { weekday, hour: alarm.hour, minute: alarm.minute },
                repeats: true,
                allowWhileIdle: true,
            }));
        }
    }

    if (notifications.length > 0) {
        await LocalNotifications.schedule({ notifications });
        console.log(`[NativeAlarmBridge] Scheduled ${notifications.length} recurring native alarms`);
    }
}

/**
 * Programa un snooze nativo (5 min)
 */
export async function scheduleNativeSnooze(alarm, minutes = 5) {
    if (!isNative || !LocalNotifications) return;

    const snoozeAt = new Date(Date.now() + minutes * 60 * 1000);

    await LocalNotifications.schedule({
        notifications: [buildNotification(9000 + Math.floor(Math.random() * 1000), alarm, {
            at: snoozeAt,
            allowWhileIdle: true,
        })]
    });

    console.log(`[NativeAlarmBridge] Snooze scheduled for ${minutes}min`);
}

/**
 * Registra listener para cuando el usuario toca la notificación
 * @param {Function} callback - (alarmData) => void
 */
export async function onNotificationTapped(callback) {
    if (!isNative || !LocalNotifications) return;

    await LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
        const extra = action.notification?.extra;
        if (extra) {
            callback(extra);
        }
    });

    // También cuando la notificación se recibe con app abierta
    await LocalNotifications.addListener('localNotificationReceived', (notification) => {
        const extra = notification?.extra;
        if (extra) {
            callback(extra);
        }
    });
}

// =====================================================================
// Helpers internos
// =====================================================================

const ALARM_TITLES = {
    parent_alert: 'Alerta para Mamá',
    student_reminder: 'Hora de estudiar',
    parent_report: 'Reporte del día',
};

const ALARM_BODIES = {
    parent_alert: 'Revisa las materias y eventos pendientes de tu hijo',
    student_reminder: 'Tienes materias pendientes por estudiar hoy',
    parent_report: 'Mira el resumen de actividades de hoy',
};

function buildNotification(id, alarm, schedule) {
    return {
        id,
        title: ALARM_TITLES[alarm.alarm_type] || 'Alarma Matico',
        body: ALARM_BODIES[alarm.alarm_type] || 'Tienes una alarma pendiente',
        schedule,
        sound: 'default',
        channelId: 'matico-alarms',
        extra: {
            alarm_id: alarm.alarm_id,
            alarm_type: alarm.alarm_type,
            student_user_id: alarm.student_user_id,
            user_id: alarm.user_id,
            sound: alarm.sound,
            stale_threshold_days: alarm.stale_threshold_days,
        },
        // Android específico
        smallIcon: 'ic_launcher',
        iconColor: alarm.alarm_type === 'parent_alert' ? '#EF4444'
            : alarm.alarm_type === 'student_reminder' ? '#3B82F6'
            : '#8B5CF6',
        autoCancel: true,
    };
}
