window.NetworkConfig = {
    SERVER_URL: (function () {
        try {
            if (window.AndroidBridge && typeof window.AndroidBridge.getServerUrl === 'function') {
                const nativeUrl = window.AndroidBridge.getServerUrl();
                if (nativeUrl) return nativeUrl;
            }
        } catch (e) {}
        try {
            const saved = localStorage.getItem('ARENA_WHEELS_SERVER_URL');
            if (saved) return saved;
            if (window.location && window.location.protocol && window.location.protocol.startsWith('http')) {
                return window.location.origin;
            }
        } catch (e) {}
        return 'https://gsme1.onrender.com';
    })(),

    updateServerUrl: function (newUrl) {
        if (!newUrl) return;
        const cleanUrl = newUrl.trim();
        this.SERVER_URL = cleanUrl;
        try {
            localStorage.setItem('ARENA_WHEELS_SERVER_URL', cleanUrl);
            if (window.AndroidBridge && typeof window.AndroidBridge.setServerUrl === 'function') {
                window.AndroidBridge.setServerUrl(cleanUrl);
            }
        } catch (e) {}
    },

    triggerHaptic: function (durationMs, amplitude) {
        try {
            if (window.AndroidBridge && typeof window.AndroidBridge.vibrate === 'function') {
                window.AndroidBridge.vibrate(durationMs || 60, amplitude || 180);
            } else if (navigator.vibrate) {
                navigator.vibrate(durationMs || 60);
            }
        } catch (e) {}
    }
};
