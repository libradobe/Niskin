// ============================================================================
// PÁGINA DE INICIO PÚBLICA — completa el contenido con los datos reales del estudio
// (Configuración, Tratamientos y Especialistas). Si el servidor tarda, la página ya
// muestra su contenido base y el botón de reservar funciona igual.
// ============================================================================
(function () {
  const RENDER_URL_STORAGE_KEY = 'niskin_render_backend_url';
  const STUDIO_TIMEZONE = 'America/Santo_Domingo';

  const I18N = {
    es: {
      skip: 'Saltar al contenido', navTreatments: 'Tratamientos', navHow: 'Cómo funciona', navTeam: 'Equipo', navContact: 'Contacto',
      ctaShort: 'Reservar cita', ctaBook: 'Reservar una cita', ctaSeeTreatments: 'Ver tratamientos',
      leadDefault: 'Tratamientos faciales con evaluación profesional de tu piel, un plan hecho para ti y seguimiento de tu progreso en cada visita.',
      trust1: 'Reserva en línea en minutos', trust2: 'Confirmación por WhatsApp', trust3: 'Expediente y seguimiento de tu piel', trust4: 'Tus datos son privados',
      todayLabel: 'Hoy', openNow: 'Abierto ahora', closedNow: 'Cerrado ahora', closedToday: 'Hoy no abrimos', opensLater: 'Abre más tarde',
      hoursToday: '{start} – {end}', nextOpen: 'Próxima apertura: {day} {start}',
      miniStep1: 'Elige tu tratamiento', miniStep2: 'Escoge día y hora', miniStep3: 'Confirma tu reserva',
      treatmentsEyebrow: 'Tratamientos', treatmentsTitle: 'Protocolos para cada necesidad de tu piel',
      treatmentsText: 'Cada sesión empieza con una evaluación y se adapta a lo que tu piel necesita ese día.',
      book: 'Reservar', minutes: '{n} min', depositNote: 'Depósito al reservar: {amount}', payAtEnd: 'Pagas al finalizar',
      treatmentsError: 'No pudimos cargar los tratamientos ahora mismo. Puedes verlos todos al reservar.',
      paymentRequire: 'Para asegurar tu espacio se pide un depósito al reservar; el resto se paga al finalizar tu sesión.',
      paymentNone: 'No necesitas depósito: tu cita queda confirmada y pagas al finalizar tu sesión.',
      howEyebrow: 'Cómo funciona', howTitle: 'Reserva en tres pasos',
      step1Title: 'Crea tu cuenta', step1Text: 'Solo tu nombre, teléfono y correo. Así guardamos tus citas y tu expediente.',
      step2Title: 'Elige tratamiento, día y hora', step2Text: 'Ves los horarios libres en tiempo real; los ocupados aparecen tachados.',
      step3Title: 'Recibe la confirmación', step3Text: 'Te confirmamos por WhatsApp y, si lo activas, te enviamos un recordatorio antes de tu cita.',
      teamEyebrow: 'Nuestro equipo', teamTitle: 'Especialistas en el cuidado de tu piel',
      promise1Title: 'Evaluación antes de cada tratamiento', promise1Text: 'Revisamos tu piel, alergias y objetivos para recomendarte el protocolo adecuado.',
      promise2Title: 'Seguimiento de tu progreso', promise2Text: 'Registramos cada sesión y la evolución de tu piel. Puedes verla desde tu cuenta.',
      promise3Title: 'Pagos claros', promise3Text: 'Conoces el precio antes de reservar y te explicamos cómo y cuándo se paga.',
      promise4Title: 'Privacidad', promise4Text: 'Tu información solo la ve el equipo del estudio. Nunca la compartimos.',
      policy: 'Política de cancelación: {text}',
      contactEyebrow: 'Visítanos', contactTitle: 'Dónde estamos', whatsapp: 'Escríbenos por WhatsApp', maps: 'Cómo llegar',
      waMessage: 'Hola, quisiera información sobre sus tratamientos.',
      hoursTitle: 'Horario', hoursLoading: 'Cargando horario…', closed: 'Cerrado', hoursUnavailable: 'Consulta el horario al reservar.',
      finalTitle: '¿Lista para empezar a cuidar tu piel?', finalText: 'Elige tu tratamiento y el horario que mejor te quede. Toma menos de dos minutos.',
      myAppointments: 'Mis citas', staffAccess: 'Acceso del equipo',
      days: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
    },
    en: {
      skip: 'Skip to content', navTreatments: 'Treatments', navHow: 'How it works', navTeam: 'Team', navContact: 'Contact',
      ctaShort: 'Book now', ctaBook: 'Book an appointment', ctaSeeTreatments: 'See treatments',
      leadDefault: 'Facial treatments with a professional skin assessment, a plan made for you and progress tracking at every visit.',
      trust1: 'Book online in minutes', trust2: 'Confirmation on WhatsApp', trust3: 'Skin record and progress tracking', trust4: 'Your data stays private',
      todayLabel: 'Today', openNow: 'Open now', closedNow: 'Closed now', closedToday: 'Closed today', opensLater: 'Opens later today',
      hoursToday: '{start} – {end}', nextOpen: 'Next opening: {day} {start}',
      miniStep1: 'Choose your treatment', miniStep2: 'Pick a day and time', miniStep3: 'Confirm your booking',
      treatmentsEyebrow: 'Treatments', treatmentsTitle: 'Protocols for every skin need',
      treatmentsText: 'Every session starts with an assessment and adapts to what your skin needs that day.',
      book: 'Book', minutes: '{n} min', depositNote: 'Deposit to book: {amount}', payAtEnd: 'Pay after your session',
      treatmentsError: 'We could not load the treatments right now. You can see all of them when booking.',
      paymentRequire: 'A deposit holds your spot when you book; the balance is paid after your session.',
      paymentNone: 'No deposit needed: your appointment is confirmed and you pay after your session.',
      howEyebrow: 'How it works', howTitle: 'Book in three steps',
      step1Title: 'Create your account', step1Text: 'Just your name, phone and email, so we can keep your appointments and skin record.',
      step2Title: 'Choose treatment, day and time', step2Text: 'See free times in real time; booked times are crossed out.',
      step3Title: 'Get your confirmation', step3Text: 'We confirm on WhatsApp and, if you turn it on, send a reminder before your visit.',
      teamEyebrow: 'Our team', teamTitle: 'Skin-care specialists',
      promise1Title: 'Assessment before every treatment', promise1Text: 'We check your skin, allergies and goals to recommend the right protocol.',
      promise2Title: 'Progress tracking', promise2Text: 'We record every session and how your skin evolves. You can see it from your account.',
      promise3Title: 'Clear payments', promise3Text: 'You know the price before booking and we explain how and when to pay.',
      promise4Title: 'Privacy', promise4Text: 'Only the studio team can see your information. We never share it.',
      policy: 'Cancellation policy: {text}',
      contactEyebrow: 'Visit us', contactTitle: 'Where to find us', whatsapp: 'Message us on WhatsApp', maps: 'Get directions',
      waMessage: 'Hi, I would like information about your treatments.',
      hoursTitle: 'Opening hours', hoursLoading: 'Loading hours…', closed: 'Closed', hoursUnavailable: 'Check our hours when booking.',
      finalTitle: 'Ready to start caring for your skin?', finalText: 'Choose your treatment and the time that suits you. It takes less than two minutes.',
      myAppointments: 'My appointments', staffAccess: 'Team access',
      days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    }
  };

  const CURRENCY_SYMBOLS = {
    DOP: ['RD$', 0], USD: ['US$', 2], EUR: ['€', 2], MXN: ['MX$', 2], COP: ['COL$', 0],
    PEN: ['S/', 2], CLP: ['CLP$', 0], ARS: ['AR$', 0], GTQ: ['Q', 2], CRC: ['₡', 0]
  };

  let lang = 'es';
  let settings = {};

  const t = (key, vars = {}) => String(I18N[lang][key] ?? I18N.es[key] ?? key)
    .replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? vars[k] : ''));
  const dayName = d => (I18N[lang].days || I18N.es.days)[d];
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function apiBase() {
    let saved = null;
    try { saved = localStorage.getItem(RENDER_URL_STORAGE_KEY); } catch (e) {}
    return String(saved !== null ? saved : (window.NISKIN_RENDER_URL || '')).trim().replace(/\/+$/, '');
  }

  function money(amount) {
    const [symbol, decimals] = CURRENCY_SYMBOLS[settings.currency] || CURRENCY_SYMBOLS.DOP;
    return `${symbol} ${Number(amount || 0).toLocaleString(lang === 'en' ? 'en-US' : 'es-DO', { maximumFractionDigits: decimals })}`;
  }

  function formatTime(hhmm) {
    const [h, m] = String(hhmm || '0:0').split(':').map(Number);
    return new Date(2000, 0, 1, h, m).toLocaleTimeString(lang === 'en' ? 'en-US' : 'es-DO', { hour: 'numeric', minute: '2-digit' });
  }

  function applyStaticTranslations() {
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  }

  function whatsappLink(phone, text) {
    let digits = String(phone || '').replace(/\D/g, '');
    if (digits.length === 10 && /^(809|829|849)/.test(digits)) digits = `1${digits}`;
    const params = new URLSearchParams();
    if (digits) params.set('phone', digits);
    params.set('text', text);
    return `https://api.whatsapp.com/send?${params.toString().replace(/\+/g, '%20')}`;
  }

  // Hora actual en República Dominicana (para "Abierto ahora")
  function nowInStudio() {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: STUDIO_TIMEZONE, weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false
    }).formatToParts(new Date());
    const get = type => parts.find(p => p.type === type)?.value;
    const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
    return { weekday, minutes: (Number(get('hour')) % 24) * 60 + Number(get('minute')) };
  }

  const toMinutes = hhmm => {
    const [h, m] = String(hhmm || '').split(':').map(Number);
    return h * 60 + m;
  };

  function renderHours(weekly) {
    const list = $('lpHours');
    if (!Array.isArray(weekly) || weekly.length !== 7) {
      list.innerHTML = `<li>${esc(t('hoursUnavailable'))}</li>`;
      return;
    }
    const { weekday, minutes } = nowInStudio();
    list.innerHTML = [1, 2, 3, 4, 5, 6, 0].map(d => {
      const day = weekly.find(w => w.day === d) || {};
      return `
        <li class="${d === weekday ? 'is-today' : ''}">
          <span>${esc(dayName(d))}</span>
          <span>${day.open ? `${esc(formatTime(day.start))} – ${esc(formatTime(day.end))}` : esc(t('closed'))}</span>
        </li>
      `;
    }).join('');

    // Tarjeta "Hoy"
    const today = weekly.find(w => w.day === weekday);
    const status = $('lpTodayStatus');
    const hours = $('lpTodayHours');
    if (today && today.open) {
      const open = minutes >= toMinutes(today.start) && minutes < toMinutes(today.end);
      status.textContent = open ? t('openNow') : (minutes < toMinutes(today.start) ? t('opensLater') : t('closedNow'));
      status.classList.toggle('is-open', open);
      hours.textContent = t('hoursToday', { start: formatTime(today.start), end: formatTime(today.end) });
    } else {
      status.textContent = t('closedToday');
      for (let i = 1; i <= 7; i++) {
        const next = weekly.find(w => w.day === (weekday + i) % 7 && w.open);
        if (next) {
          hours.textContent = t('nextOpen', { day: dayName(next.day).toLowerCase(), start: formatTime(next.start) });
          break;
        }
      }
    }
  }

  function renderTreatments(treatments) {
    const box = $('lpTreatments');
    if (!treatments.length) {
      box.innerHTML = `<p class="lp-muted">${esc(t('treatmentsError'))}</p>`;
      return;
    }
    box.innerHTML = treatments.slice(0, 6).map(tr => `
      <article class="lp-treatment">
        <div class="lp-treatment-top">
          <span class="skin-tag">${esc(tr.category)}</span>
          <span class="lp-duration">${esc(t('minutes', { n: tr.durationMin }))}</span>
        </div>
        <h3>${esc(tr.name)}</h3>
        ${tr.description ? `<p>${esc(tr.description)}</p>` : ''}
        <div class="lp-treatment-foot">
          <div>
            <strong>${esc(money(tr.price))}</strong>
            <small>${esc(tr.deposit > 0 ? t('depositNote', { amount: money(tr.deposit) }) : t('payAtEnd'))}</small>
          </div>
          <a class="btn-soft btn-sm" href="clientes.html?tratamiento=${encodeURIComponent(tr.id)}&amp;origen=landing-tratamiento" data-cta="treatment">${esc(t('book'))}</a>
        </div>
      </article>
    `).join('');
  }

  function renderTeam(specialists) {
    const box = $('lpTeam');
    if (!specialists.length) {
      box.hidden = true;
      return;
    }
    box.innerHTML = specialists.map(s => `
      <div class="lp-member">
        <span class="lp-member-avatar" style="background:${esc(s.avatarBg || '#EEE5D8')}">${esc(s.initials || '')}</span>
        <div>
          <h3>${esc(s.name)}</h3>
          ${s.role ? `<p>${esc(s.role)}</p>` : ''}
          ${s.specialty ? `<p class="lp-muted">${esc(s.specialty)}</p>` : ''}
        </div>
      </div>
    `).join('');
  }

  function renderStudio() {
    const city = settings.city || '';
    if (settings.businessName) {
      document.title = `${settings.businessName} — ${settings.tagline || t('ctaBook')}`;
      $('lpFooterName').textContent = settings.businessName;
    }
    if (city) $('lpEyebrow').textContent = city;
    if (settings.tagline) $('lpHeadline').textContent = settings.tagline;
    $('lpLead').textContent = settings.welcomeMessage || t('leadDefault');

    const addressText = [settings.address, city].filter(Boolean).join(', ');
    $('lpAddress').textContent = addressText || city;
    if (addressText) {
      const maps = $('lpMaps');
      maps.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${settings.businessName || ''} ${addressText}`.trim())}`;
      maps.hidden = false;
    }
    if (settings.whatsapp) {
      const wa = $('lpWhatsapp');
      wa.href = whatsappLink(settings.whatsapp, t('waMessage'));
      wa.hidden = false;
    }
    if (settings.instagram) {
      const ig = $('lpInstagram');
      ig.href = `https://instagram.com/${encodeURIComponent(settings.instagram.replace(/^@/, ''))}`;
      ig.hidden = false;
    }

    const paymentText = settings.requireDeposit === false ? t('paymentNone') : t('paymentRequire');
    $('lpPaymentNote').textContent = paymentText;
    $('lpPaymentPromise').textContent = `${t('promise3Text')} ${paymentText}`;
    if (settings.cancellationPolicy) {
      const policy = $('lpPolicy');
      policy.textContent = t('policy', { text: settings.cancellationPolicy });
      policy.hidden = false;
    }

  }

  // Si las reservas en línea están pausadas, los botones de reservar llevan a WhatsApp
  function applyBookingPaused() {
    if (settings.bookingEnabled !== false || !settings.whatsapp) return;
    document.querySelectorAll('[data-cta]').forEach(a => {
      a.href = whatsappLink(settings.whatsapp, t('waMessage'));
      a.target = '_blank';
      a.rel = 'noopener';
    });
  }

  async function load() {
    const controller = 'AbortController' in window ? new AbortController() : null;
    const timer = setTimeout(() => controller && controller.abort(), 60000);
    try {
      const res = await fetch(`${apiBase()}/api/public/catalog`, { signal: controller?.signal, cache: 'no-cache' });
      const data = await res.json();
      if (!res.ok || data.status !== 'ok') throw new Error(data.message || 'error');
      settings = data.settings || {};
      lang = settings.language === 'en' ? 'en' : 'es';
      applyStaticTranslations();
      renderStudio();
      renderHours(settings.weeklySchedule);
      renderTreatments(data.treatments || []);
      renderTeam(data.specialists || []);
      applyBookingPaused();
    } catch (err) {
      renderTreatments([]);
      renderHours(null);
      $('lpTeam').hidden = true;
    } finally {
      clearTimeout(timer);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    $('lpYear').textContent = `© ${new Date().getFullYear()}`;
    load();

    // Botón fijo de reservar: se oculta mientras el botón principal está a la vista
    const sticky = document.querySelector('.lp-sticky-cta');
    const hero = document.querySelector('.lp-hero-ctas');
    if (sticky && hero && 'IntersectionObserver' in window) {
      new IntersectionObserver(([entry]) => {
        sticky.classList.toggle('visible', !entry.isIntersecting);
      }).observe(hero);
    }
  });
})();
