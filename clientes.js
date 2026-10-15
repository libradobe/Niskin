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
    available: null,    // null = cargando, [] = sin horarios
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
  return `RD$ ${Number(amount || 0).toLocaleString('es-DO')}`;
}

function parseISODate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function toISODate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatLongDate(iso) {
  const text = parseISODate(iso).toLocaleDateString('es-DO', { weekday: 'long', day: 'numeric', month: 'long' });
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
  if (st.businessName) document.title = `Agenda tu cita — ${st.businessName}`;
  const welcome = document.getElementById('cpWelcome');
  if (welcome && st.welcomeMessage) welcome.textContent = st.welcomeMessage;
  const eyebrow = document.getElementById('cpHeroEyebrow');
  if (eyebrow && st.businessName) eyebrow.textContent = st.businessName;
  const help = document.getElementById('cpForgotHelp');
  if (help) {
    help.innerHTML = st.whatsapp
      ? '¿Olvidaste tu contraseña? <a href="#" onclick="contactStudio(\'Hola, olvidé mi contraseña de la página de citas. ¿Me pueden ayudar?\');return false;">Escríbenos por WhatsApp</a> y te ayudamos.'
      : '¿Olvidaste tu contraseña? Escríbenos y te ayudamos.';
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

function depositNeeded(treatment) {
  return studio().requireDeposit !== false && Number(treatment?.depositRequired) > 0;
}

function contactStudio(message) {
  NiskinWhatsApp.open(studio().whatsapp, message);
}

function sendDepositProof(appointmentId) {
  const a = cp.data.appointments.find(x => x.id === appointmentId);
  if (!a) return;
  const t = cp.data.treatments.find(x => x.id === a.treatmentId);
  const name = cp.data.profile.name;
  contactStudio(
    `Hola, soy ${name}. Reservé *${a.treatmentName}* para el *${formatLongDate(a.date)} a las ${a.time}*` +
    `${t?.depositRequired ? ` y te envío el comprobante del depósito de *${formatMoney(t.depositRequired)}*` : ''}. ¡Gracias!`
  );
}

function showToast(message) {
  const container = document.getElementById('toastContainer');
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3800);
}

function setLoading(isLoading, text = 'Cargando…') {
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
    setLoading(true, 'Conectando con el estudio… la primera vez puede tardar hasta un minuto.');
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
    throw new Error('No pudimos conectar con el estudio. Revisa tu conexión a internet e inténtalo de nuevo.');
  } finally {
    clearTimeout(slowTimer);
  }

  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && auth) {
    clientLogout(true);
    throw new Error(data.message || 'Tu sesión expiró. Inicia sesión de nuevo.');
  }
  if (!res.ok) {
    throw new Error(data.message || 'Ocurrió un error. Inténtalo de nuevo.');
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
  btn.textContent = show ? 'Ocultar' : 'Ver';
  btn.setAttribute('aria-label', show ? 'Ocultar contraseña' : 'Mostrar contraseña');
}

function setFormBusy(form, busy, label) {
  const btn = form.querySelector('.cp-submit');
  if (!btn.dataset.label) btn.dataset.label = btn.textContent;
  btn.disabled = busy;
  btn.textContent = busy ? label : btn.dataset.label;
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

  if (payload.name.length < 3) return showMessage('registerMessage', 'Escribe tu nombre completo.');
  if (payload.phone.replace(/\D/g, '').length < 10) return showMessage('registerMessage', 'Escribe un teléfono válido de al menos 10 dígitos.');
  if (!form.email.checkValidity() || !payload.email) return showMessage('registerMessage', 'Escribe un correo electrónico válido.');
  if (payload.password.length < 8) return showMessage('registerMessage', 'La contraseña debe tener al menos 8 caracteres.');
  if (!payload.acceptPrivacy) return showMessage('registerMessage', 'Debes aceptar el aviso de privacidad para continuar.');

  showMessage('registerMessage', '');
  setFormBusy(form, true, 'Creando tu cuenta…');
  try {
    const data = await api('/api/client/register', { method: 'POST', body: payload, auth: false });
    storageSet(CLIENT_TOKEN_KEY, data.token);
    form.reset();
    await loadClientData();
    showToast('¡Cuenta creada! Ya puedes agendar tu cita.');
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
  if (!email || !password) return showMessage('loginMessage', 'Escribe tu correo y tu contraseña.');

  showMessage('loginMessage', '');
  setFormBusy(form, true, 'Entrando…');
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
  cp.booking = { treatmentId: '', specialistId: '', date: '', time: '', available: null, closed: false, autoDate: true };
  showAuthView();
  setAuthMode('login');
  if (expired) showMessage('loginMessage', 'Tu sesión expiró. Inicia sesión de nuevo.');
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
  setLoading(true, 'Cargando tu espacio…');
  try {
    cp.data = await api('/api/client/me');
    const { profile, treatments, specialists } = cp.data;

    if (!treatments.find(t => t.id === cp.booking.treatmentId)) cp.booking.treatmentId = treatments[0]?.id || '';
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
  const { date, specialistId } = cp.booking;
  if (!date || !specialistId) return;
  cp.booking.available = null;
  cp.booking.time = '';
  renderSlots();
  try {
    const params = new URLSearchParams({ date, specialistId });
    const data = await api(`/api/client/availability?${params}`);
    // Ignorar respuestas viejas si la clienta cambió de fecha/especialista mientras cargaba
    if (date !== cp.booking.date || specialistId !== cp.booking.specialistId) return;
    cp.booking.available = data.available;
    cp.booking.closed = data.closed;

    // Si el día sugerido ya no tiene horarios (p. ej. hoy por la noche), pasar al siguiente día abierto
    if (cp.booking.autoDate && !data.available.length) {
      const dates = getBookableDates();
      const next = dates[dates.indexOf(date) + 1];
      if (next && dates.indexOf(date) < 6) {
        cp.booking.date = next;
        if (cp.tab === 'book') renderClientPanel();
        return refreshAvailability();
      }
    }
  } catch (err) {
    cp.booking.available = [];
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
  if (cp.tab === 'skin') initPhotoSlider();
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
        <p>Por ahora las reservas en línea están pausadas.</p>
        ${studio().whatsapp ? `<button type="button" class="btn-gold" onclick="contactStudio('Hola, quisiera agendar una cita.')">Agendar por WhatsApp</button>` : ''}
      </div>
    `;
  }

  return `
    <section class="cp-step">
      <h2><span class="cp-step-num">1</span> Elige tu tratamiento</h2>
      <div class="cp-treatments">
        ${treatments.map(t => `
          <button type="button" class="cp-treatment ${t.id === cp.booking.treatmentId ? 'selected' : ''}" onclick="selectTreatment('${esc(t.id)}')">
            <div class="cp-treatment-top">
              <span class="skin-tag">${esc(t.category)}</span>
              <span class="cp-check-circle" aria-hidden="true">✓</span>
            </div>
            <h3>${esc(t.name)}</h3>
            ${t.description ? `<p>${esc(t.description)}</p>` : ''}
            <div class="cp-treatment-meta">
              <strong>${formatMoney(t.price)}</strong>
              <span>⏱ ${esc(t.durationMin)} min</span>
            </div>
          </button>
        `).join('')}
      </div>
    </section>

    <section class="cp-step">
      <h2><span class="cp-step-num">2</span> ¿Con quién?</h2>
      <div class="cp-chips">
        ${specialists.map(s => `
          <button type="button" class="cp-chip cp-chip-person ${s.id === cp.booking.specialistId ? 'selected' : ''}" onclick="selectSpecialist('${esc(s.id)}')">
            <span class="cp-chip-avatar" style="background:${esc(s.avatarBg || '#DECBB1')}">${esc(s.initials)}</span>
            <span class="cp-chip-text">
              <strong>${esc(s.name)}</strong>
              <small>${esc(s.role || s.specialty || '')}</small>
            </span>
          </button>
        `).join('')}
      </div>
    </section>

    <section class="cp-step">
      <h2><span class="cp-step-num">3</span> Elige el día</h2>
      <div class="cp-dates" role="listbox" aria-label="Fechas disponibles">
        ${dates.map(iso => {
          const d = parseISODate(iso);
          return `
            <button type="button" role="option" aria-selected="${iso === cp.booking.date}" class="cp-date ${iso === cp.booking.date ? 'selected' : ''}" onclick="selectDate('${iso}')">
              <small>${d.toLocaleDateString('es-DO', { weekday: 'short' }).replace('.', '')}</small>
              <strong>${d.getDate()}</strong>
              <small>${d.toLocaleDateString('es-DO', { month: 'short' }).replace('.', '')}</small>
            </button>
          `;
        }).join('')}
      </div>
    </section>

    <section class="cp-step">
      <h2><span class="cp-step-num">4</span> Elige la hora</h2>
      <div id="cpSlots"></div>
    </section>

    <div id="cpSummary"></div>
  `;
}

function renderSlots() {
  const box = document.getElementById('cpSlots');
  if (!box) return;
  const { available, closed, time } = cp.booking;
  if (available === null) {
    box.innerHTML = `<div class="cp-slots-loading">Buscando horarios disponibles…</div>`;
  } else if (closed || !available.length) {
    box.innerHTML = `<div class="cp-empty-inline">${closed ? 'El estudio no abre ese día.' : 'No quedan horarios libres ese día. Prueba otra fecha u otra especialista.'}</div>`;
  } else {
    box.innerHTML = `
      <div class="phone-slots-grid">
        ${available.map(slot => `
          <button type="button" class="phone-slot-pill ${slot === time ? 'selected' : ''}" onclick="selectSlot('${esc(slot)}')">${esc(slot)}</button>
        `).join('')}
      </div>
    `;
  }
  renderSummary();
}

function renderSummary() {
  const box = document.getElementById('cpSummary');
  if (!box) return;
  const { treatmentId, specialistId, date, time } = cp.booking;
  const t = cp.data.treatments.find(x => x.id === treatmentId);
  const s = cp.data.specialists.find(x => x.id === specialistId);
  const ready = t && s && date && time;

  box.innerHTML = `
    <section class="cp-summary ${ready ? 'ready' : ''}">
      ${ready ? `
        <h3>Resumen de tu cita</h3>
        <ul>
          <li><span>Tratamiento</span><strong>${esc(t.name)}</strong></li>
          <li><span>Especialista</span><strong>${esc(s.name)}</strong></li>
          <li><span>Fecha</span><strong>${esc(formatLongDate(date))}</strong></li>
          <li><span>Hora</span><strong>${esc(time)}</strong></li>
          <li><span>Precio</span><strong>${formatMoney(t.price)}</strong></li>
        </ul>
        ${depositNeeded(t) ? `
          <p class="cp-note">Para asegurar tu espacio se requiere un depósito de <strong>${formatMoney(t.depositRequired)}</strong>. El resto se paga al finalizar tu sesión.${studio().depositInstructions ? '' : ' Te contactaremos por WhatsApp con los datos de pago.'}</p>
          ${studio().depositInstructions ? `<div class="cp-deposit"><strong>Datos para el depósito</strong><p class="cp-pre">${esc(studio().depositInstructions)}</p></div>` : ''}
        ` : `
          <p class="cp-note">No necesitas depósito: tu cita queda confirmada y pagas el total de <strong>${formatMoney(t.price)}</strong> al finalizar tu sesión.</p>
        `}
        ${studio().cancellationPolicy ? `<p class="cp-policy"><strong>Política de cancelación:</strong> ${esc(studio().cancellationPolicy)}</p>` : ''}
      ` : `
        <p class="cp-note">Selecciona tratamiento, especialista, día y hora para continuar.</p>
      `}
      <button type="button" class="phone-cta-btn" ${ready && !cp.submitting ? '' : 'disabled'} onclick="submitBooking()">
        <span>${cp.submitting ? 'Reservando…' : 'Confirmar reserva'}</span>
        <span aria-hidden="true">→</span>
      </button>
    </section>
  `;
}

function selectTreatment(id) {
  cp.booking.treatmentId = id;
  document.querySelectorAll('.cp-treatment').forEach(el => {
    el.classList.toggle('selected', el.getAttribute('onclick').includes(`'${id}'`));
  });
  renderSummary();
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
    showToast('¡Listo! Tu cita quedó reservada.');
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
          <strong>🔔 ¿Te avisamos?</strong>
          <p>Recibe una notificación cuando confirmemos tu cita y un recordatorio antes de ella.</p>
        </div>
        <div class="cp-push-actions">
          <button type="button" class="btn-soft btn-sm" onclick="dismissClientPush()">Ahora no</button>
          <button type="button" class="btn-gold btn-sm" onclick="enableClientPush()">Activar</button>
        </div>
      </div>
    `;
  }
  if (cp.pushStatus === 'ios-install') {
    return `
      <div class="cp-push">
        <div>
          <strong>🔔 Recibe avisos de tus citas</strong>
          <p>En iPhone toca <b>Compartir</b> → <b>Añadir a pantalla de inicio</b> y abre Niskin desde ahí para activar las notificaciones.</p>
        </div>
        <div class="cp-push-actions">
          <button type="button" class="btn-soft btn-sm" onclick="dismissClientPush()">Entendido</button>
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
    showToast('¡Listo! Te avisaremos sobre tus citas. 🔔');
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
        <small>${parseISODate(a.date).toLocaleDateString('es-DO', { month: 'short' }).replace('.', '')}</small>
      </div>
      <div class="cp-appt-body">
        <h3>${esc(a.treatmentName)}</h3>
        <p>${esc(formatLongDate(a.date))} • ${esc(a.time)}</p>
        <p>Con ${esc(a.specialistName)} • ${formatMoney(a.price)}</p>
        ${a.status === 'Confirmada' ? `<p class="cp-pay-note">${a.paymentMode === 'al-finalizar'
          ? `Pagas ${formatMoney(a.price)} al finalizar tu sesión.`
          : `Depósito recibido: ${formatMoney(a.depositPaid)}. Resto al finalizar: ${formatMoney(Math.max(0, a.price - a.depositPaid))}.`}</p>` : ''}
        <div class="cp-appt-actions">
          <span class="status-pill ${statusClass(a.status)}"><span class="dot"></span>${esc(a.status)}</span>
          <span class="cp-appt-buttons">
            ${a.status === 'Pendiente Depósito' && studio().whatsapp ? `<button type="button" class="btn-soft btn-sm cp-wa-soft" onclick="sendDepositProof('${esc(a.id)}')">Enviar comprobante</button>` : ''}
            ${allowCancel ? `<button type="button" class="btn-soft btn-sm" onclick="cancelAppointment('${esc(a.id)}')">Cancelar</button>` : ''}
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
      <strong>✨ ¡Tu cita está confirmada!</strong>
      <p>Pagas el total de <strong>${formatMoney(cp.lastBooking.appointment.price)}</strong> al finalizar tu sesión. ¡Te esperamos!</p>
    </div>
  ` : cp.lastBooking ? `
    <div class="cp-success">
      <strong>✨ ¡Tu cita está reservada!</strong>
      <p>Queda <em>pendiente de depósito</em>${cp.lastBooking.depositRequired ? ` (${formatMoney(cp.lastBooking.depositRequired)})` : ''}.
      ${studio().whatsapp ? 'Cuando hagas el depósito, envíanos el comprobante por WhatsApp para confirmarla.' : 'Te escribiremos por WhatsApp para confirmarla.'}</p>
      ${studio().depositInstructions ? `<p class="cp-pre" style="margin-top:8px;">${esc(studio().depositInstructions)}</p>` : ''}
      ${studio().whatsapp ? `<button type="button" class="cp-wa-btn" onclick="sendDepositProof('${esc(cp.lastBooking.appointment.id)}')">Enviar comprobante por WhatsApp</button>` : ''}
    </div>
  ` : '';
  cp.lastBooking = null;

  return `
    ${banner}
    <section class="cp-step">
      <h2>Próximas citas</h2>
      ${upcoming.length ? upcoming.map(a => renderAppointmentCard(a, { allowCancel: ACTIVE_STATUSES.includes(a.status) })).join('') : `
        <div class="cp-empty">
          <p>Aún no tienes citas próximas.</p>
          <button type="button" class="btn-gold" onclick="setClientTab('book')">Agendar una cita</button>
        </div>
      `}
    </section>
    ${studio().whatsapp ? `
      <button type="button" class="cp-help-link" onclick="contactStudio('Hola, tengo una pregunta sobre mi cita.')">¿Dudas sobre tu cita? Escríbenos por WhatsApp</button>
    ` : ''}
    ${past.length ? `
      <section class="cp-step">
        <h2>Historial</h2>
        ${past.map(a => renderAppointmentCard(a, { allowCancel: false })).join('')}
      </section>
    ` : ''}
  `;
}

async function cancelAppointment(id) {
  const appt = cp.data.appointments.find(a => a.id === id);
  if (!appt) return;
  if (!window.confirm(`¿Cancelar tu cita de ${appt.treatmentName} el ${formatLongDate(appt.date)} a las ${appt.time}?`)) return;
  try {
    const result = await api(`/api/client/appointments/${encodeURIComponent(id)}/cancel`, { method: 'POST' });
    Object.assign(appt, result.appointment);
    renderClientPanel();
    showToast('Cita cancelada.');
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
    hydration: 'Hidratación',
    toneUniformity: 'Uniformidad del tono',
    texturePores: 'Textura y poros',
    blemishControl: 'Control de imperfecciones'
  };
  const metrics = Object.entries(p.metrics || {}).filter(([, m]) => m && (m.before || m.current));
  const hasPhotos = p.beforePhoto && p.afterPhoto;

  return `
    <section class="cp-card cp-skin-profile">
      <h2>Mi ficha</h2>
      <ul class="cp-facts">
        <li><span>Biotipo de piel</span><strong>${esc(p.skinBiotype)}</strong></li>
        <li><span>Lo que quiero mejorar</span><strong>${esc(p.mainConcern)}</strong></li>
        <li><span>Alergias</span><strong>${esc(p.allergies)}</strong></li>
      </ul>
    </section>

    ${hasPhotos ? `
      <section class="cp-step">
        <h2>Mi evolución</h2>
        <div class="ba-slider-container" id="cpBaSlider">
          <span class="ba-label ba-label-before">Antes</span>
          <span class="ba-label ba-label-after">Ahora</span>
          <div class="ba-img-layer"><img src="${esc(p.afterPhoto)}" alt="Foto actual"></div>
          <div class="ba-before-clip"><img src="${esc(p.beforePhoto)}" alt="Foto inicial"></div>
          <div class="ba-handle">↔</div>
          <input type="range" class="ba-range-input" min="0" max="100" value="50" aria-label="Comparar antes y después">
        </div>
      </section>
    ` : ''}

    ${metrics.length ? `
      <section class="cp-card">
        <h2>Mi progreso</h2>
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
        <h2>Mi rutina en casa</h2>
        <div class="routine-grid">
          <div class="routine-box"><h4>☀️ Mañana</h4><p class="cp-pre">${esc(p.homeRoutineAM || '—')}</p></div>
          <div class="routine-box"><h4>🌙 Noche</h4><p class="cp-pre">${esc(p.homeRoutinePM || '—')}</p></div>
        </div>
      </section>
    ` : ''}

    <section class="cp-step">
      <h2>Mis sesiones</h2>
      ${p.sessions.length ? `
        <div class="session-timeline">
          ${p.sessions.map(s => `
            <div class="session-card">
              <div class="session-card-top">
                <strong>${esc(s.treatmentName)}</strong>
                <span class="skin-tag">${esc(s.date)}</span>
              </div>
              <p class="cp-muted">Con ${esc(s.specialistName)}</p>
              ${s.activesApplied ? `<p class="cp-muted">Activos: ${esc(s.activesApplied)}</p>` : ''}
            </div>
          `).join('')}
        </div>
      ` : `
        <div class="cp-empty">
          <p>Después de tu primera evaluación verás aquí tu rutina, tus fotos y tu progreso.</p>
        </div>
      `}
    </section>
  `;
}

function initPhotoSlider() {
  const slider = document.getElementById('cpBaSlider');
  if (!slider) return;
  const range = slider.querySelector('.ba-range-input');
  const clip = slider.querySelector('.ba-before-clip');
  const handle = slider.querySelector('.ba-handle');
  const clipImg = clip.querySelector('img');
  const update = () => {
    clip.style.width = `${range.value}%`;
    handle.style.left = `${range.value}%`;
    clipImg.style.width = `${slider.offsetWidth}px`;
  };
  range.addEventListener('input', update);
  window.addEventListener('resize', update);
  update();
}

// ---------------------------------------------------------------------------
// Inicio
// ---------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', async () => {
  loadPublicStudio();
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
