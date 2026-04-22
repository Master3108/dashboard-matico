const base64ToDataUrl = (base64 = '', mimeType = 'image/jpeg') => {
    const clean = String(base64 || '').trim();
    if (!clean) return '';
    if (clean.startsWith('data:')) return clean;
    return `data:${mimeType};base64,${clean}`;
};

const getPlugin = () => {
    const cap = window?.Capacitor;
    const plugins = cap?.Plugins || {};
    return plugins?.MaticoScreenCapture || null;
};

export const isNativeScreenCaptureAvailable = () => {
    const cap = window?.Capacitor;
    const plugin = getPlugin();
    return Boolean(cap?.isNativePlatform?.() && plugin?.captureScreenshot);
};

// Retries detection for a few seconds. Capacitor plugins can register after
// React mounts, so the first synchronous check often fails in native builds.
// Resolves to true as soon as the plugin appears, false if timeout elapses.
export const waitForNativeScreenCapture = (timeoutMs = 4000, stepMs = 200) => {
    return new Promise((resolve) => {
        if (isNativeScreenCaptureAvailable()) {
            resolve(true);
            return;
        }
        const started = Date.now();
        const interval = setInterval(() => {
            if (isNativeScreenCaptureAvailable()) {
                clearInterval(interval);
                resolve(true);
                return;
            }
            if (Date.now() - started >= timeoutMs) {
                clearInterval(interval);
                resolve(false);
            }
        }, stepMs);
    });
};

// True whenever the app runs inside the Android APK shell (Capacitor),
// regardless of whether the native plugin finished registering yet.
// Used to decide if we show the "requires app" hint vs. hide completely.
export const isRunningInNativeApp = () => {
    const cap = window?.Capacitor;
    return Boolean(cap?.isNativePlatform?.());
};

export const captureNativeScreenshot = async () => {
    if (!isNativeScreenCaptureAvailable()) {
        throw new Error('native_not_available');
    }

    const plugin = getPlugin();
    const result = await plugin.captureScreenshot();
    const imageBase64 = String(result?.imageBase64 || result?.base64 || '').trim();
    const imageMimeType = String(result?.imageMimeType || result?.mimeType || 'image/jpeg').trim() || 'image/jpeg';
    const dataUrl = base64ToDataUrl(imageBase64, imageMimeType);

    if (!imageBase64 || !dataUrl) {
        throw new Error('native_capture_empty');
    }

    return {
        imageBase64,
        imageMimeType,
        dataUrl
    };
};

export const startNativeCaptureSession = async () => {
    const plugin = getPlugin();
    if (!plugin?.startCaptureSession) throw new Error('native_not_available');
    return plugin.startCaptureSession();
};

export const stopNativeCaptureSession = async () => {
    const plugin = getPlugin();
    if (!plugin?.stopCaptureSession) throw new Error('native_not_available');
    return plugin.stopCaptureSession();
};

export const getNativeCaptureSessionState = async () => {
    const plugin = getPlugin();
    if (!plugin?.getCaptureSessionState) return { active: false, queueCount: 0 };
    return plugin.getCaptureSessionState();
};

export const captureNowNativeSession = async () => {
    const plugin = getPlugin();
    if (!plugin?.captureNow) throw new Error('native_not_available');
    const state = await getNativeCaptureSessionState();
    if (!state?.active) throw new Error('session_not_active');
    return plugin.captureNow();
};

export const listNativeQueuedCaptures = async () => {
    const plugin = getPlugin();
    if (!plugin?.listQueuedCaptures) return { items: [] };
    return plugin.listQueuedCaptures();
};

export const clearNativeQueuedCaptures = async () => {
    const plugin = getPlugin();
    if (!plugin?.clearQueuedCaptures) return { cleared: 0 };
    return plugin.clearQueuedCaptures();
};

// Se dispara cuando el usuario toca "Finalizar" en el overlay del celular.
// Retorna una funcion unsubscribe (o null si no hay plugin nativo).
export const onNativeCaptureSessionFinalized = (callback) => {
    const plugin = getPlugin();
    if (!plugin?.addListener || typeof callback !== 'function') return null;

    let handlePromise;
    try {
        // En Capacitor, addListener puede devolver un handle o una promesa de handle.
        handlePromise = Promise.resolve(plugin.addListener('captureSessionFinalized', (payload) => {
            try { callback(payload || {}); } catch { /* no-op */ }
        }));
    } catch {
        return null;
    }

    let disposed = false;
    return () => {
        if (disposed) return;
        disposed = true;
        handlePromise.then((handle) => {
            try { handle?.remove?.(); } catch { /* no-op */ }
        }).catch(() => { /* no-op */ });
    };
};
