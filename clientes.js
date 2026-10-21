// ============================================================================
// PORTAL DE CLIENTAS — Registro, inicio de sesión y reserva de citas
// Cada clienta solo recibe del servidor sus propios datos (token personal).
// ============================================================================
const CLIENT_TOKEN_KEY = 'niskin_client_token';
const RENDER_URL_STORAGE_KEY = 'niskin_render_backend_url';
const ACTIVE_STATUSES = ['Confirmada', 'Pendiente Depósito'];

const cp = {
  studio: null,         // datos públicos del negocio (Configuración)
  pushStatus: null,
  data: null,           // { profile, appointments, treatments, specialists, booking, studio }
  tab: 'book',
  authMode: 'register',
  booking: {
    treatmentId: '',
    specialistId: '',
    date: '',
    time: '',
    slots: null,        // null = cargando; [{ time, status: 'available' | 'taken' }]
    closed: false,
    autoDate: true      // la fecha la eligió la app (no la clienta)
  },
  submitting: false
};

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------
function storageGet(key) {
  try { return localStorage.getItem(key); } catch (e) { return null; }
}
function storageSet(key, value) {
  try { localStorage.setItem(key, value); } catch (e) {}
}
function storageRemove(key) {
  try { localStorage.removeItem(key); } catch (e) {}
}


// ---------------------------------------------------------------------------
// Idioma (se elige en Configuración del negocio)
// ---------------------------------------------------------------------------
const I18N = {
  es: {
    pageTitle: 'Agenda tu cita', loading: 'Cargando…', loadingSpace: 'Cargando tu espacio…',
    waking: 'Conectando con el estudio… la primera vez puede tardar hasta un minuto.',
    networkError: 'No pudimos conectar con el estudio. Revisa tu conexión a internet e inténtalo de nuevo.',
    sessionExpired: 'Tu sesión expiró. Inicia sesión de nuevo.', genericError: 'Ocurrió un error. Inténtalo de nuevo.',
    eyebrow: 'Mi Espacio Niskin', heroTitle: 'Agenda tu cita en minutos',
    heroText: 'Crea tu cuenta para reservar tratamientos, ver tus citas y seguir la evolución de tu piel. Tus datos son privados: solo tú y el equipo del estudio pueden verlos.',
    tabRegister: 'Crear cuenta', tabLogin: 'Iniciar sesión',
    fullName: 'Nombre completo', namePh: 'Ej. María Pérez', phone: 'Teléfono / WhatsApp', email: 'Correo electrónico',
    emailPh: 'tucorreo@ejemplo.com', password: 'Contraseña', passwordPh: 'Mínimo 8 caracteres', show: 'Ver', hide: 'Ocultar',
    showPassword: 'Mostrar contraseña', hidePassword: 'Ocultar contraseña',
    optionalSkin: 'Cuéntanos sobre tu piel (opcional)', age: 'Edad', agePh: 'Ej. 30', concern: '¿Qué te gustaría mejorar?',
    concernPh: 'Ej. manchas, acné, hidratación…', allergies: 'Alergias o condiciones a tener en cuenta', allergiesPh: 'Ej. alergia al ácido salicílico',
    privacy: 'Acepto que el estudio guarde mis datos para gestionar mis citas y mi expediente cosmetológico. No se comparten con terceros.',
    registerBtn: 'Crear cuenta y agendar', registering: 'Creando tu cuenta…', loginBtn: 'Entrar', loggingIn: 'Entrando…',
    forgot: '¿Olvidaste tu contraseña? Escríbenos y te ayudamos.',
    forgotWa: '¿Olvidaste tu contraseña? <a href="#" data-wa="forgot">Escríbenos por WhatsApp</a> y te ayudamos.',
    waForgot: 'Hola, olvidé mi contraseña de la página de citas. ¿Me pueden ayudar?',
    errName: 'Escribe tu nombre completo.', errPhone: 'Escribe un teléfono válido de al menos 10 dígitos.',
    errEmail: 'Escribe un correo electrónico válido.', errPassword: 'La contraseña debe tener al menos 8 caracteres.',
    errPrivacy: 'Debes aceptar el aviso de privacidad para continuar.', errLogin: 'Escribe tu correo y tu contraseña.',
    accountCreated: '¡Cuenta creada! Ya puedes agendar tu cita.',
    hello: 'Hola,', logout: 'Cerrar sesión', tabBook: 'Agendar', tabAppointments: 'Mis citas', tabSkin: 'Mi piel',
    bookingPaused: 'Por ahora las reservas en línea están pausadas.', bookByWa: 'Agendar por WhatsApp', waBook: 'Hola, quisiera agendar una cita.',
    step1: 'Elige tu tratamiento', step2: '¿Con quién?', step3: 'Elige el día', step4: 'Elige la hora', datesLabel: 'Fechas disponibles',
    searchingSlots: 'Buscando horarios…', closedDay: 'El estudio no abre ese día.',
    noSlots: 'No quedan horarios libres ese día. Prueba otra fecha u otra especialista.', taken: 'Ocupado', takenTitle: 'Ya hay una cita en este horario',
    slotsLegend: 'Los horarios tachados ya están reservados.',
    summary: 'Resumen de tu cita', treatment: 'Tratamiento', specialist: 'Especialista', date: 'Fecha', time: 'Hora', price: 'Precio',
    depositNote: 'Para asegurar tu espacio se requiere un depósito de <strong>{amount}</strong>. El resto ({rest}) se paga al finalizar tu sesión.',
    depositContact: ' Te contactaremos por WhatsApp con los datos de pago.', depositData: 'Datos para el depósito',
    noDepositNote: 'No necesitas depósito: tu cita queda confirmada y pagas el total de <strong>{amount}</strong> al finalizar tu sesión.',
    policy: 'Política de cancelación:', selectAll: 'Selecciona tratamiento, especialista, día y hora para continuar.',
    confirmBooking: 'Confirmar reserva', booking: 'Reservando…', booked: '¡Listo! Tu cita quedó reservada.',
    pushAskTitle: '🔔 ¿Te avisamos?', pushAskText: 'Recibe una notificación cuando confirmemos tu cita y un recordatorio antes de ella.',
    notNow: 'Ahora no', enable: 'Activar', pushIosTitle: '🔔 Recibe avisos de tus citas',
    pushIosText: 'En iPhone toca <b>Compartir</b> → <b>Añadir a pantalla de inicio</b> y abre la app desde ahí para activar las notificaciones.',
    gotIt: 'Entendido', pushEnabled: '¡Listo! Te avisaremos sobre tus citas. 🔔',
    withSpecialist: 'Con {name}', payAtEnd: 'Pagas {amount} al finalizar tu sesión.',
    depositReceived: 'Depósito recibido: {deposit}. Resto al finalizar: {rest}.',
    sendProof: 'Enviar comprobante', sendProofWa: 'Enviar comprobante por WhatsApp', cancel: 'Cancelar',
    confirmedTitle: '✨ ¡Tu cita está confirmada!', confirmedText: 'Pagas el total de <strong>{amount}</strong> al finalizar tu sesión. ¡Te esperamos!',
    reservedTitle: '✨ ¡Tu cita está reservada!', reservedText: 'Queda <em>pendiente de depósito</em>{amount}.',
    reservedWa: 'Cuando hagas el depósito, envíanos el comprobante por WhatsApp para confirmarla.', reservedNoWa: 'Te escribiremos por WhatsApp para confirmarla.',
    upcoming: 'Próximas citas', noUpcoming: 'Aún no tienes citas próximas.', bookOne: 'Agendar una cita',
    questions: '¿Dudas sobre tu cita? Escríbenos por WhatsApp', waQuestion: 'Hola, tengo una pregunta sobre mi cita.', history: 'Historial',
    cancelConfirm: '¿Cancelar tu cita de {treatment} el {date} a las {time}?', cancelled: 'Cita cancelada.',
    waProof: 'Hola, soy {name}. Reservé *{treatment}* para el *{date} a las {time}*{deposit}. ¡Gracias!',
    waProofDeposit: ' y te envío el comprobante del depósito de *{amount}*',
    myFile: 'Mi ficha', skinType: 'Biotipo de piel', wantToImprove: 'Lo que quiero mejorar', allergiesLabel: 'Alergias',
    myProgress: 'Mi progreso', lastEvaluation: 'Última evaluación: {date} ({count} en total)', hydration: 'Hidratación', toneUniformity: 'Uniformidad del tono', texturePores: 'Textura y poros', blemishControl: 'Control de imperfecciones',
    routine: 'Mi rutina en casa', morning: '☀️ Mañana', night: '🌙 Noche', sessions: 'Mis sesiones', actives: 'Activos: {value}',
    noSessions: 'Después de tu primera evaluación verás aquí tu rutina y tu progreso.',
    status: { 'Confirmada': 'Confirmada', 'Pendiente Depósito': 'Pendiente de depósito', 'Completada': 'Completada', 'Cancelada': 'Cancelada' }
  },
  en: {
    pageTitle: 'Book your appointment', loading: 'Loading…', loadingSpace: 'Loading your space…',
    waking: 'Connecting to the studio… the first time can take up to a minute.',
    networkError: 'We could not reach the studio. Check your internet connection and try again.',
    sessionExpired: 'Your session expired. Please sign in again.', genericError: 'Something went wrong. Please try again.',
    eyebrow: 'My Niskin Space', heroTitle: 'Book your appointment in minutes',
    heroText: 'Create your account to book treatments, see your appointments and follow your skin progress. Your data is private: only you and the studio team can see it.',
    tabRegister: 'Create account', tabLogin: 'Sign in',
    fullName: 'Full name', namePh: 'e.g. Maria Perez', phone: 'Phone / WhatsApp', email: 'Email',
    emailPh: 'you@example.com', password: 'Password', passwordPh: 'At least 8 characters', show: 'Show', hide: 'Hide',
    showPassword: 'Show password', hidePassword: 'Hide password',
    optionalSkin: 'Tell us about your skin (optional)', age: 'Age', agePh: 'e.g. 30', concern: 'What would you like to improve?',
    concernPh: 'e.g. dark spots, acne, hydration…', allergies: 'Allergies or conditions we should know about', allergiesPh: 'e.g. allergic to salicylic acid',
    privacy: 'I agree that the studio stores my data to manage my appointments and skin-care record. It is never shared with third parties.',
    registerBtn: 'Create account and book', registering: 'Creating your account…', loginBtn: 'Sign in', loggingIn: 'Signing in…',
    forgot: 'Forgot your password? Message us and we will help.',
    forgotWa: 'Forgot your password? <a href="#" data-wa="forgot">Message us on WhatsApp</a> and we will help.',
    waForgot: 'Hi, I forgot my password for the booking page. Could you help me?',
    errName: 'Please enter your full name.', errPhone: 'Please enter a valid phone number (at least 10 digits).',
    errEmail: 'Please enter a valid email address.', errPassword: 'Your password must be at least 8 characters long.',
    errPrivacy: 'Please accept the privacy notice to continue.', errLogin: 'Please enter your email and password.',
    accountCreated: 'Account created! You can book your appointment now.',
    hello: 'Hi,', logout: 'Sign out', tabBook: 'Book', tabAppointments: 'My visits', tabSkin: 'My skin',
    bookingPaused: 'Online booking is paused for now.', bookByWa: 'Book on WhatsApp', waBook: 'Hi, I would like to book an appointment.',
    step1: 'Choose your treatment', step2: 'With whom?', step3: 'Choose the day', step4: 'Choose the time', datesLabel: 'Available dates',
    searchingSlots: 'Looking for times…', closedDay: 'The studio is closed that day.',
    noSlots: 'No free times left that day. Try another date or specialist.', taken: 'Booked', takenTitle: 'This time is already booked',
    slotsLegend: 'Crossed-out times are already booked.',
    summary: 'Your appointment', treatment: 'Treatment', specialist: 'Specialist', date: 'Date', time: 'Time', price: 'Price',
    depositNote: 'A deposit of <strong>{amount}</strong> is required to hold your spot. The balance ({rest}) is paid after your session.',
    depositContact: ' We will message you on WhatsApp with the payment details.', depositData: 'Deposit details',
    noDepositNote: 'No deposit needed: your appointment is confirmed and you pay the full <strong>{amount}</strong> after your session.',
    policy: 'Cancellation policy:', selectAll: 'Choose a treatment, specialist, day and time to continue.',
    confirmBooking: 'Confirm booking', booking: 'Booking…', booked: 'Done! Your appointment is booked.',
    pushAskTitle: '🔔 Want updates?', pushAskText: 'Get a notification when we confirm your appointment and a reminder before it.',
    notNow: 'Not now', enable: 'Turn on', pushIosTitle: '🔔 Get appointment updates',
    pushIosText: 'On iPhone tap <b>Share</b> → <b>Add to Home Screen</b> and open the app from there to turn on notifications.',
    gotIt: 'Got it', pushEnabled: 'Done! We will keep you posted about your appointments. 🔔',
    withSpecialist: 'With {name}', payAtEnd: 'You pay {amount} after your session.',
    depositReceived: 'Deposit received: {deposit}. Balance after your session: {rest}.',
    sendProof: 'Send receipt', sendProofWa: 'Send receipt on WhatsApp', cancel: 'Cancel',
    confirmedTitle: '✨ Your appointment is confirmed!', confirmedText: 'You pay the full <strong>{amount}</strong> after your session. See you soon!',
    reservedTitle: '✨ Your appointment is booked!', reservedText: 'It is <em>pending deposit</em>{amount}.',
    reservedWa: 'Once you pay the deposit, send us the receipt on WhatsApp to confirm it.', reservedNoWa: 'We will message you on WhatsApp to confirm it.',
    upcoming: 'Upcoming appointments', noUpcoming: 'You have no upcoming appointments yet.', bookOne: 'Book an appointment',
    questions: 'Questions about your appointment? Message us on WhatsApp', waQuestion: 'Hi, I have a question about my appointment.', history: 'History',
    cancelConfirm: 'Cancel your {treatment} appointment on {date} at {time}?', cancelled: 'Appointment cancelled.',
    waProof: 'Hi, this is {name}. I booked *{treatment}* for *{date} at {time}*{deposit}. Thank you!',
    waProofDeposit: ' and here is the receipt for the *{amount}* deposit',
    myFile: 'My profile', skinType: 'Skin type', wantToImprove: 'What I want to improve', allergiesLabel: 'Allergies',
    myProgress: 'My progress', lastEvaluation: 'Last assessment: {date} ({count} in total)', hydration: 'Hydration', toneUniformity: 'Even skin tone', texturePores: 'Texture and pores', blemishControl: 'Blemish control',
    routine: 'My home routine', morning: '☀️ Morning', night: '🌙 Night', sessions: 'My sessions', actives: 'Actives: {value}',
    noSessions: 'After your first assessment you will see your routine and progress here.',
    status: { 'Confirmada': 'Confirmed', 'Pendiente Depósito': 'Pending deposit', 'Completada': 'Completed', 'Cancelada': 'Cancelled' }
  }
};

const CURRENCY_SYMBOLS = {
  DOP: ['RD$', 0], USD: ['US$', 2], EUR: ['€', 2], MXN: ['MX$', 2], COP: ['COL$', 0],
  PEN: ['S/', 2], CLP: ['CLP$', 0], ARS: ['AR$', 0], GTQ: ['Q', 2], CRC: ['₡', 0]
};

function lang() {
  return studio().language === 'en' ? 'en' : 'es';
}

function locale() {
  return lang() === 'en' ? 'en-US' : 'es-DO';
}

function t(key, vars = {}) {
  const dict = I18N[lang()];
  const text = key.split('.').reduce((obj, k) => (obj ? obj[k] : undefined), dict) ?? I18N.es[key] ?? key;
  return String(text).replace(/\{(\w+)\}/g, (_, name) => (vars[name] !== undefined ? vars[name] : ''));
}

function statusLabel(status) {
  return I18N[lang()].status[status] || status;
}

// Textos fijos del HTML marcados con data-i18n / data-i18n-placeholder / data-i18n-aria
function applyStaticTranslations() {
  document.documentElement.lang = lang();
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => { el.placeholder = t(el.dataset.i18nPlaceholder); });
  document.querySelectorAll('[data-i18n-aria]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
  document.querySelectorAll('[data-i18n-title]').forEach(el => { el.title = t(el.dataset.i18nTitle); });
}

function getApiBase() {
  const saved = storageGet(RENDER_URL_STORAGE_KEY);
  const base = saved !== null ? saved : (window.NISKIN_RENDER_URL || '');
  return base.trim().replace(/\/+$/, '');
}

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatMoney(amount) {
  const [symbol, decimals] = CURRENCY_SYMBOLS[studio().currency] || CURRENCY_SYMBOLS.DOP;
  return `${symbol} ${Number(amount || 0).toLocaleString(locale(), { maximumFractionDigits: decimals })}`;
}

function parseISODate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function toISODate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatLongDate(iso) {
  const text = parseISODate(iso).toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long' });
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// ---------------------------------------------------------------------------
// Datos del negocio y WhatsApp
// ---------------------------------------------------------------------------
function studio() {
  return cp.data?.studio || cp.studio || {};
}

function applyStudioBranding() {
  const st = studio();
  applyStaticTranslations();
  document.title = `${t('pageTitle')} — ${st.businessName || 'Niskin Beauty Studio'}`;
  const welcome = document.getElementById('cpWelcome');
  if (welcome) welcome.textContent = st.welcomeMessage || t('heroText');
  const eyebrow = document.getElementById('cpHeroEyebrow');
  if (eyebrow) eyebrow.textContent = st.businessName || t('eyebrow');
  const help = document.getElementById('cpForgotHelp');
  if (help) {
    help.innerHTML = st.whatsapp ? t('forgotWa') : esc(t('forgot'));
    help.querySelector('[data-wa="forgot"]')?.addEventListener('click', e => {
      e.preventDefault();
      contactStudio(t('waForgot'));
    });
  }
}

async function loadPublicStudio() {
  try {
    const res = await fetch(`${getApiBase()}/api/public/settings`, { cache: 'no-store' });
    const data = await res.json();
    if (data.settings) {
      cp.studio = data.settings;
      applyStudioBranding();
    }
  } catch (e) {}
}

// Depósito calculado por el servidor según Configuración (0 = paga todo al finalizar)
function depositOf(treatment) {
  return Number(treatment?.deposit ?? 0);
}

function contactStudio(message) {
  NiskinWhatsApp.open(studio().whatsapp, message);
}

function sendDepositProof(appointmentId) {
  const a = cp.data.appointments.find(x => x.id === appointmentId);
  if (!a) return;
  const tr = cp.data.treatments.find(x => x.id === a.treatmentId);
  const name = cp.data.profile.name;
  const deposit = depositOf(tr);
  contactStudio(t('waProof', {
    name,
    treatment: a.treatmentName,
    date: formatLongDate(a.date),
    time: a.time,
    deposit: deposit ? t('waProofDeposit', { amount: formatMoney(deposit) }) : ''
  }));
}

function showToast(message) {
  const container = document.getElementById('toastContainer');
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3800);
}

function setLoading(isLoading, text = t('loading')) {
  const box = document.getElementById('cpLoading');
  document.getElementById('cpLoadingText').textContent = text;
  box.classList.toggle('visible', isLoading);
}

function showMessage(id, text, type = 'error') {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text || '';
  el.classList.toggle('success', type === 'success');
  el.hidden = !text;
}

async function api(path, { method = 'GET', body, auth = true } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  const token = storageGet(CLIENT_TOKEN_KEY);
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  // El plan gratuito de Render "duerme": avisamos si tarda en despertar
  const slowTimer = setTimeout(() => {
    setLoading(true, t('waking'));
  }, 4000);

  let res;
  try {
    res = await fetch(`${getApiBase()}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store'
    });
  } catch (e) {
    throw new Error(t('networkError'));
  } finally {
    clearTimeout(slowTimer);
  }

  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && auth) {
    clientLogout(true);
    throw new Error(data.message || t('sessionExpired'));
  }
  if (!res.ok) {
    throw new Error(data.message || t('genericError'));
  }
  return data;
}

// ---------------------------------------------------------------------------
// Acceso
// ---------------------------------------------------------------------------
function setAuthMode(mode) {
  cp.authMode = mode;
  const isRegister = mode === 'register';
  document.getElementById('registerForm').hidden = !isRegister;
  document.getElementById('loginForm').hidden = isRegister;
  document.getElementById('tabRegister').classList.toggle('active', isRegister);
  document.getElementById('tabLogin').classList.toggle('active', !isRegister);
  document.getElementById('tabRegister').setAttribute('aria-selected', String(isRegister));
  document.getElementById('tabLogin').setAttribute('aria-selected', String(!isRegister));
  showMessage('registerMessage', '');
  showMessage('loginMessage', '');
}

function togglePassword(inputId, btn) {
  const input = document.getElementById(inputId);
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  btn.textContent = show ? t('hide') : t('show');
  btn.setAttribute('aria-label', show ? t('hidePassword') : t('showPassword'));
}

function setFormBusy(form, busy, label) {
  const btn = form.querySelector('.cp-submit');
  btn.disabled = busy;
  btn.textContent = busy ? label : t(btn.dataset.i18n);
}

async function submitRegister(event) {
  event.preventDefault();
  const form = event.target;
  const payload = {
    name: form.name.value.trim(),
    phone: form.phone.value.trim(),
    email: form.email.value.trim(),
    password: form.password.value,
    age: form.age.value,
    mainConcern: form.mainConcern.value.trim(),
    allergies: form.allergies.value.trim(),
    acceptPrivacy: form.acceptPrivacy.checked
  };

  if (payload.name.length < 3) return showMessage('registerMessage', t('errName'));
  if (payload.phone.replace(/\D/g, '').length < 10) return showMessage('registerMessage', t('errPhone'));
  if (!form.email.checkValidity() || !payload.email) return showMessage('registerMessage', t('errEmail'));
  if (payload.password.length < 8) return showMessage('registerMessage', t('errPassword'));
  if (!payload.acceptPrivacy) return showMessage('registerMessage', t('errPrivacy'));

  showMessage('registerMessage', '');
  setFormBusy(form, true, t('registering'));
  try {
    const data = await api('/api/client/register', { method: 'POST', body: payload, auth: false });
    storageSet(CLIENT_TOKEN_KEY, data.token);
    form.reset();
    await loadClientData();
    showToast(t('accountCreated'));
  } catch (err) {
    showMessage('registerMessage', err.message);
  } finally {
    setFormBusy(form, false);
    setLoading(false);
  }
}

async function submitLogin(event) {
  event.preventDefault();
  const form = event.target;
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  if (!email || !password) return showMessage('loginMessage', t('errLogin'));

  showMessage('loginMessage', '');
  setFormBusy(form, true, t('loggingIn'));
  try {
    const data = await api('/api/client/login', { method: 'POST', body: { email, password }, auth: false });
    storageSet(CLIENT_TOKEN_KEY, data.token);
    form.reset();
    await loadClientData();
  } catch (err) {
    showMessage('loginMessage', err.message);
  } finally {
    setFormBusy(form, false);
    setLoading(false);
  }
}

function clientLogout(expired = false) {
  if (window.NiskinPush) NiskinPush.disable({ apiBase: getApiBase() });
  storageRemove(CLIENT_TOKEN_KEY);
  cp.data = null;
  cp.booking = { treatmentId: '', specialistId: '', date: '', time: '', slots: null, closed: false, autoDate: true };
  showAuthView();
  setAuthMode('login');
  if (expired) showMessage('loginMessage', t('sessionExpired'));
}

function showAuthView() {
  document.getElementById('authView').hidden = false;
  document.getElementById('appView').hidden = true;
  document.getElementById('cpTabbar').hidden = true;
  document.getElementById('cpLogoutBtn').hidden = true;
  document.body.classList.remove('cp-has-tabbar');
}

function showAppView() {
  document.getElementById('authView').hidden = true;
  document.getElementById('appView').hidden = false;
  document.getElementById('cpTabbar').hidden = false;
  document.getElementById('cpLogoutBtn').hidden = false;
  document.body.classList.add('cp-has-tabbar');
  window.scrollTo({ top: 0 });
}

// ---------------------------------------------------------------------------
// Datos de la clienta
// ---------------------------------------------------------------------------
async function loadClientData() {
  setLoading(true, t('loadingSpace'));
  try {
    cp.data = await api('/api/client/me');
    const { profile, treatments, specialists } = cp.data;

    if (!treatments.find(tr => tr.id === cp.booking.treatmentId)) cp.booking.treatmentId = treatments[0]?.id || '';
    if (!specialists.find(s => s.id === cp.booking.specialistId)) cp.booking.specialistId = specialists[0]?.id || '';
    if (!cp.booking.date) {
      cp.booking.date = getBookableDates()[0] || '';
      cp.booking.autoDate = true;
    }

    document.getElementById('cpGreetingName').textContent = profile.name.split(' ')[0];
    const avatar = document.getElementById('cpAvatar');
    avatar.textContent = profile.initials || 'NB';
    avatar.className = `pastel-avatar ${profile.pastelClass || 'pastel-rose'}`;

    applyStudioBranding();
    showAppView();
    cp.pushStatus = window.NiskinPush ? await NiskinPush.status() : 'unsupported';
    renderClientPanel();
    refreshAvailability();
  } finally {
    setLoading(false);
  }
}

function getBookableDates(count = 28) {
  if (!cp.data) return [];
  const { minDate, maxDate, closedWeekdays } = cp.data.booking;
  const dates = [];
  const cursor = parseISODate(minDate);
  while (dates.length < count) {
    const iso = toISODate(cursor);
    if (iso > maxDate) break;
    if (!closedWeekdays.includes(cursor.getDay())) dates.push(iso);
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

async function refreshAvailability() {
  const { date, specialistId, treatmentId } = cp.booking;
  if (!date || !specialistId) return;
  cp.booking.slots = null;
  cp.booking.time = '';
  renderSlots();
  try {
    const params = new URLSearchParams({ date, specialistId, treatmentId });
    const data = await api(`/api/client/availability?${params}`);
    // Ignorar respuestas viejas si la clienta cambió de fecha/especialista/tratamiento mientras cargaba
    if (date !== cp.booking.date || specialistId !== cp.booking.specialistId || treatmentId !== cp.booking.treatmentId) return;
    cp.booking.slots = Array.isArray(data.slots)
      ? data.slots
      : (data.available || []).map(time => ({ time, status: 'available' }));
    cp.booking.closed = data.closed;
    const free = cp.booking.slots.filter(sl => sl.status === 'available');

    // Si el día sugerido ya no tiene horarios (p. ej. hoy por la noche), pasar al siguiente día abierto
    if (cp.booking.autoDate && !free.length) {
      const dates = getBookableDates();
      const next = dates[dates.indexOf(date) + 1];
      if (next && dates.indexOf(date) < 6) {
        cp.booking.date = next;
        if (cp.tab === 'book') renderClientPanel();
        return refreshAvailability();
      }
    }
  } catch (err) {
    cp.booking.slots = [];
    showToast(err.message);
  }
  renderSlots();
}

// ---------------------------------------------------------------------------
// Pestañas
// ---------------------------------------------------------------------------
function setClientTab(tab) {
  cp.tab = tab;
  document.querySelectorAll('.cp-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  renderClientPanel();
  window.scrollTo({ top: 0 });
}

function renderClientPanel() {
  const panel = document.getElementById('cpPanel');
  if (!cp.data) return;
  let html;
  if (cp.tab === 'appointments') html = renderAppointmentsTab();
  else if (cp.tab === 'skin') html = renderSkinTab();
  else html = renderBookingTab();
  panel.innerHTML = renderClientPushCard() + html;
  if (cp.tab === 'book') {
    const selected = panel.querySelector('.cp-date.selected');
    if (selected) selected.parentElement.scrollLeft = selected.offsetLeft - selected.parentElement.offsetLeft - 16;
  }
}

// ---------------------------------------------------------------------------
// Reservar
// ---------------------------------------------------------------------------
function renderBookingTab() {
  const { treatments, specialists } = cp.data;
  const dates = getBookableDates();

  if (cp.data.booking.enabled === false) {
    return `
      <div class="cp-empty">
        <p>${esc(t('bookingPaused'))}</p>
        ${studio().whatsapp ? `<button type="button" class="btn-gold" onclick="contactStudio(t('waBook'))">${esc(t('bookByWa'))}</button>` : ''}
      </div>
    `;
  }

  return `
    <section class="cp-step">
      <h2><span class="cp-step-num">1</span> ${esc(t('step1'))}</h2>
      <div class="cp-treatments">
        ${treatments.map(tr => `
          <button type="button" class="cp-treatment ${tr.id === cp.booking.treatmentId ? 'selected' : ''}" onclick="selectTreatment('${esc(tr.id)}')">
            <div class="cp-treatment-top">
              <span class="skin-tag">${esc(tr.category)}</span>
              <span class="cp-check-circle" aria-hidden="true">✓</span>
            </div>
            <h3>${esc(tr.name)}</h3>
            ${tr.description ? `<p>${esc(tr.description)}</p>` : ''}
            <div class="cp-treatment-meta">
              <strong>${formatMoney(tr.price)}</strong>
              <span>⏱ ${esc(tr.durationMin)} min</span>
            </div>
          </button>
        `).join('')}
      </div>
    </section>

    <section class="cp-step">
      <h2><span class="cp-step-num">2</span> ${esc(t('step2'))}</h2>
      <div class="cp-chips">
        ${specialists.map(s => `
          <button type="button" class="cp-chip cp-chip-person ${s.id === cp.booking.specialistId ? 'selected' : ''}" onclick="selectSpecialist('${esc(s.id)}')">
            <span class="cp-chip-avatar" style="background:${esc(s.avatarBg || '#EEE5D8')}">${esc(s.initials)}</span>
            <span class="cp-chip-text">
              <strong>${esc(s.name)}</strong>
              <small>${esc(s.role || s.specialty || '')}</small>
            </span>
          </button>
        `).join('')}
      </div>
    </section>

    <section class="cp-step">
      <h2><span class="cp-step-num">3</span> ${esc(t('step3'))}</h2>
      <div class="cp-dates" role="listbox" aria-label="${esc(t('datesLabel'))}">
        ${dates.map(iso => {
          const d = parseISODate(iso);
          return `
            <button type="button" role="option" aria-selected="${iso === cp.booking.date}" class="cp-date ${iso === cp.booking.date ? 'selected' : ''}" onclick="selectDate('${iso}')">
              <small>${d.toLocaleDateString(locale(), { weekday: 'short' }).replace('.', '')}</small>
              <strong>${d.getDate()}</strong>
              <small>${d.toLocaleDateString(locale(), { month: 'short' }).replace('.', '')}</small>
            </button>
          `;
        }).join('')}
      </div>
    </section>

    <section class="cp-step">
      <h2><span class="cp-step-num">4</span> ${esc(t('step4'))}</h2>
      <div id="cpSlots"></div>
    </section>

    <div id="cpSummary"></div>
  `;
}

function renderSlots() {
  const box = document.getElementById('cpSlots');
  if (!box) return;
  const { slots, closed, time } = cp.booking;
  const free = (slots || []).filter(sl => sl.status === 'available');
  if (slots === null) {
    box.innerHTML = `<div class="cp-slots-loading">${esc(t('searchingSlots'))}</div>`;
  } else if (closed || !free.length) {
    box.innerHTML = `<div class="cp-empty-inline">${esc(closed ? t('closedDay') : t('noSlots'))}</div>`;
  } else {
    const hasTaken = slots.some(sl => sl.status === 'taken');
    box.innerHTML = `
      <div class="phone-slots-grid">
        ${slots.map(sl => sl.status === 'taken' ? `
          <button type="button" class="phone-slot-pill taken" disabled aria-disabled="true" title="${esc(t('takenTitle'))}">
            ${esc(sl.time)}<small>${esc(t('taken'))}</small>
          </button>
        ` : `
          <button type="button" class="phone-slot-pill ${sl.time === time ? 'selected' : ''}" onclick="selectSlot('${esc(sl.time)}')">${esc(sl.time)}</button>
        `).join('')}
      </div>
      ${hasTaken ? `<p class="cp-slots-legend">${esc(t('slotsLegend'))}</p>` : ''}
    `;
  }
  renderSummary();
}

function renderSummary() {
  const box = document.getElementById('cpSummary');
  if (!box) return;
  const { treatmentId, specialistId, date, time } = cp.booking;
  const tr = cp.data.treatments.find(x => x.id === treatmentId);
  const sp = cp.data.specialists.find(x => x.id === specialistId);
  const ready = tr && sp && date && time;
  const deposit = depositOf(tr);

  box.innerHTML = `
    <section class="cp-summary ${ready ? 'ready' : ''}">
      ${ready ? `
        <h3>${esc(t('summary'))}</h3>
        <ul>
          <li><span>${esc(t('treatment'))}</span><strong>${esc(tr.name)}</strong></li>
          <li><span>${esc(t('specialist'))}</span><strong>${esc(sp.name)}</strong></li>
          <li><span>${esc(t('date'))}</span><strong>${esc(formatLongDate(date))}</strong></li>
          <li><span>${esc(t('time'))}</span><strong>${esc(time)}</strong></li>
          <li><span>${esc(t('price'))}</span><strong>${formatMoney(tr.price)}</strong></li>
        </ul>
        ${deposit > 0 ? `
          <p class="cp-note">${t('depositNote', { amount: formatMoney(deposit), rest: formatMoney(Math.max(0, tr.price - deposit)) })}${studio().depositInstructions ? '' : esc(t('depositContact'))}</p>
          ${studio().depositInstructions ? `<div class="cp-deposit"><strong>${esc(t('depositData'))}</strong><p class="cp-pre">${esc(studio().depositInstructions)}</p></div>` : ''}
        ` : `
          <p class="cp-note">${t('noDepositNote', { amount: formatMoney(tr.price) })}</p>
        `}
        ${studio().cancellationPolicy ? `<p class="cp-policy"><strong>${esc(t('policy'))}</strong> ${esc(studio().cancellationPolicy)}</p>` : ''}
      ` : `
        <p class="cp-note">${esc(t('selectAll'))}</p>
      `}
      <button type="button" class="phone-cta-btn" ${ready && !cp.submitting ? '' : 'disabled'} onclick="submitBooking()">
        <span>${esc(cp.submitting ? t('booking') : t('confirmBooking'))}</span>
        <span aria-hidden="true">→</span>
      </button>
    </section>
  `;
}

function selectTreatment(id) {
  if (cp.booking.treatmentId === id) return;
  cp.booking.treatmentId = id;
  document.querySelectorAll('.cp-treatment').forEach(el => {
    el.classList.toggle('selected', el.getAttribute('onclick').includes(`'${id}'`));
  });
  // La duración del tratamiento cambia qué horarios caben en el día
  refreshAvailability();
}

function selectSpecialist(id) {
  if (cp.booking.specialistId === id) return;
  cp.booking.specialistId = id;
  document.querySelectorAll('.cp-chip-person').forEach(el => {
    el.classList.toggle('selected', el.getAttribute('onclick').includes(`'${id}'`));
  });
  refreshAvailability();
}

function selectDate(iso) {
  cp.booking.autoDate = false;
  if (cp.booking.date === iso) return;
  cp.booking.date = iso;
  document.querySelectorAll('.cp-date').forEach(el => {
    const isSel = el.getAttribute('onclick').includes(`'${iso}'`);
    el.classList.toggle('selected', isSel);
    el.setAttribute('aria-selected', String(isSel));
  });
  refreshAvailability();
}

function selectSlot(slot) {
  cp.booking.time = slot;
  renderSlots();
  document.querySelector('#cpSummary .cp-summary')?.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

async function submitBooking() {
  const { treatmentId, specialistId, date, time } = cp.booking;
  if (!treatmentId || !specialistId || !date || !time || cp.submitting) return;

  cp.submitting = true;
  renderSummary();
  try {
    const result = await api('/api/client/appointments', {
      method: 'POST',
      body: { treatmentId, specialistId, date, time }
    });
    cp.data.appointments.unshift(result.appointment);
    cp.booking.time = '';
    cp.lastBooking = result;
    cp.submitting = false;
    setClientTab('appointments');
    showToast(t('booked'));
  } catch (err) {
    cp.submitting = false;
    showToast(err.message);
    refreshAvailability();
  }
}

// ---------------------------------------------------------------------------
// Notificaciones push de la clienta
// ---------------------------------------------------------------------------
const CLIENT_PUSH_PROMPT_KEY = 'niskin_client_push_prompt_dismissed';

function renderClientPushCard() {
  if (storageGet(CLIENT_PUSH_PROMPT_KEY) === '1') return '';
  if (cp.pushStatus === 'available') {
    return `
      <div class="cp-push">
        <div>
          <strong>${esc(t('pushAskTitle'))}</strong>
          <p>${esc(t('pushAskText'))}</p>
        </div>
        <div class="cp-push-actions">
          <button type="button" class="btn-soft btn-sm" onclick="dismissClientPush()">${esc(t('notNow'))}</button>
          <button type="button" class="btn-gold btn-sm" onclick="enableClientPush()">${esc(t('enable'))}</button>
        </div>
      </div>
    `;
  }
  if (cp.pushStatus === 'ios-install') {
    return `
      <div class="cp-push">
        <div>
          <strong>${esc(t('pushIosTitle'))}</strong>
          <p>${t('pushIosText')}</p>
        </div>
        <div class="cp-push-actions">
          <button type="button" class="btn-soft btn-sm" onclick="dismissClientPush()">${esc(t('gotIt'))}</button>
        </div>
      </div>
    `;
  }
  return '';
}

function dismissClientPush() {
  storageSet(CLIENT_PUSH_PROMPT_KEY, '1');
  renderClientPanel();
}

async function enableClientPush() {
  try {
    await NiskinPush.enable({
      apiBase: getApiBase(),
      subscribePath: '/api/client/push/subscribe',
      headers: { Authorization: `Bearer ${storageGet(CLIENT_TOKEN_KEY)}` }
    });
    showToast(t('pushEnabled'));
  } catch (err) {
    showToast(err.message);
  }
  cp.pushStatus = await NiskinPush.status();
  renderClientPanel();
}

// ---------------------------------------------------------------------------
// Mis citas
// ---------------------------------------------------------------------------
function statusClass(status) {
  if (status === 'Cancelada') return 'status-danger';
  if (status === 'Pendiente Depósito') return 'status-pending';
  return 'status-confirmed';
}

function renderAppointmentCard(a, { allowCancel }) {
  return `
    <article class="cp-appt">
      <div class="cp-appt-date">
        <strong>${parseISODate(a.date).getDate()}</strong>
        <small>${parseISODate(a.date).toLocaleDateString(locale(), { month: 'short' }).replace('.', '')}</small>
      </div>
      <div class="cp-appt-body">
        <h3>${esc(a.treatmentName)}</h3>
        <p>${esc(formatLongDate(a.date))} • ${esc(a.time)}</p>
        <p>${esc(t('withSpecialist', { name: a.specialistName }))} • ${formatMoney(a.price)}</p>
        ${a.status === 'Confirmada' ? `<p class="cp-pay-note">${esc(a.paymentMode === 'al-finalizar'
          ? t('payAtEnd', { amount: formatMoney(a.price) })
          : t('depositReceived', { deposit: formatMoney(a.depositPaid), rest: formatMoney(Math.max(0, a.price - a.depositPaid)) }))}</p>` : ''}
        <div class="cp-appt-actions">
          <span class="status-pill ${statusClass(a.status)}"><span class="dot"></span>${esc(statusLabel(a.status))}</span>
          <span class="cp-appt-buttons">
            ${a.status === 'Pendiente Depósito' && studio().whatsapp ? `<button type="button" class="btn-soft btn-sm cp-wa-soft" onclick="sendDepositProof('${esc(a.id)}')">${esc(t('sendProof'))}</button>` : ''}
            ${allowCancel ? `<button type="button" class="btn-soft btn-sm" onclick="cancelAppointment('${esc(a.id)}')">${esc(t('cancel'))}</button>` : ''}
          </span>
        </div>
      </div>
    </article>
  `;
}

function renderAppointmentsTab() {
  const today = cp.data.booking.minDate;
  const upcoming = cp.data.appointments
    .filter(a => a.date >= today && a.status !== 'Completada')
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const past = cp.data.appointments.filter(a => !upcoming.includes(a));

  const confirmedNow = cp.lastBooking?.appointment?.status === 'Confirmada';
  const banner = cp.lastBooking && confirmedNow ? `
    <div class="cp-success">
      <strong>${esc(t('confirmedTitle'))}</strong>
      <p>${t('confirmedText', { amount: formatMoney(cp.lastBooking.appointment.price) })}</p>
    </div>
  ` : cp.lastBooking ? `
    <div class="cp-success">
      <strong>${esc(t('reservedTitle'))}</strong>
      <p>${t('reservedText', { amount: cp.lastBooking.depositRequired ? ` (${formatMoney(cp.lastBooking.depositRequired)})` : '' })}
      ${esc(studio().whatsapp ? t('reservedWa') : t('reservedNoWa'))}</p>
      ${studio().depositInstructions ? `<p class="cp-pre" style="margin-top:8px;">${esc(studio().depositInstructions)}</p>` : ''}
      ${studio().whatsapp ? `<button type="button" class="cp-wa-btn" onclick="sendDepositProof('${esc(cp.lastBooking.appointment.id)}')">${esc(t('sendProofWa'))}</button>` : ''}
    </div>
  ` : '';
  cp.lastBooking = null;

  return `
    ${banner}
    <section class="cp-step">
      <h2>${esc(t('upcoming'))}</h2>
      ${upcoming.length ? upcoming.map(a => renderAppointmentCard(a, { allowCancel: ACTIVE_STATUSES.includes(a.status) })).join('') : `
        <div class="cp-empty">
          <p>${esc(t('noUpcoming'))}</p>
          <button type="button" class="btn-gold" onclick="setClientTab('book')">${esc(t('bookOne'))}</button>
        </div>
      `}
    </section>
    ${studio().whatsapp ? `
      <button type="button" class="cp-help-link" onclick="contactStudio(t('waQuestion'))">${esc(t('questions'))}</button>
    ` : ''}
    ${past.length ? `
      <section class="cp-step">
        <h2>${esc(t('history'))}</h2>
        ${past.map(a => renderAppointmentCard(a, { allowCancel: false })).join('')}
      </section>
    ` : ''}
  `;
}

async function cancelAppointment(id) {
  const appt = cp.data.appointments.find(a => a.id === id);
  if (!appt) return;
  if (!window.confirm(t('cancelConfirm', { treatment: appt.treatmentName, date: formatLongDate(appt.date), time: appt.time }))) return;
  try {
    const result = await api(`/api/client/appointments/${encodeURIComponent(id)}/cancel`, { method: 'POST' });
    Object.assign(appt, result.appointment);
    renderClientPanel();
    showToast(t('cancelled'));
  } catch (err) {
    showToast(err.message);
  }
}

// ---------------------------------------------------------------------------
// Mi piel
// ---------------------------------------------------------------------------
function renderSkinTab() {
  const p = cp.data.profile;
  const metricLabels = {
    hydration: t('hydration'),
    toneUniformity: t('toneUniformity'),
    texturePores: t('texturePores'),
    blemishControl: t('blemishControl')
  };
  const metrics = Object.entries(p.metrics || {}).filter(([, m]) => m && (m.before || m.current));
  const evaluations = (p.progressLog || []).filter(e => e.date).sort((a, b) => a.date.localeCompare(b.date));
  const lastEval = evaluations[evaluations.length - 1];

  return `
    <section class="cp-card cp-skin-profile">
      <h2>${esc(t('myFile'))}</h2>
      <ul class="cp-facts">
        <li><span>${esc(t('skinType'))}</span><strong>${esc(p.skinBiotype)}</strong></li>
        <li><span>${esc(t('wantToImprove'))}</span><strong>${esc(p.mainConcern)}</strong></li>
        <li><span>${esc(t('allergiesLabel'))}</span><strong>${esc(p.allergies)}</strong></li>
      </ul>
    </section>

    ${metrics.length ? `
      <section class="cp-card">
        <h2>${esc(t('myProgress'))}</h2>
        ${lastEval ? `<p class="cp-muted" style="margin:-6px 0 10px;">${esc(t('lastEvaluation', { date: formatLongDate(lastEval.date), count: evaluations.length }))}</p>` : ''}
        <div class="metrics-progress-list">
          ${metrics.map(([key, m]) => `
            <div class="metric-item">
              <div class="metric-item-top"><span>${esc(metricLabels[key] || key)}</span><span>${esc(m.before)}% → <strong>${esc(m.current)}%</strong></span></div>
              <div class="kpi-progress-track"><div class="kpi-progress-bar" style="width:${Math.min(100, Number(m.current) || 0)}%"></div></div>
            </div>
          `).join('')}
        </div>
      </section>
    ` : ''}

    ${p.homeRoutineAM || p.homeRoutinePM ? `
      <section class="cp-step">
        <h2>${esc(t('routine'))}</h2>
        <div class="routine-grid">
          <div class="routine-box"><h4>${esc(t('morning'))}</h4><p class="cp-pre">${esc(p.homeRoutineAM || '—')}</p></div>
          <div class="routine-box"><h4>${esc(t('night'))}</h4><p class="cp-pre">${esc(p.homeRoutinePM || '—')}</p></div>
        </div>
      </section>
    ` : ''}

    <section class="cp-step">
      <h2>${esc(t('sessions'))}</h2>
      ${p.sessions.length ? `
        <div class="session-timeline">
          ${p.sessions.map(s => `
            <div class="session-card">
              <div class="session-card-top">
                <strong>${esc(s.treatmentName)}</strong>
                <span class="skin-tag">${esc(s.date)}</span>
              </div>
              <p class="cp-muted">${esc(t('withSpecialist', { name: s.specialistName }))}</p>
              ${s.activesApplied ? `<p class="cp-muted">${esc(t('actives', { value: s.activesApplied }))}</p>` : ''}
            </div>
          `).join('')}
        </div>
      ` : `
        <div class="cp-empty">
          <p>${esc(t('noSessions'))}</p>
        </div>
      `}
    </section>
  `;
}

// ---------------------------------------------------------------------------
// Inicio
// ---------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', async () => {
  // Cargar idioma y datos del negocio antes de mostrar textos (máximo 3 s si el servidor está despertando)
  applyStaticTranslations();
  await Promise.race([loadPublicStudio(), new Promise(resolve => setTimeout(resolve, 3000))]);
  if (storageGet(CLIENT_TOKEN_KEY)) {
    try {
      await loadClientData();
      return;
    } catch (err) {
      showAuthView();
      setAuthMode('login');
      showMessage('loginMessage', err.message);
      return;
    }
  }
  setLoading(false);
  showAuthView();
  setAuthMode(new URLSearchParams(window.location.search).get('modo') === 'entrar' ? 'login' : 'register');
});
