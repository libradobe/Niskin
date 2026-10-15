// ============================================================================
// AVISO DE MODO OSCURO FORZADO (Samsung Internet)
// Chrome y Safari respetan <meta name="color-scheme" content="only light">, pero
// Samsung Internet oscurece cualquier página cuando su "Modo oscuro" está activo y
// no ofrece a los sitios una forma de desactivarlo. Aquí avisamos a la usuaria
// y le explicamos cómo ver los colores reales de Niskin.
// ============================================================================
(function () {
  var DISMISS_KEY = 'niskin_dark_notice_dismissed';
  var isSamsung = /SamsungBrowser/i.test(navigator.userAgent || '');
  var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (!isSamsung || !prefersDark) return;

  try {
    if (localStorage.getItem(DISMISS_KEY) === '1') return;
  } catch (e) {}

  function show() {
    var box = document.createElement('div');
    box.className = 'dark-notice';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', 'Colores de la app');
    box.innerHTML =
      '<strong>¿Ves la app oscura?</strong>' +
      '<p>Es el modo oscuro de Samsung Internet, que cambia los colores de las páginas. Para ver los colores reales de Niskin:</p>' +
      '<ol>' +
      '<li>Toca el menú <b>⋮</b> (abajo a la derecha) y apaga <b>Modo oscuro</b>, o</li>' +
      '<li>Ve a <b>⋮ → Configuración → Labs</b> y activa <b>Usar tema oscuro del sitio web</b> (así mantienes el modo oscuro en otras páginas).</li>' +
      '</ol>' +
      '<button type="button">Entendido</button>';
    box.querySelector('button').addEventListener('click', function () {
      try { localStorage.setItem(DISMISS_KEY, '1'); } catch (e) {}
      box.remove();
    });
    document.body.appendChild(box);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', show);
  } else {
    show();
  }
})();
