// ============================================================================
// NOTIFICACIONES PUSH — utilidades compartidas por el panel y la página de clientas
// ============================================================================
(function () {
  function urlBase64ToUint8Array(base64) {
    const padding = '='.repeat((4 - (base64.length % 4)) % 4);
    const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(raw, c => c.charCodeAt(0));
  }

  const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const isSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

  let registrationPromise = null;
  function getRegistration() {
    if (!('serviceWorker' in navigator)) return Promise.resolve(null);
    if (!registrationPromise) {
      registrationPromise = navigator.serviceWorker.register('sw.js').catch(err => {
        console.warn('No se pudo registrar el service worker:', err);
        return null;
      });
    }
    return registrationPromise;
  }

  async function currentSubscription() {
    if (!isSupported()) return null;
    const reg = await getRegistration();
    return reg ? reg.pushManager.getSubscription() : null;
  }

  // Estado para mostrar en pantalla: 'unsupported' | 'ios-install' | 'denied' | 'enabled' | 'available'
  async function status() {
    if (isIOS() && !isStandalone()) return 'ios-install';
    if (!isSupported()) return 'unsupported';
    if (Notification.permission === 'denied') return 'denied';
    const sub = await currentSubscription();
    return sub && Notification.permission === 'granted' ? 'enabled' : 'available';
  }

  // Debe llamarse desde un toque/clic de la usuaria (requisito de Safari y Chrome)
  async function enable({ apiBase, subscribePath, headers }) {
    if (isIOS() && !isStandalone()) {
      throw new Error('En iPhone primero añade la app a tu pantalla de inicio (Compartir → Añadir a inicio) y ábrela desde ahí.');
    }
    if (!isSupported()) throw new Error('Este navegador no permite notificaciones.');

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      throw new Error('No diste permiso para las notificaciones. Puedes activarlo en los ajustes del navegador.');
    }

    const keyRes = await fetch(`${apiBase}/api/push/public-key`, { cache: 'no-store' });
    const keyData = await keyRes.json().catch(() => ({}));
    if (!keyRes.ok || !keyData.publicKey) throw new Error(keyData.message || 'Las notificaciones aún no están disponibles.');

    const reg = await getRegistration();
    if (!reg) throw new Error('No se pudo preparar el servicio de notificaciones.');
    await navigator.serviceWorker.ready;

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(keyData.publicKey)
      });
    }

    const res = await fetch(`${apiBase}${subscribePath}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ subscription: sub.toJSON() })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || 'No se pudo activar las notificaciones.');
    }
    return true;
  }

  async function disable({ apiBase }) {
    const sub = await currentSubscription();
    if (!sub) return;
    const endpoint = sub.endpoint;
    await sub.unsubscribe().catch(() => {});
    await fetch(`${apiBase}/api/push/unsubscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint })
    }).catch(() => {});
  }

  window.NiskinPush = { isIOS, isStandalone, isSupported, getRegistration, currentSubscription, status, enable, disable };

  // Registrar el service worker temprano para que esté listo cuando la usuaria active las notificaciones
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => getRegistration());
  }
})();

// ============================================================================
// WHATSAPP (wa.me) — compartido
// ============================================================================
window.NiskinWhatsApp = {
  // Números dominicanos de 10 dígitos (809/829/849) se convierten al formato internacional 1XXXXXXXXXX
  normalizePhone(phone) {
    const digits = String(phone || '').replace(/\D/g, '');
    if (digits.length === 10 && /^(809|829|849)/.test(digits)) return `1${digits}`;
    return digits;
  },
  // Se usa api.whatsapp.com/send en vez de wa.me: la redirección de wa.me daña en Android
  // algunos caracteres especiales (aparecen como �). Los mensajes además evitan emojis.
  link(phone, message) {
    const number = this.normalizePhone(phone);
    const params = new URLSearchParams();
    if (number) params.set('phone', number);
    params.set('text', message || '');
    return `https://api.whatsapp.com/send?${params.toString().replace(/\+/g, '%20')}`;
  },
  open(phone, message) {
    window.open(this.link(phone, message), '_blank', 'noopener');
  }
};
