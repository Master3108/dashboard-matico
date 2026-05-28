/**
 * AlarmService.js — Servicio de alarmas inteligentes Matico
 *
 * Programa las alarmas configuradas del usuario y las dispara a la hora indicada.
 * Al disparar, consulta el endpoint /api/alarms/digest para obtener datos frescos.
 *
 * En Android (Capacitor): usa LocalNotifications nativas (funciona con app cerrada).
 * En Web: usa setInterval cada 30s para chequear la hora.
 *
 * Uso:
 *   import { getAlarmService } from '../services/AlarmService';
 *   const alarmService = getAlarmService();
 *   alarmService.start(userId, onAlarmFired);
 *   // cleanup:
 *   alarmService.stop();
 */
import { authFetch } from '../utils/authFetch.js';
import {
    initNativeAlarms,
    isNativeMode,
    scheduleNativeAlarms,
    scheduleNativeSnooze,
    onNotificationTapped,
} from './NativeAlarmBridge.js';

const CHECK_INTERVAL_MS = 30 * 1000; // Revisar cada 30 segundos

class AlarmService {
    constructor() {
        this._timerId = null;
        this._userId = null;
        this._onAlarmFired = null;
        this._alarms = [];
        this._firedToday = new Set(); // alarm_ids ya disparados hoy
        this._snoozedUntil = {};      // alarm_id -> timestamp hasta cuando pospuesto
        this._lastDateStr = '';        // para resetear firedToday al cambiar de día
        this._running = false;
        this._nativeMode = false;
    }

    /**
     * Inicia el servicio de alarmas
     * @param {string} userId - ID del usuario actual
     * @param {Function} onAlarmFired - callback(digest, alarmConfig) cuando suena
     */
    async start(userId, onAlarmFired) {
        this._userId = userId;
        this._onAlarmFired = onAlarmFired;
        this._running = true;
        this._lastDateStr = new Date().toISOString().split('T')[0];

        // Intentar modo nativo (Android APK)
        this._nativeMode = await initNativeAlarms();

        // Cargar configuración inicial
        await this._loadAlarms();

        if (this._nativeMode) {
            // Android: programar alarmas nativas + listener
            await scheduleNativeAlarms(this._alarms);
            await onNotificationTapped((alarmData) => this._handleNativeAlarm(alarmData));
            console.log('[AlarmService] Started NATIVE mode for user', userId, 'with', this._alarms.length, 'alarms');
        } else {
            // Web: usar setInterval
            this._timerId = setInterval(() => this._tick(), CHECK_INTERVAL_MS);
            this._tick();
            console.log('[AlarmService] Started WEB mode for user', userId, 'with', this._alarms.length, 'alarms');
        }
    }

    stop() {
        this._running = false;
        if (this._timerId) {
            clearInterval(this._timerId);
            this._timerId = null;
        }
        console.log('[AlarmService] Stopped');
    }

    /** Recargar alarmas (llamar después de cambiar configuración) */
    async reload() {
        await this._loadAlarms();
        // Re-programar nativas si aplica
        if (this._nativeMode) {
            await scheduleNativeAlarms(this._alarms);
        }
    }

    /** Posponer una alarma específica */
    snooze(alarmId, minutes = 5) {
        this._snoozedUntil[alarmId] = Date.now() + (minutes * 60 * 1000);
        this._firedToday.delete(alarmId);

        // Si nativo, programar snooze nativo
        if (this._nativeMode) {
            const alarm = this._alarms.find(a => a.alarm_id === alarmId);
            if (alarm) scheduleNativeSnooze(alarm, minutes);
        }

        console.log(`[AlarmService] Snoozed ${alarmId} for ${minutes}min`);
    }

    // =====================================================================
    // Internals
    // =====================================================================

    async _loadAlarms() {
        try {
            const res = await authFetch(`/api/alarms/config?user_id=${this._userId}`);
            const data = await res.json();
            if (data.success) {
                this._alarms = data.alarms || [];
            }
        } catch (err) {
            console.error('[AlarmService] Error loading alarms:', err);
        }
    }

    /**
     * Handler para cuando llega una notificación nativa (Android)
     * Busca el digest fresco del server y dispara el callback
     */
    async _handleNativeAlarm(alarmData) {
        if (!this._running) return;

        const { alarm_id, alarm_type, student_user_id, stale_threshold_days } = alarmData;
        console.log(`[AlarmService] Native alarm received: ${alarm_type}`);

        // Buscar la config completa
        const alarm = this._alarms.find(a => a.alarm_id === alarm_id) || {
            ...alarmData,
            alarm_id,
            alarm_type,
            student_user_id,
        };

        await this._fireAlarm(alarm);
    }

    _tick() {
        if (!this._running) return;

        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];

        // Resetear al cambiar de día
        if (todayStr !== this._lastDateStr) {
            this._firedToday.clear();
            this._snoozedUntil = {};
            this._lastDateStr = todayStr;
            this._loadAlarms();
        }

        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const dayNames = ['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab'];
        const todayDay = dayNames[now.getDay()];

        for (const alarm of this._alarms) {
            if (!alarm.enabled) continue;
            if (this._firedToday.has(alarm.alarm_id)) continue;
            if (this._snoozedUntil[alarm.alarm_id] && Date.now() < this._snoozedUntil[alarm.alarm_id]) continue;

            const daysActive = typeof alarm.days_active === 'string'
                ? JSON.parse(alarm.days_active)
                : alarm.days_active || ['lun', 'mar', 'mie', 'jue', 'vie'];
            if (!daysActive.includes(todayDay)) continue;

            // Hora correcta?
            if (currentHour === alarm.hour && currentMinute === alarm.minute) {
                this._fireAlarm(alarm);
            }

            // Si fue snoozed y ya pasó el snooze time
            if (this._snoozedUntil[alarm.alarm_id] && Date.now() >= this._snoozedUntil[alarm.alarm_id]) {
                delete this._snoozedUntil[alarm.alarm_id];
                this._fireAlarm(alarm);
            }
        }
    }

    async _fireAlarm(alarm) {
        this._firedToday.add(alarm.alarm_id);

        console.log(`[AlarmService] Firing alarm: ${alarm.alarm_type} for student ${alarm.student_user_id}`);

        try {
            const res = await authFetch(
                `/api/alarms/digest?alarm_type=${alarm.alarm_type}&student_user_id=${alarm.student_user_id}&stale_threshold_days=${alarm.stale_threshold_days || 3}`
            );
            const data = await res.json();

            if (data.success && data.digest) {
                // Registrar en historial
                try {
                    await authFetch('/api/alarms/fired', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            alarm_id: alarm.alarm_id,
                            user_id: alarm.user_id,
                            alarm_type: alarm.alarm_type,
                            digest_data: data.digest,
                        }),
                    });
                } catch (e) {
                    console.warn('[AlarmService] Could not record alarm fired:', e);
                }

                // Disparar callback
                if (this._onAlarmFired) {
                    this._onAlarmFired(data.digest, alarm);
                }
            }
        } catch (err) {
            console.error('[AlarmService] Error firing alarm:', err);
        }
    }
}

// Singleton
let _instance = null;
export function getAlarmService() {
    if (!_instance) _instance = new AlarmService();
    return _instance;
}

export default AlarmService;
