// ============================================================================
// SUGERIR INSTALAR LA APP — acceso directo con el logo en la pantalla del móvil
// Android / Samsung: usa el aviso nativo del navegador (beforeinstallprompt).
// iPhone: explica cómo añadirla desde el botón Compartir de Safari.
// No se muestra si ya está instalada o si la persona lo cerró hace menos de 7 días.
// ============================================================================
(function () {
  const DISMISS_KEY = 'niskin-install-dismissed';
  const DISMISS_DAYS = 7;

  const TEXT = {
    es: {
      title: 'Instala Niskin en tu móvil',
      text: 'Ábrela con un toque desde tu pantalla de inicio, más rápida y con avisos de tus citas.',
      install: 'Instalar',
      later: 'Ahora no',
      iosText: 'Toca <b>Compartir</b> {share} y luego <b>«Añadir a pantalla de inicio»</b>.',
      inAppText: 'Abre esta página en <b>Safari</b> para poder añadirla a tu pantalla de inicio.',
      ok: 'Entendido',
      close: 'Cerrar'
    },
    en: {
      title: 'Install Niskin on your phone',
      text: 'Open it with one tap from your home screen, faster and with appointment alerts.',
      install: 'Install',
      later: 'Not now',
      iosText: 'Tap <b>Share</b> {share} and then <b>“Add to Home Screen”</b>.',
      inAppText: 'Open this page in <b>Safari</b> to add it to your home screen.',
      ok: 'Got it',
      close: 'Close'
    }
  };

  const SHARE_ICON = '<svg class="ni-share" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12"/><polyline points="8 7 12 3 16 7"/><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/></svg>';

  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isInAppBrowser = /FBAN|FBAV|Instagram|Line\/|TikTok|Snapchat/i.test(ua);
  const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const isMobile = () => window.matchMedia('(max-width: 900px)').matches || /Android|iPhone|iPad|iPod/i.test(ua);

  let deferredPrompt = null;
  let banner = null;

  const t = key => {
    const lang = (document.documentElement.lang || 'es').slice(0, 2);
    return (TEXT[lang] || TEXT.es)[key];
  };

  function storageGet(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function storageSet(key, value) {
    try { localStorage.setItem(key, value); } catch (e) {}
  }

  function recentlyDismissed() {
    const at = Number(storageGet(DISMISS_KEY) || 0);
    return at && Date.now() - at < DISMISS_DAYS * 86400000;
  }

  function hide(remember) {
    if (remember) storageSet(DISMISS_KEY, String(Date.now()));
    if (!banner) return;
    const el = banner;
    banner = null;
    el.classList.remove('visible');
    setTimeout(() => el.remove(), 300);
  }

  function show(mode) {
    if (banner || isStandalone()) return;
    const ios = mode === 'ios';
    banner = document.createElement('div');
    banner.className = 'ni-install';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-label', t('title'));
    const body = ios
      ? (isInAppBrowser ? t('inAppText') : t('iosText').replace('{share}', SHARE_ICON))
      : t('text');
    banner.innerHTML = `
      <img src="assets/icon-192.png" alt="" width="48" height="48" class="ni-install-icon">
      <div class="ni-install-copy">
        <strong>${t('title')}</strong>
        <p>${body}</p>
        <div class="ni-install-actions">
          ${ios
            ? `<button type="button" class="btn-gold btn-sm" data-act="later">${t('ok')}</button>`
            : `<button type="button" class="btn-gold btn-sm" data-act="install">${t('install')}</button>
               <button type="button" class="btn-soft btn-sm" data-act="later">${t('later')}</button>`}
        </div>
      </div>
      <button type="button" class="ni-install-close" data-act="later" aria-label="${t('close')}">×</button>
    `;
    banner.addEventListener('click', async event => {
      const act = event.target.closest('[data-act]')?.dataset.act;
      if (act === 'later') hide(true);
      if (act === 'install') await promptInstall();
    });
    document.body.appendChild(banner);
    void banner.offsetHeight; // fuerza el primer dibujo para que la entrada se anime
    banner.classList.add('visible');
  }

  async function promptInstall() {
    if (!deferredPrompt) return false;
    const promptEvent = deferredPrompt;
    deferredPrompt = null;
    promptEvent.prompt();
    const choice = await promptEvent.userChoice.catch(() => ({ outcome: 'dismissed' }));
    hide(choice.outcome !== 'accepted');
    return choice.outcome === 'accepted';
  }

  // Se espera un momento para no tapar la página apenas carga
  function scheduleShow(mode, delay) {
    if (isStandalone() || recentlyDismissed() || !isMobile()) return;
    setTimeout(() => show(mode), delay);
  }

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredPrompt = event;
    scheduleShow('native', 3500);
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    hide(true);
  });

  if (isIOS && !isStandalone()) scheduleShow('ios', 4000);

  // El service worker hace que el navegador ofrezca la instalación y permite abrir sin conexión
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      const reg = window.NiskinPush ? window.NiskinPush.getRegistration() : navigator.serviceWorker.register('sw.js');
      Promise.resolve(reg).catch(() => {});
    });
  }

  // Para mostrar un botón "Instalar app" en otras partes
  window.NiskinInstall = {
    canPrompt: () => Boolean(deferredPrompt),
    isInstalled: isStandalone,
    isIOS: () => isIOS,
    prompt: promptInstall,
    show: () => show(deferredPrompt ? 'native' : 'ios')
  };
})();
