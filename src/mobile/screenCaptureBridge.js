const base64ToDataUrl = (base64 = '', mimeType = 'image/jpeg') => {
    const clean = String(base64 || '').trim();
    if (!clean) return '';
    if (clean.startsWith('data:')) return clean;
    return `data:${mimeType};base64,${clean}`;
};

export const isNativeScreenCaptureAvailable = () => {
    const cap = window?.Capacitor;
    const plugins = cap?.Plugins || {};
    const plugin = plugins?.MaticoScreenCapture;
    return Boolean(cap?.isNativePlatform?.() && plugin?.captureScreenshot);
};

export const captureNativeScreenshot = async () => {
    if (!isNativeScreenCaptureAvailable()) {
        throw new Error('native_not_available');
    }

    const plugin = window.Capacitor.Plugins.MaticoScreenCapture;
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
