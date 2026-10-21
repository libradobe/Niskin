const STORAGE_KEY = 'niskin_studio_state_v1';
const RENDER_URL_STORAGE_KEY = 'niskin_render_backend_url';
const ADMIN_TOKEN_KEY = 'niskin_admin_token';
const ADMIN_STAFF_KEY = 'niskin_admin_staff';

function getAdminToken() {
  try {
    return localStorage.getItem(ADMIN_TOKEN_KEY) || '';
  } catch (e) {
    return '';
  }
}

function authHeaders(extra = {}) {
  const token = getAdminToken();
  return token ? { ...extra, Authorization: `Bearer ${token}` } : extra;
}

function toISODate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const TODAY = new Date();
const TODAY_ISO = toISODate(TODAY);

function getRenderBaseUrl() {
  let saved = null;
  try {
    saved = localStorage.getItem(RENDER_URL_STORAGE_KEY);
  } catch (e) {}
  const base = saved !== null ? saved : (window.NISKIN_RENDER_URL || '');
  return base.trim().replace(/\/+$/, '');
}

function getApiEndpoint(path = '/api/state') {
  const base = getRenderBaseUrl();
  return base ? `${base}${path}` : path;
}

let state = loadState();

let uiState = {
  currentView: 'dashboard',
  selectedDate: TODAY_ISO,
  calendarMonth: TODAY.getMonth(),
  calendarYear: TODAY.getFullYear(),
  selectedPatientId: state.patients[0]?.id || 'pac-1',
  searchQuery: '',
  agendaFilterStatus: 'Todas',
  inventoryFilter: 'Todos',
  financeFilter: 'Todos',
  serverSynced: false,
  backendLabel: 'Modo Local (Pendiente conectar Render)',
  // Estado del Portal del Cliente (Boceto Móvil 3)
  portalClientId: state.patients[0]?.id || 'pac-1',
  portalTab: 'booking',
  portalSelectedSpecialistId: state.specialists[0]?.id || 'esp-1',
  portalSelectedTreatmentId: state.treatments[1]?.id || 'trat-2',
  portalSelectedDate: toISODate(new Date(TODAY.getTime() + 7 * 24 * 60 * 60 * 1000)),
  portalSelectedSlot: '02:30 PM'
};

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('No se pudo leer localStorage, usando datos iniciales:', e);
  }
  return JSON.parse(JSON.stringify(INITIAL_NISKIN_DATA));
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Error guardando estado en localStorage:', e);
  }

  // Sincronización con el Backend en Render + MongoDB Atlas (solo con sesión de administradora)
  if (!getAdminToken()) return;
  fetch(getApiEndpoint('/api/state'), {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ state })
  })
    .then(res => {
      if (res.status === 401) {
        showAdminGate('Tu sesión expiró. Vuelve a ingresar para guardar los cambios.');
        return null;
      }
      return res.json();
    })
    .then(resp => {
      if (resp && resp.status === 'ok') {
        uiState.serverSynced = true;
        uiState.backendLabel = 'Conectado a Render + MongoDB';
      }
    })
    .catch(() => {
      // Permanece respaldado en localStorage mientras el servidor Render despierta
      showToast('Sin conexión con el servidor: los cambios quedan guardados en este dispositivo.');
    });
}

async function syncFromCloudServer() {
  if (!getAdminToken()) return;

  try {
    const res = await fetch(getApiEndpoint('/api/state'), { cache: 'no-store', headers: authHeaders() });
    if (res.status === 401) {
      showAdminGate('Tu sesión expiró. Ingresa de nuevo.');
      return;
    }
    if (res.ok) {
      const payload = await res.json();
      if (payload && payload.status === 'ok') {
        uiState.serverSynced = true;
        uiState.backendLabel = 'Conectado a Render + MongoDB';
        // No pisar la configuración mientras se está editando
        if (payload.settings && uiState.currentView !== 'settings') uiState.settings = payload.settings;
        if (payload.hasServerData && payload.data) {
          state = payload.data;
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
          } catch (e) {}
          // No re-renderizar mientras hay un formulario abierto
          if (!document.getElementById('modalBackdrop')?.classList.contains('open')) {
            renderWorkspace();
          }
        } else {
          // Si la base de datos MongoDB en Render está vacía, siembra el catálogo inicial de Niskin
          saveState();
        }
      }
    }
  } catch (e) {
    uiState.serverSynced = false;
  }
}

function openRenderConfigModal() {
  // Solo administradoras (o desde la pantalla de acceso si no hay conexión)
  if (getAdminToken() && !isStaffManager()) return;
  const currentUrl = getRenderBaseUrl();
  openModalWithHTML(
    'Conexión Hostinger (Frontend) ↔ Render + MongoDB (Backend)',
    `
      <div style="font-size:0.84rem;color:var(--text-secondary);background:#FAF8F3;padding:12px 14px;border-radius:10px;border:1px solid var(--border-card);">
        <strong>Arquitectura Opción B activa:</strong> Tu interfaz web vive en <strong>Hostinger</strong> y se conecta mediante API a tu servidor Node.js en <strong>Render</strong> + <strong>MongoDB Atlas</strong>.
      </div>
      <div class="form-group">
        <label>URL de tu Web Service en Render</label>
        <input type="url" id="mRenderUrlInput" class="form-control" value="${currentUrl}" placeholder="https://niskin.onrender.com">
        <span style="font-size:0.75rem;color:var(--text-muted);">
          También puedes dejarla fija editando el archivo <code>config.js</code> antes de subirlo a Hostinger.
        </span>
      </div>
      <div id="renderHealthResult" style="font-size:0.82rem;color:var(--text-secondary);"></div>
    `,
    `
      <button class="btn-soft" onclick="closeModal()">Cerrar</button>
      <button class="btn-soft" onclick="testRenderConnection()">🔍 Probar Conexión</button>
      <button class="btn-gold" onclick="saveRenderUrlConfig()">Guardar y Sincronizar</button>
    `
  );
}

async function testRenderConnection() {
  const inputUrl = document.getElementById('mRenderUrlInput').value.trim().replace(/\/+$/, '');
  const statusBox = document.getElementById('renderHealthResult');
  if (!inputUrl) {
    statusBox.innerHTML = `<span style="color:var(--status-danger-text);">Ingresa una URL válida de Render (ej. https://niskin.onrender.com).</span>`;
    return;
  }
  statusBox.innerHTML = `⏳ Verificando conexión con <strong>${inputUrl}/api/health</strong>...`;
  try {
    const res = await fetch(`${inputUrl}/api/health`, { cache: 'no-store' });
    const data = await res.json();
    if (res.ok && data.status === 'ok') {
      statusBox.innerHTML = `<span style="color:var(--status-success-text);font-weight:600;">✅ Servidor Render en línea • MongoDB Atlas: ${data.mongoConnected ? 'Conectado' : 'Pendiente configurar MONGODB_URI en Render'}</span>`;
    } else {
      statusBox.innerHTML = `<span style="color:var(--status-warning-text);">⚠️ El servidor respondió pero revisa la configuración en Render.</span>`;
    }
  } catch (err) {
    statusBox.innerHTML = `<span style="color:var(--status-danger-text);">❌ Aún no se pudo conectar con ${inputUrl}. Verifica que el servicio en Render esté desplegado y activo.</span>`;
  }
}

function saveRenderUrlConfig() {
  const inputUrl = document.getElementById('mRenderUrlInput').value.trim().replace(/\/+$/, '');
  localStorage.setItem(RENDER_URL_STORAGE_KEY, inputUrl);
  window.NISKIN_RENDER_URL = inputUrl;
  closeModal();
  showToast(`URL de Render guardada: ${inputUrl || 'Modo Local'}`);
  syncFromCloudServer();
  renderWorkspace();
}

// ============================================================================
// ACCESO AL PANEL ADMINISTRATIVO
// ============================================================================
function showAdminGate(message) {
  try {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    localStorage.removeItem(ADMIN_STAFF_KEY);
  } catch (e) {}
  uiState.teamList = null;
  document.body.classList.add('admin-locked');
  const workspace = document.getElementById('workspaceContent');
  if (workspace) workspace.innerHTML = '';
  const msg = document.getElementById('adminGateMessage');
  if (msg) {
    msg.textContent = message || '';
    msg.hidden = !message;
  }
  setTimeout(() => document.getElementById('adminPasswordInput')?.focus(), 50);
}

function hideAdminGate() {
  document.body.classList.remove('admin-locked');
}

async function submitAdminLogin(event) {
  event.preventDefault();
  const input = document.getElementById('adminPasswordInput');
  const emailInput = document.getElementById('adminEmailInput');
  const button = document.getElementById('adminLoginBtn');
  const msg = document.getElementById('adminGateMessage');
  const password = input.value;
  const email = emailInput.value.trim();
  if (!password) return;

  button.disabled = true;
  button.textContent = 'Verificando…';
  msg.hidden = true;
  const slowTimer = setTimeout(() => {
    msg.textContent = 'Despertando el servidor… puede tardar hasta un minuto la primera vez.';
    msg.hidden = false;
  }, 4000);

  try {
    const res = await fetch(getApiEndpoint('/api/admin/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.token) {
      throw new Error(data.message || 'No se pudo iniciar sesión.');
    }
    localStorage.setItem(ADMIN_TOKEN_KEY, data.token);
    setCurrentStaff(data.staff);
    input.value = '';
    hideAdminGate();
    switchView(uiState.currentView || 'dashboard');
    refreshPushStatus();
    await syncFromCloudServer();
    showToast(`Bienvenida, ${nameWithoutTitles(data.staff?.name || 'equipo Niskin')[0]}.`);
  } catch (err) {
    const isNetworkError = err instanceof TypeError || err.message === 'Failed to fetch';
    msg.textContent = isNetworkError
      ? 'No se pudo conectar con el servidor. Revisa tu conexión o la URL del servidor.'
      : err.message;
    msg.hidden = false;
    const configBtn = document.getElementById('adminGateConfigBtn');
    if (configBtn && isNetworkError) configBtn.hidden = false;
  } finally {
    clearTimeout(slowTimer);
    button.disabled = false;
    button.textContent = 'Entrar al panel';
  }
}

// ============================================================================
// USUARIA CONECTADA (administradora o cosmetóloga)
// ============================================================================
const STAFF_ROLE_LABELS = {
  administradora: 'Administradora',
  cosmetologa: 'Cosmetóloga'
};

function escapeHTML(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getCurrentStaff() {
  try {
    return JSON.parse(localStorage.getItem(ADMIN_STAFF_KEY) || 'null');
  } catch (e) {
    return null;
  }
}

function isStaffManager() {
  return getCurrentStaff()?.role === 'administradora';
}

function setCurrentStaff(staff) {
  try {
    if (staff) localStorage.setItem(ADMIN_STAFF_KEY, JSON.stringify(staff));
  } catch (e) {}
  applyStaffToUI();
}

function applyStaffToUI() {
  const staff = getCurrentStaff();
  const name = staff?.name || 'Equipo Niskin';
  const initials = getInitials(name);
  const roleLabel = staff?.isMaster ? 'Contraseña maestra' : (STAFF_ROLE_LABELS[staff?.role] || 'Panel del estudio');
  const setText = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };
  setText('sidebarStaffName', name);
  setText('sidebarStaffRole', roleLabel);
  setText('sidebarAvatar', initials);
  setText('topbarAvatar', initials);
  document.querySelectorAll('.manager-only').forEach(el => {
    el.hidden = !isStaffManager();
  });
  if (uiState.currentView === 'team' && !isStaffManager()) switchView('dashboard');
}

async function refreshCurrentStaff() {
  if (!getAdminToken()) return;
  try {
    const res = await fetch(getApiEndpoint('/api/admin/me'), { cache: 'no-store', headers: authHeaders() });
    if (res.status === 401) {
      showAdminGate('Tu sesión terminó o tu acceso fue desactivado. Ingresa de nuevo.');
      return;
    }
    const data = await res.json();
    if (data.staff) setCurrentStaff(data.staff);
  } catch (e) {}
}

async function adminApi(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(getApiEndpoint(path), {
      method,
      cache: 'no-store',
      headers: authHeaders(body ? { 'Content-Type': 'application/json' } : {}),
      body: body ? JSON.stringify(body) : undefined
    });
  } catch (e) {
    throw new Error('No se pudo conectar con el servidor. Intenta de nuevo.');
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    showAdminGate('Tu sesión expiró. Ingresa de nuevo.');
    throw new Error(data.message || 'Sesión expirada.');
  }
  if (!res.ok) throw new Error(data.message || 'Ocurrió un error.');
  return data;
}

function generateTempPassword() {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const values = new Uint32Array(10);
  crypto.getRandomValues(values);
  return Array.from(values, v => chars[v % chars.length]).join('');
}

function fillTempPassword(inputId) {
  const input = document.getElementById(inputId);
  input.type = 'text';
  input.value = generateTempPassword();
  input.select();
}

function openMyAccountModal() {
  const staff = getCurrentStaff() || {};
  const isMaster = staff.isMaster || staff.id === 'owner';
  openModalWithHTML(
    'Mi cuenta',
    `
      <div class="team-account-head">
        <div class="avatar-circle" style="width:52px;height:52px;font-size:1.05rem;">${escapeHTML(getInitials(staff.name || 'Equipo Niskin'))}</div>
        <div>
          <h4 style="font-size:1rem;">${escapeHTML(staff.name || 'Equipo Niskin')}</h4>
          <p style="font-size:0.82rem;color:var(--text-secondary);">${isMaster ? 'Acceso con contraseña maestra' : `${escapeHTML(STAFF_ROLE_LABELS[staff.role] || '')} • ${escapeHTML(staff.email || '')}`}</p>
        </div>
      </div>
      <div id="pushStatusBox" class="push-account-box">
        <h4 style="font-size:0.92rem;">Notificaciones en este dispositivo</h4>
        <p style="font-size:0.82rem;color:var(--text-secondary);">${escapeHTML(pushStatusText(uiState.pushStatus))}</p>
        ${uiState.pushStatus === 'available' ? '<button type="button" class="btn-gold btn-sm" onclick="enableStaffPush()">🔔 Activar notificaciones</button>' : ''}
        ${uiState.pushStatus === 'enabled' ? '<button type="button" class="btn-soft btn-sm" onclick="disableStaffPush()">Desactivar en este dispositivo</button>' : ''}
      </div>
      ${isMaster ? `
        <p class="form-message success">Estás usando la contraseña maestra. Para mayor seguridad, crea tu propia cuenta de administradora en <strong>Equipo y Accesos</strong> y úsala a diario.</p>
      ` : `
        <h4 style="font-size:0.92rem;margin-top:4px;">Cambiar mi contraseña</h4>
        <div class="form-group">
          <label for="mMyCurrentPass">Contraseña actual</label>
          <input type="password" id="mMyCurrentPass" class="form-control" autocomplete="current-password">
        </div>
        <div class="form-group">
          <label for="mMyNewPass">Nueva contraseña (mínimo 8 caracteres)</label>
          <input type="password" id="mMyNewPass" class="form-control" autocomplete="new-password">
        </div>
        <p id="mMyAccountMsg" class="form-message" hidden></p>
      `}
    `,
    `
      <button class="btn-soft" onclick="adminLogout()">Cerrar sesión</button>
      ${isMaster ? '' : '<button class="btn-gold" onclick="saveMyPassword()">Guardar contraseña</button>'}
    `
  );
}

async function saveMyPassword() {
  const msg = document.getElementById('mMyAccountMsg');
  const currentPassword = document.getElementById('mMyCurrentPass').value;
  const newPassword = document.getElementById('mMyNewPass').value;
  if (newPassword.length < 8) {
    msg.textContent = 'La nueva contraseña debe tener al menos 8 caracteres.';
    msg.hidden = false;
    return;
  }
  try {
    await adminApi('/api/admin/me/password', { method: 'POST', body: { currentPassword, newPassword } });
    closeModal();
    showToast('Contraseña actualizada.');
  } catch (err) {
    msg.textContent = err.message;
    msg.hidden = false;
  }
}

// ============================================================================
// VISTA EQUIPO Y ACCESOS (solo administradoras)
// ============================================================================
async function loadTeam() {
  uiState.teamLoading = true;
  try {
    const data = await adminApi('/api/admin/staff');
    uiState.teamList = data.staff;
    uiState.teamError = '';
  } catch (err) {
    uiState.teamError = err.message;
    uiState.teamList = uiState.teamList || [];
  } finally {
    uiState.teamLoading = false;
  }
  if (uiState.currentView === 'team') renderWorkspace();
}

function renderTeamView() {
  if (!isStaffManager()) {
    return `<div class="surface-card" style="padding:28px;">Solo una administradora puede gestionar el equipo.</div>`;
  }
  if (uiState.teamList === null || uiState.teamList === undefined) {
    if (!uiState.teamLoading) loadTeam();
    return `<div class="surface-card" style="padding:28px;color:var(--text-secondary);">Cargando equipo…</div>`;
  }

  const me = getCurrentStaff() || {};
  const specialistName = id => state.specialists.find(s => s.id === id)?.name || '';
  const list = uiState.teamList;

  return `
    <div class="action-bar">
      <span style="font-size:0.85rem;color:var(--text-secondary);max-width:620px;">
        Crea un acceso para cada cosmetóloga. Las <strong>administradoras</strong> además pueden gestionar el equipo. Desactiva una cuenta para quitarle el acceso al instante.
      </span>
      <button class="btn-gold" onclick="openNewStaffModal()">
        <span>＋</span> Nueva cuenta
      </button>
    </div>

    ${uiState.teamError ? `<p class="form-message" style="margin-bottom:16px;">${escapeHTML(uiState.teamError)}</p>` : ''}

    <div class="surface-card">
      <div class="card-header">
        <h2>Equipo con acceso al panel (${list.length})</h2>
      </div>
      <div class="card-subhead" style="grid-template-columns: 2fr 1.2fr 1.3fr 1fr 150px;">
        <span>Nombre / Correo</span>
        <span>Rol</span>
        <span>Perfil en agenda</span>
        <span>Estado</span>
        <span style="text-align:right;">Acciones</span>
      </div>
      <div class="list-rows">
        ${list.length ? list.map(member => {
          const isSelf = member.id === me.id;
          return `
            <div class="list-row" style="grid-template-columns: 2fr 1.2fr 1.3fr 1fr 150px;">
              <div class="row-entity">
                <div class="avatar-circle" style="width:38px;height:38px;font-size:0.82rem;">${escapeHTML(getInitials(member.name))}</div>
                <div class="entity-text" style="min-width:0;">
                  <h4>${escapeHTML(member.name)}${isSelf ? ' (tú)' : ''}</h4>
                  <p>${escapeHTML(member.email)}</p>
                </div>
              </div>
              <div>
                <select class="form-control team-role-select" ${isSelf ? 'disabled' : ''} onchange="updateStaff('${escapeHTML(member.id)}', { role: this.value })" aria-label="Rol de ${escapeHTML(member.name)}">
                  <option value="cosmetologa" ${member.role === 'cosmetologa' ? 'selected' : ''}>Cosmetóloga</option>
                  <option value="administradora" ${member.role === 'administradora' ? 'selected' : ''}>Administradora</option>
                </select>
              </div>
              <div class="entity-text">
                <p>${member.specialistId && specialistName(member.specialistId) ? `Agenda: ${escapeHTML(specialistName(member.specialistId))}` : 'Sin perfil en agenda'}</p>
              </div>
              <div>
                <span class="status-pill ${member.active ? 'status-confirmed' : 'status-danger'}"><span class="dot"></span>${member.active ? 'Activa' : 'Desactivada'}</span>
                <div style="font-size:0.72rem;color:var(--text-muted);margin-top:3px;">
                  ${member.lastLoginAt ? `Último acceso: ${new Date(member.lastLoginAt).toLocaleDateString('es-DO')}` : 'Aún no ha entrado'}
                </div>
              </div>
              <div class="row-actions">
                <button class="btn-soft btn-sm" onclick="openResetStaffPasswordModal('${escapeHTML(member.id)}')">Contraseña</button>
                ${isSelf ? '' : `
                  <button class="btn-soft btn-sm" onclick="updateStaff('${escapeHTML(member.id)}', { active: ${!member.active} })">
                    ${member.active ? 'Desactivar' : 'Activar'}
                  </button>
                `}
              </div>
            </div>
          `;
        }).join('') : `
          <div style="padding:28px;text-align:center;color:var(--text-secondary);">
            Todavía no hay cuentas del equipo. Crea la primera con <strong>Nueva cuenta</strong>.
          </div>
        `}
      </div>
    </div>
  `;
}

function openNewStaffModal() {
  const linked = new Set((uiState.teamList || []).map(m => m.specialistId).filter(Boolean));
  const freeSpecialists = state.specialists.filter(s => !linked.has(s.id));
  openModalWithHTML(
    'Nueva cuenta del equipo',
    `
      <div class="form-group">
        <label for="mStaffName">Nombre completo</label>
        <input id="mStaffName" class="form-control" maxlength="80" placeholder="Ej. Lic. Ana Rodríguez">
      </div>
      <div class="form-group">
        <label for="mStaffEmail">Correo (lo usará para entrar)</label>
        <input id="mStaffEmail" type="email" class="form-control" maxlength="120" placeholder="ana@ejemplo.com">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label for="mStaffRole">Rol</label>
          <select id="mStaffRole" class="form-control">
            <option value="cosmetologa">Cosmetóloga</option>
            <option value="administradora">Administradora</option>
          </select>
        </div>
        <div class="form-group">
          <label for="mStaffPass">Contraseña temporal</label>
          <div style="display:flex;gap:6px;">
            <input id="mStaffPass" type="text" class="form-control" style="flex:1;min-width:0;" autocomplete="off" placeholder="Mínimo 8">
            <button type="button" class="btn-soft btn-sm" onclick="fillTempPassword('mStaffPass')">Generar</button>
          </div>
        </div>
      </div>
      <div class="form-group">
        <label for="mStaffSpecialist">Perfil en la agenda y reservas online</label>
        <select id="mStaffSpecialist" class="form-control" onchange="document.getElementById('mStaffNewSpecFields').hidden = this.value !== 'new'">
          <option value="new">Crear perfil nuevo (aparecerá para reservar)</option>
          ${freeSpecialists.map(s => `<option value="${escapeHTML(s.id)}">Vincular a: ${escapeHTML(s.name)}</option>`).join('')}
          <option value="none">Sin perfil (solo administración)</option>
        </select>
      </div>
      <div id="mStaffNewSpecFields" class="form-row">
        <div class="form-group">
          <label for="mStaffSpecRole">Cargo</label>
          <input id="mStaffSpecRole" class="form-control" maxlength="80" placeholder="Ej. Cosmetóloga Facial">
        </div>
        <div class="form-group">
          <label for="mStaffSpecialty">Especialidad</label>
          <input id="mStaffSpecialty" class="form-control" maxlength="120" placeholder="Ej. Peelings y acné">
        </div>
      </div>
      <p class="admin-gate-hint" style="text-align:left;">Comparte el correo y la contraseña temporal con ella. Podrá cambiarla desde <strong>Mi cuenta</strong>.</p>
      <p id="mStaffMsg" class="form-message" hidden></p>
    `,
    `
      <button class="btn-soft" onclick="closeModal()">Cancelar</button>
      <button class="btn-gold" id="mStaffSaveBtn" onclick="saveNewStaff()">Crear cuenta</button>
    `
  );
}

async function saveNewStaff() {
  const msg = document.getElementById('mStaffMsg');
  const btn = document.getElementById('mStaffSaveBtn');
  const specValue = document.getElementById('mStaffSpecialist').value;
  const body = {
    name: document.getElementById('mStaffName').value.trim(),
    email: document.getElementById('mStaffEmail').value.trim(),
    role: document.getElementById('mStaffRole').value,
    password: document.getElementById('mStaffPass').value,
    specialistMode: specValue === 'new' || specValue === 'none' ? specValue : 'existing',
    specialistId: specValue === 'new' || specValue === 'none' ? '' : specValue,
    specialistRole: document.getElementById('mStaffSpecRole').value.trim(),
    specialty: document.getElementById('mStaffSpecialty').value.trim()
  };
  if (body.password.length < 8) {
    msg.textContent = 'La contraseña temporal debe tener al menos 8 caracteres (usa “Generar”).';
    msg.hidden = false;
    return;
  }
  btn.disabled = true;
  try {
    const data = await adminApi('/api/admin/staff', { method: 'POST', body });
    uiState.teamList = [...(uiState.teamList || []), data.staff];
    showStaffCredentials(data.staff.name, data.staff.email, body.password);
    await syncFromCloudServer();
    renderWorkspace();
  } catch (err) {
    msg.textContent = err.message;
    msg.hidden = false;
  } finally {
    btn.disabled = false;
  }
}

function showStaffCredentials(name, email, password) {
  const loginUrl = `${window.location.origin}${window.location.pathname}`;
  const message = `Hola ${nameWithoutTitles(name)[0]}, ya tienes acceso al panel de Niskin Beauty Studio.\nEntra en: ${loginUrl}\nCorreo: ${email}\nContraseña temporal: ${password}\nPuedes cambiarla en "Mi cuenta".`;
  uiState.pendingCredentials = message;
  openModalWithHTML(
    'Cuenta lista',
    `
      <p class="form-message success">La cuenta de <strong>${escapeHTML(name)}</strong> está activa. Envíale estos datos por un medio privado (por ejemplo, WhatsApp).</p>
      <ul class="cp-facts team-credentials">
        <li><span>Correo</span><strong>${escapeHTML(email)}</strong></li>
        <li><span>Contraseña temporal</span><strong>${escapeHTML(password)}</strong></li>
      </ul>
      <p class="admin-gate-hint" style="text-align:left;">Por seguridad, esta contraseña no se volverá a mostrar. Si se pierde, crea una nueva desde “Contraseña”.</p>
    `,
    `
      <button class="btn-soft" onclick="copyPendingCredentials()">Copiar mensaje</button>
      <button class="btn-gold" onclick="closeModal()">Listo</button>
    `
  );
}

async function copyPendingCredentials() {
  try {
    await navigator.clipboard.writeText(uiState.pendingCredentials || '');
    showToast('Mensaje copiado. Pégalo en WhatsApp.');
  } catch (e) {
    showToast('No se pudo copiar automáticamente; copia los datos manualmente.');
  }
}

async function updateStaff(staffId, changes) {
  try {
    const data = await adminApi(`/api/admin/staff/${encodeURIComponent(staffId)}`, { method: 'PATCH', body: changes });
    uiState.teamList = (uiState.teamList || []).map(m => (m.id === staffId ? data.staff : m));
    if ('active' in changes) showToast(changes.active ? `${data.staff.name} puede volver a entrar.` : `${data.staff.name} ya no tiene acceso.`);
    if ('role' in changes) showToast(`${data.staff.name} ahora es ${STAFF_ROLE_LABELS[data.staff.role]}.`);
  } catch (err) {
    showToast(err.message);
  }
  renderWorkspace();
}

function openResetStaffPasswordModal(staffId) {
  const member = (uiState.teamList || []).find(m => m.id === staffId);
  if (!member) return;
  openModalWithHTML(
    `Nueva contraseña para ${member.name}`,
    `
      <div class="form-group">
        <label for="mResetPass">Contraseña temporal (mínimo 8 caracteres)</label>
        <div style="display:flex;gap:6px;">
          <input id="mResetPass" type="text" class="form-control" style="flex:1;min-width:0;" autocomplete="off">
          <button type="button" class="btn-soft btn-sm" onclick="fillTempPassword('mResetPass')">Generar</button>
        </div>
      </div>
      <p class="admin-gate-hint" style="text-align:left;">Su contraseña anterior dejará de funcionar. Compártele la nueva.</p>
      <p id="mResetMsg" class="form-message" hidden></p>
    `,
    `
      <button class="btn-soft" onclick="closeModal()">Cancelar</button>
      <button class="btn-gold" onclick="saveStaffPassword('${escapeHTML(staffId)}')">Guardar</button>
    `
  );
}

async function saveStaffPassword(staffId) {
  const msg = document.getElementById('mResetMsg');
  const password = document.getElementById('mResetPass').value;
  if (password.length < 8) {
    msg.textContent = 'La contraseña debe tener al menos 8 caracteres.';
    msg.hidden = false;
    return;
  }
  try {
    await adminApi(`/api/admin/staff/${encodeURIComponent(staffId)}`, { method: 'PATCH', body: { password } });
    const member = (uiState.teamList || []).find(m => m.id === staffId);
    showStaffCredentials(member?.name || '', member?.email || '', password);
  } catch (err) {
    msg.textContent = err.message;
    msg.hidden = false;
  }
}

// ============================================================================
// WHATSAPP (wa.me)
// ============================================================================
function studioSettings() {
  return uiState.settings || {};
}

function formatDateShort(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const sameYear = y === new Date().getFullYear();
  return date.toLocaleDateString('es-DO', { weekday: 'short', day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) }).replace(/\./g, '');
}

function formatDateLong(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  const text = new Date(y, m - 1, d).toLocaleDateString('es-DO', { weekday: 'long', day: 'numeric', month: 'long' });
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function clientDateLong(iso) {
  if (uiState.settings?.language !== 'en') return formatDateLong(iso);
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

// Mensajes de WhatsApp para la clienta, en el idioma elegido en Configuración (sin emojis:
// algunos teléfonos Android los muestran como �)
const WA_TEXT = {
  es: {
    date: 'Fecha', specialist: 'Especialista', address: 'Dirección', at: 'a las',
    pending: (n, b, details, dep, instr) => [
      `Hola ${n}, te escribimos de ${b}.`,
      `Recibimos tu reserva:\n${details}`,
      `Para confirmarla, realiza el depósito de *${dep}*${instr ? `:\n${instr}` : '.'}`,
      'Cuando lo hagas, envíanos el comprobante por aquí. ¡Gracias!'
    ],
    confirmed: (n, b, details, payText) => [
      `Hola ${n}, tu cita en ${b} está confirmada:`, details, payText,
      '¡Te esperamos! Si necesitas reprogramar, responde a este mensaje.'
    ],
    payAtEnd: total => `El pago de *${total}* se realiza al finalizar tu sesión.`,
    payRest: (dep, rest) => `Ya recibimos tu depósito de ${dep}. El resto (*${rest}*) se paga al finalizar tu sesión.`,
    cancelled: (n, t, when) => `Hola ${n}, tu cita de *${t}* del ${when} quedó cancelada. Si quieres reprogramarla, respóndenos por aquí y buscamos otro horario.`,
    followUp: (n, b, t) => `Hola ${n}, gracias por visitarnos en ${b}. ¿Cómo sentiste tu piel después de tu sesión de *${t}*? Cualquier duda, escríbenos.`,
    hello: (n, b) => `Hola ${n}, te escribimos de ${b}.`
  },
  en: {
    date: 'Date', specialist: 'Specialist', address: 'Address', at: 'at',
    pending: (n, b, details, dep, instr) => [
      `Hi ${n}, this is ${b}.`,
      `We received your booking:\n${details}`,
      `To confirm it, please send the *${dep}* deposit${instr ? `:\n${instr}` : '.'}`,
      'Once done, send us the receipt here. Thank you!'
    ],
    confirmed: (n, b, details, payText) => [
      `Hi ${n}, your appointment at ${b} is confirmed:`, details, payText,
      'See you soon! If you need to reschedule, just reply to this message.'
    ],
    payAtEnd: total => `You pay *${total}* after your session.`,
    payRest: (dep, rest) => `We received your ${dep} deposit. The balance (*${rest}*) is paid after your session.`,
    cancelled: (n, t, when) => `Hi ${n}, your *${t}* appointment on ${when} was cancelled. Reply here if you would like to reschedule.`,
    followUp: (n, b, t) => `Hi ${n}, thank you for visiting ${b}. How does your skin feel after your *${t}* session? Message us with any questions.`,
    hello: (n, b) => `Hi ${n}, this is ${b}.`
  }
};

function waText() {
  return WA_TEXT[uiState.settings?.language] || WA_TEXT.es;
}

function buildAppointmentWhatsApp(app, patient) {
  const st = studioSettings();
  const T = waText();
  const business = st.businessName || 'Niskin Beauty Studio';
  const firstName = nameWithoutTitles(patient?.name || app.patientName)[0] || '';
  const when = `${clientDateLong(app.date)} ${T.at} ${app.time}`;
  const treatment = state.treatments.find(t => t.id === app.treatmentId);
  const details = [
    `*${app.treatmentName}*`,
    `${T.date}: ${when}`,
    `${T.specialist}: ${app.specialistName}`,
    st.address ? `${T.address}: ${st.address}` : ''
  ].filter(Boolean).join('\n');

  if (app.status === 'Pendiente Depósito') {
    const amount = depositForTreatment(treatment) || treatment?.depositRequired || 0;
    return T.pending(firstName, business, details, formatMoney(amount), st.depositInstructions).join('\n\n');
  }
  if (app.status === 'Confirmada') {
    const payText = isPayAtEnd(app)
      ? T.payAtEnd(formatMoney(app.price))
      : T.payRest(formatMoney(app.depositPaid), formatMoney(Math.max(0, app.price - app.depositPaid)));
    return T.confirmed(firstName, business, details, payText).join('\n\n');
  }
  if (app.status === 'Cancelada') return T.cancelled(firstName, app.treatmentName, when);
  return T.followUp(firstName, business, app.treatmentName);
}

function sendAppointmentWhatsApp(appointmentId) {
  const app = state.appointments.find(a => a.id === appointmentId);
  if (!app) return;
  const patient = state.patients.find(p => p.id === app.patientId);
  if (!patient?.phone) {
    showToast('Esta clienta no tiene teléfono registrado. Se abrirá WhatsApp para elegir el contacto.');
  }
  NiskinWhatsApp.open(patient?.phone, buildAppointmentWhatsApp(app, patient));
}

function sendPatientWhatsApp(patientId) {
  const patient = state.patients.find(p => p.id === patientId);
  if (!patient) return;
  const st = studioSettings();
  NiskinWhatsApp.open(patient.phone, waText().hello(nameWithoutTitles(patient.name)[0], st.businessName || 'Niskin Beauty Studio'));
}

// ============================================================================
// ELIMINAR CLIENTAS, CITAS Y TRATAMIENTOS
// ============================================================================
function canDelete(kind) {
  // Clientas (expedientes): solo administradoras. Citas y tratamientos: todo el equipo.
  return kind === 'patient' ? isStaffManager() : Boolean(getAdminToken());
}

function persistLocalState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {}
}

function askDelete(kind, id) {
  if (!canDelete(kind)) {
    showToast('Solo una administradora puede eliminar esto.');
    return;
  }
  let title = '';
  let detail = '';
  if (kind === 'appointment') {
    const a = state.appointments.find(x => x.id === id);
    if (!a) return;
    title = 'Eliminar cita';
    detail = `Se eliminará la cita de <strong>${escapeHTML(a.patientName)}</strong> (${escapeHTML(a.treatmentName)}, ${escapeHTML(a.date)} ${escapeHTML(a.time)}).${ACTIVE_APPOINTMENT_STATUSES.includes(a.status) ? ' Si la clienta tiene notificaciones activas, se le avisará que fue cancelada.' : ''} Los movimientos de Finanzas no se borran.`;
  } else if (kind === 'patient') {
    const p = state.patients.find(x => x.id === id);
    if (!p) return;
    const count = state.appointments.filter(a => a.patientId === id).length;
    title = 'Eliminar clienta';
    detail = `Se eliminará el expediente de <strong>${escapeHTML(p.name)}</strong>, sus fotos, sesiones y ${count} cita(s). Si tiene cuenta en la página de clientas, ya no podrá entrar. Los movimientos de Finanzas no se borran.`;
  } else if (kind === 'treatment') {
    const t = state.treatments.find(x => x.id === id);
    if (!t) return;
    title = 'Eliminar tratamiento';
    detail = `<strong>${escapeHTML(t.name)}</strong> dejará de aparecer en la agenda y en las reservas online. Las citas existentes conservan su nombre.`;
  }
  uiState.pendingDelete = { kind, id };
  openModalWithHTML(
    title,
    `
      <p style="font-size:0.9rem;">${detail}</p>
      <p class="form-message">Esta acción no se puede deshacer.</p>
    `,
    `
      <button class="btn-soft" onclick="closeModal()">Cancelar</button>
      <button class="btn-danger" id="confirmDeleteBtn" onclick="performDelete()">Eliminar</button>
    `
  );
}

const ACTIVE_APPOINTMENT_STATUSES = ['Confirmada', 'Pendiente Depósito'];

async function performDelete() {
  const pending = uiState.pendingDelete;
  if (!pending) return;
  const btn = document.getElementById('confirmDeleteBtn');
  if (btn) btn.disabled = true;
  const paths = {
    appointment: '/api/admin/appointments/',
    patient: '/api/admin/patients/',
    treatment: '/api/admin/treatments/'
  };
  try {
    await adminApi(`${paths[pending.kind]}${encodeURIComponent(pending.id)}`, { method: 'DELETE' });
    if (pending.kind === 'appointment') {
      state.appointments = state.appointments.filter(a => a.id !== pending.id);
      showToast('Cita eliminada.');
    } else if (pending.kind === 'patient') {
      state.patients = state.patients.filter(p => p.id !== pending.id);
      state.appointments = state.appointments.filter(a => a.patientId !== pending.id);
      if (uiState.selectedPatientId === pending.id) uiState.selectedPatientId = state.patients[0]?.id || '';
      if (uiState.portalClientId === pending.id) uiState.portalClientId = state.patients[0]?.id || '';
      showToast('Clienta eliminada.');
    } else if (pending.kind === 'treatment') {
      state.treatments = state.treatments.filter(t => t.id !== pending.id);
      showToast('Tratamiento eliminado.');
    }
    uiState.pendingDelete = null;
    persistLocalState();
    closeModal();
    renderWorkspace();
  } catch (err) {
    showToast(err.message);
    if (btn) btn.disabled = false;
  }
}

// ============================================================================
// CONFIGURACIÓN DEL NEGOCIO (administradoras y cosmetólogas)
// ============================================================================
const WEEKDAY_LABELS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

async function loadSettings() {
  try {
    const data = await adminApi('/api/admin/settings');
    uiState.settings = data.settings;
  } catch (err) {
    uiState.settingsError = err.message;
  }
  if (uiState.currentView === 'settings') renderWorkspace();
}

function timeInputToSlot(value) {
  const [h, m] = String(value || '').split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return '';
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${suffix}`;
}

function slotMinutes(slot) {
  const m = /^(\d{2}):(\d{2}) (AM|PM)$/.exec(slot || '');
  if (!m) return 0;
  return ((Number(m[1]) % 12) + (m[3] === 'PM' ? 12 : 0)) * 60 + Number(m[2]);
}

function renderSettingsView() {
  if (!uiState.settings) {
    if (!uiState.settingsLoading) {
      uiState.settingsLoading = true;
      loadSettings().finally(() => { uiState.settingsLoading = false; });
    }
    return `<div class="surface-card" style="padding:28px;color:var(--text-secondary);">Cargando configuración…</div>`;
  }
  const st = uiState.settings;
  const weekly = weeklySchedule();
  const depositType = st.depositType || 'treatment';
  const clientUrl = `${window.location.origin}${window.location.pathname.replace(/[^/]*$/, '')}clientes.html`;
  const sampleTreatment = state.treatments[0];

  return `
    <form class="settings-grid" onsubmit="saveSettings(event)" oninput="updateSettingsPreview()">
      <section class="surface-card settings-card">
        <h2>Tu negocio</h2>
        <p class="settings-help">Así aparece tu estudio en la página de clientas y en los mensajes.</p>
        <div class="form-group">
          <label for="sBusinessName">Nombre del negocio</label>
          <input id="sBusinessName" class="form-control" maxlength="80" value="${escapeHTML(st.businessName)}" required>
        </div>
        <div class="form-group">
          <label for="sTagline">Frase corta</label>
          <input id="sTagline" class="form-control" maxlength="120" value="${escapeHTML(st.tagline)}" placeholder="Ej. Cosmetología clínica y cuidado facial">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="sCity">Ciudad</label>
            <input id="sCity" class="form-control" maxlength="80" value="${escapeHTML(st.city)}">
          </div>
          <div class="form-group">
            <label for="sInstagram">Instagram</label>
            <input id="sInstagram" class="form-control" maxlength="60" value="${escapeHTML(st.instagram)}" placeholder="@niskinbeauty">
          </div>
        </div>
        <div class="form-group">
          <label for="sAddress">Dirección</label>
          <input id="sAddress" class="form-control" maxlength="160" value="${escapeHTML(st.address)}" placeholder="Calle, número, sector">
        </div>
        <div class="form-group">
          <label for="sWelcome">Mensaje de bienvenida en la página de clientas</label>
          <textarea id="sWelcome" class="form-control" rows="2" maxlength="600" placeholder="Ej. Agenda tu cita en minutos y recibe la confirmación por WhatsApp.">${escapeHTML(st.welcomeMessage)}</textarea>
        </div>
      </section>

      <section class="surface-card settings-card">
        <h2>Moneda e idioma</h2>
        <div class="form-group">
          <label for="sCurrency">Moneda</label>
          <select id="sCurrency" class="form-control">
            ${Object.entries(CURRENCIES).map(([code, c]) => `<option value="${code}" ${st.currency === code ? 'selected' : ''}>${escapeHTML(c.label)}</option>`).join('')}
          </select>
          <span class="settings-help" style="margin-top:2px;">Cambia el símbolo en precios, cobros y mensajes. No convierte los montos ya guardados.</span>
        </div>
        <div class="form-group">
          <label for="sLanguage">Idioma de la página de clientas</label>
          <select id="sLanguage" class="form-control">
            <option value="es" ${st.language !== 'en' ? 'selected' : ''}>Español</option>
            <option value="en" ${st.language === 'en' ? 'selected' : ''}>English</option>
          </select>
          <span class="settings-help" style="margin-top:2px;">Se aplica a la página de reservas, sus notificaciones y los mensajes de WhatsApp a clientas. El panel del equipo sigue en español.</span>
        </div>
      </section>

      <section class="surface-card settings-card">
        <h2>Cobro de la reservación</h2>
        <label class="settings-switch">
          <input type="checkbox" id="sRequireDeposit" ${st.requireDeposit !== false ? 'checked' : ''} onchange="updateSettingsPreview()">
          <span>Cobrar un depósito para reservar en línea</span>
        </label>
        <div id="sDepositFields" class="settings-deposit-fields" ${st.requireDeposit === false ? 'hidden' : ''}>
          <div class="form-row">
            <div class="form-group">
              <label for="sDepositType">Monto del depósito</label>
              <select id="sDepositType" class="form-control" onchange="updateSettingsPreview()">
                <option value="treatment" ${depositType === 'treatment' ? 'selected' : ''}>El de cada tratamiento</option>
                <option value="fixed" ${depositType === 'fixed' ? 'selected' : ''}>Monto fijo</option>
                <option value="percent" ${depositType === 'percent' ? 'selected' : ''}>Porcentaje del precio</option>
              </select>
            </div>
            <div class="form-group" id="sDepositValueGroup" ${depositType === 'treatment' ? 'hidden' : ''}>
              <label for="sDepositValue" id="sDepositValueLabel">${depositType === 'percent' ? 'Porcentaje (%)' : `Monto (${escapeHTML(currentCurrency().symbol)})`}</label>
              <input id="sDepositValue" type="number" min="0" ${depositType === 'percent' ? 'max="100"' : ''} class="form-control" value="${escapeHTML(st.depositValue || 0)}">
            </div>
          </div>
          <div class="form-group">
            <label for="sDeposit">Datos para el depósito</label>
            <textarea id="sDeposit" class="form-control" rows="3" maxlength="600" placeholder="Banco Popular — Cuenta de ahorros 000000000 — A nombre de ...">${escapeHTML(st.depositInstructions)}</textarea>
          </div>
        </div>
        <p id="sDepositPreview" class="settings-preview"></p>
        <div class="form-group">
          <label for="sWhatsapp">WhatsApp del estudio</label>
          <input id="sWhatsapp" class="form-control" type="tel" inputmode="tel" maxlength="20" value="${escapeHTML(st.whatsapp)}" placeholder="809-555-0123">
          <span class="settings-help" style="margin-top:2px;">Las clientas lo usan para enviarte el comprobante y escribirte.</span>
        </div>
        <div class="form-group">
          <label for="sPolicy">Política de cancelación</label>
          <textarea id="sPolicy" class="form-control" rows="2" maxlength="600" placeholder="Ej. Cancela con al menos 24 horas para conservar tu depósito.">${escapeHTML(st.cancellationPolicy)}</textarea>
        </div>
        ${sampleTreatment ? '' : ''}
      </section>

      <section class="surface-card settings-card">
        <h2>Horario laboral</h2>
        <p class="settings-help">Marca los días que abres y su horario. Las clientas solo verán horas dentro de este horario.</p>
        <div class="settings-week">
          ${[1, 2, 3, 4, 5, 6, 0].map(d => {
            const day = weekly.find(w => w.day === d) || { open: false, start: '09:00', end: '18:00' };
            return `
              <div class="settings-weekday ${day.open ? '' : 'is-closed'}" data-day="${d}">
                <label class="settings-weekday-name">
                  <input type="checkbox" class="sDayOpen" ${day.open ? 'checked' : ''} onchange="this.closest('.settings-weekday').classList.toggle('is-closed', !this.checked)">
                  <span>${WEEKDAY_LABELS[d]}</span>
                </label>
                <div class="settings-weekday-hours">
                  <input type="time" class="form-control sDayStart" value="${escapeHTML(day.start)}" aria-label="Apertura ${WEEKDAY_LABELS[d]}">
                  <span>a</span>
                  <input type="time" class="form-control sDayEnd" value="${escapeHTML(day.end)}" aria-label="Cierre ${WEEKDAY_LABELS[d]}">
                </div>
                <span class="settings-weekday-closed">Cerrado</span>
              </div>
            `;
          }).join('')}
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="sSlotInterval">Ofrecer horarios cada</label>
            <select id="sSlotInterval" class="form-control">
              ${[15, 20, 30, 45, 60, 90].map(m => `<option value="${m}" ${(Number(st.slotInterval) || 30) === m ? 'selected' : ''}>${m} minutos</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label for="sMinHours">Anticipación mínima (horas)</label>
            <input id="sMinHours" type="number" min="0" max="72" class="form-control" value="${escapeHTML(st.minHoursNotice)}">
          </div>
        </div>
        <p class="settings-help">Cada cita bloquea el tiempo que dura su tratamiento, así no se cruzan reservas de la misma especialista.</p>
      </section>

      <section class="surface-card settings-card">
        <h2>Reservas en línea</h2>
        <label class="settings-switch">
          <input type="checkbox" id="sBookingEnabled" ${st.bookingEnabled ? 'checked' : ''}>
          <span>Permitir que las clientas reserven desde la página</span>
        </label>
        <div class="form-row">
          <div class="form-group">
            <label for="sMaxDays">Reservar hasta (días)</label>
            <input id="sMaxDays" type="number" min="1" max="365" class="form-control" value="${escapeHTML(st.maxDaysAhead)}">
          </div>
          <div class="form-group">
            <label for="sMaxActive">Citas activas por clienta</label>
            <input id="sMaxActive" type="number" min="1" max="20" class="form-control" value="${escapeHTML(st.maxActiveBookings)}">
          </div>
        </div>
        <p class="settings-help">Enlace para tus clientas: <a href="${escapeHTML(clientUrl)}" target="_blank" rel="noopener">${escapeHTML(clientUrl)}</a></p>
      </section>

      <section class="surface-card settings-card">
        <h2>Recordatorios</h2>
        <label class="settings-switch">
          <input type="checkbox" id="sReminders" ${st.remindersEnabled ? 'checked' : ''}>
          <span>Enviar recordatorio push a la clienta antes de su cita confirmada</span>
        </label>
        <div class="form-group">
          <label for="sReminderHours">¿Cuántas horas antes?</label>
          <input id="sReminderHours" type="number" min="1" max="72" class="form-control" value="${escapeHTML(st.reminderHoursBefore)}">
        </div>
        <p class="settings-help">Solo llega a clientas que activaron las notificaciones en la página de reservas.</p>
      </section>

      <div class="settings-actions">
        <p id="settingsMsg" class="form-message" hidden></p>
        <button type="submit" class="btn-gold" id="settingsSaveBtn">Guardar configuración</button>
      </div>
    </form>
  `;
}

// Muestra/oculta campos del depósito y un ejemplo con el primer tratamiento
function updateSettingsPreview() {
  const requireDeposit = document.getElementById('sRequireDeposit')?.checked;
  const type = document.getElementById('sDepositType')?.value || 'treatment';
  const fields = document.getElementById('sDepositFields');
  const valueGroup = document.getElementById('sDepositValueGroup');
  const label = document.getElementById('sDepositValueLabel');
  const valueInput = document.getElementById('sDepositValue');
  const preview = document.getElementById('sDepositPreview');
  if (!fields) return;
  fields.hidden = !requireDeposit;
  valueGroup.hidden = type === 'treatment';
  const symbol = (CURRENCIES[document.getElementById('sCurrency')?.value] || currentCurrency()).symbol;
  label.textContent = type === 'percent' ? 'Porcentaje (%)' : `Monto (${symbol})`;
  if (type === 'percent') valueInput.max = '100'; else valueInput.removeAttribute('max');

  const t = state.treatments[0];
  if (!preview || !t) return;
  const value = Number(valueInput.value) || 0;
  const deposit = !requireDeposit ? 0
    : type === 'fixed' ? value
      : type === 'percent' ? Math.round(t.price * Math.min(100, value) / 100)
        : t.depositRequired;
  const fmt = n => `${symbol} ${Number(n || 0).toLocaleString('es-DO')}`;
  preview.textContent = deposit > 0
    ? `Ejemplo: "${t.name}" (${fmt(t.price)}) → depósito de ${fmt(deposit)} al reservar y ${fmt(t.price - deposit)} al finalizar.`
    : `Ejemplo: "${t.name}" → sin depósito; la clienta paga ${fmt(t.price)} al finalizar y la cita queda confirmada.`;
}

function collectSettingsForm() {
  const val = id => document.getElementById(id)?.value ?? '';
  const weeklyScheduleData = [...document.querySelectorAll('.settings-weekday')].map(row => ({
    day: Number(row.dataset.day),
    open: row.querySelector('.sDayOpen').checked,
    start: row.querySelector('.sDayStart').value,
    end: row.querySelector('.sDayEnd').value
  }));
  return {
    businessName: val('sBusinessName').trim(),
    tagline: val('sTagline').trim(),
    city: val('sCity').trim(),
    instagram: val('sInstagram').trim(),
    address: val('sAddress').trim(),
    welcomeMessage: val('sWelcome'),
    currency: val('sCurrency'),
    language: val('sLanguage'),
    whatsapp: val('sWhatsapp').trim(),
    requireDeposit: document.getElementById('sRequireDeposit')?.checked ?? true,
    depositType: val('sDepositType'),
    depositValue: Number(val('sDepositValue')) || 0,
    depositInstructions: val('sDeposit'),
    cancellationPolicy: val('sPolicy'),
    weeklySchedule: weeklyScheduleData,
    slotInterval: Number(val('sSlotInterval')),
    bookingEnabled: document.getElementById('sBookingEnabled')?.checked ?? true,
    minHoursNotice: Number(val('sMinHours')),
    maxDaysAhead: Number(val('sMaxDays')),
    maxActiveBookings: Number(val('sMaxActive')),
    remindersEnabled: document.getElementById('sReminders')?.checked ?? true,
    reminderHoursBefore: Number(val('sReminderHours'))
  };
}

async function saveSettings(event) {
  event.preventDefault();
  const msg = document.getElementById('settingsMsg');
  const btn = document.getElementById('settingsSaveBtn');
  const body = collectSettingsForm();
  const badDay = body.weeklySchedule.find(d => d.open && (!d.start || !d.end || d.end <= d.start));
  if (badDay) {
    msg.textContent = `Revisa el horario del ${WEEKDAY_LABELS[badDay.day]}: la hora de cierre debe ser después de la apertura.`;
    msg.hidden = false;
    return;
  }
  btn.disabled = true;
  try {
    const data = await adminApi('/api/admin/settings', { method: 'PUT', body });
    uiState.settings = data.settings;
    showToast('Configuración guardada.');
    renderWorkspace();
  } catch (err) {
    msg.textContent = err.message;
    msg.hidden = false;
    btn.disabled = false;
  }
}

// ============================================================================
// NOTIFICACIONES PUSH DEL EQUIPO
// ============================================================================
const PUSH_PROMPT_KEY = 'niskin_staff_push_prompt_dismissed';

async function enableStaffPush() {
  try {
    await NiskinPush.enable({
      apiBase: getRenderBaseUrl(),
      subscribePath: '/api/admin/push/subscribe',
      headers: authHeaders()
    });
    showToast('Notificaciones activadas en este dispositivo. 🔔');
  } catch (err) {
    showToast(err.message);
  }
  uiState.pushStatus = await NiskinPush.status();
  if (document.getElementById('modalBackdrop')?.classList.contains('open') && document.getElementById('pushStatusBox')) {
    openMyAccountModal();
  } else {
    renderWorkspace();
  }
}

async function disableStaffPush() {
  await NiskinPush.disable({ apiBase: getRenderBaseUrl() });
  uiState.pushStatus = await NiskinPush.status();
  showToast('Notificaciones desactivadas en este dispositivo.');
  openMyAccountModal();
}

function dismissPushPrompt() {
  try {
    localStorage.setItem(PUSH_PROMPT_KEY, '1');
  } catch (e) {}
  renderWorkspace();
}

function pushStatusText(status) {
  return {
    enabled: '🔔 Activadas en este dispositivo.',
    available: 'Recibe un aviso cuando una clienta reserve, cancele o se registre.',
    denied: 'Bloqueaste las notificaciones. Actívalas en los ajustes del navegador para este sitio.',
    'ios-install': 'En iPhone: toca Compartir → “Añadir a pantalla de inicio”, abre Niskin desde ahí y actívalas.',
    unsupported: 'Este navegador no permite notificaciones.'
  }[status] || '';
}

function renderPushPromptCard() {
  let dismissed = false;
  try {
    dismissed = localStorage.getItem(PUSH_PROMPT_KEY) === '1';
  } catch (e) {}
  if (dismissed) return '';
  if (uiState.pushStatus === 'ios-install') {
    return `
      <div class="push-prompt">
        <div>
          <strong>🔔 Recibe avisos de nuevas citas</strong>
          <p>En iPhone toca <b>Compartir</b> → <b>Añadir a pantalla de inicio</b>, abre Niskin desde ahí y activa las notificaciones en <b>Mi cuenta</b>.</p>
        </div>
        <div class="push-prompt-actions">
          <button class="btn-soft btn-sm" onclick="dismissPushPrompt()">Entendido</button>
        </div>
      </div>
    `;
  }
  if (uiState.pushStatus !== 'available') return '';
  return `
    <div class="push-prompt">
      <div>
        <strong>🔔 Activa las notificaciones</strong>
        <p>Entérate al instante cuando una clienta reserve, cancele o se registre.</p>
      </div>
      <div class="push-prompt-actions">
        <button class="btn-soft btn-sm" onclick="dismissPushPrompt()">Ahora no</button>
        <button class="btn-gold btn-sm" onclick="enableStaffPush()">Activar</button>
      </div>
    </div>
  `;
}

function adminLogout() {
  // En un dispositivo compartido, dejar de recibir avisos del estudio al cerrar sesión
  if (window.NiskinPush) NiskinPush.disable({ apiBase: getRenderBaseUrl() });
  uiState.settings = null;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {}
  state = JSON.parse(JSON.stringify(INITIAL_NISKIN_DATA));
  uiState.serverSynced = false;
  closeModal();
  toggleMobileMenu(false);
  showAdminGate('Sesión cerrada.');
}

// ============================================================================
// MONEDA, DEPÓSITO Y HORARIO LABORAL (según Configuración)
// ============================================================================
const CURRENCIES = {
  DOP: { symbol: 'RD$', decimals: 0, label: 'Peso dominicano (RD$)' },
  USD: { symbol: 'US$', decimals: 2, label: 'Dólar estadounidense (US$)' },
  EUR: { symbol: '€', decimals: 2, label: 'Euro (€)' },
  MXN: { symbol: 'MX$', decimals: 2, label: 'Peso mexicano (MX$)' },
  COP: { symbol: 'COL$', decimals: 0, label: 'Peso colombiano (COL$)' },
  PEN: { symbol: 'S/', decimals: 2, label: 'Sol peruano (S/)' },
  CLP: { symbol: 'CLP$', decimals: 0, label: 'Peso chileno (CLP$)' },
  ARS: { symbol: 'AR$', decimals: 0, label: 'Peso argentino (AR$)' },
  GTQ: { symbol: 'Q', decimals: 2, label: 'Quetzal (Q)' },
  CRC: { symbol: '₡', decimals: 0, label: 'Colón costarricense (₡)' }
};

const DEFAULT_WEEKLY_SCHEDULE = [
  { day: 0, open: false, start: '09:00', end: '13:00' },
  { day: 1, open: true, start: '09:00', end: '18:00' },
  { day: 2, open: true, start: '09:00', end: '18:00' },
  { day: 3, open: true, start: '09:00', end: '18:00' },
  { day: 4, open: true, start: '09:00', end: '18:00' },
  { day: 5, open: true, start: '09:00', end: '18:00' },
  { day: 6, open: true, start: '09:00', end: '14:00' }
];

function currentCurrency() {
  return CURRENCIES[uiState?.settings?.currency] || CURRENCIES.DOP;
}

// Monto que se cobra al reservar un tratamiento (0 = paga todo al finalizar)
function depositForTreatment(treatment) {
  const st = uiState.settings || {};
  if (!treatment || st.requireDeposit === false) return 0;
  if (st.depositType === 'fixed') return Math.max(0, Math.round(Number(st.depositValue) || 0));
  if (st.depositType === 'percent') {
    const pct = Math.min(100, Math.max(0, Number(st.depositValue) || 0));
    return Math.round((Number(treatment.price) || 0) * pct / 100);
  }
  return Math.max(0, Number(treatment.depositRequired) || 0);
}

function hhmmToMinutes(value) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(value || ''));
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

function minutesToSlot(total) {
  const h = Math.floor(total / 60);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(h12).padStart(2, '0')}:${String(total % 60).padStart(2, '0')} ${suffix}`;
}

function weeklySchedule() {
  const weekly = uiState.settings?.weeklySchedule;
  return Array.isArray(weekly) && weekly.length === 7 ? weekly : DEFAULT_WEEKLY_SCHEDULE;
}

function dayScheduleFor(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const weekday = new Date(y, m - 1, d).getDay();
  return weeklySchedule().find(s => s.day === weekday) || null;
}

function isClosedDay(dateStr) {
  const day = dayScheduleFor(dateStr);
  return !day || !day.open;
}

function treatmentDuration(treatmentId) {
  return Number(state.treatments.find(t => t.id === treatmentId)?.durationMin) || 60;
}

// Horarios del día con su estado: 'available' o 'taken' (se cruza con otra cita activa)
function slotStatusesFor({ date, specialistId, treatmentId, ignoreAppointmentId }) {
  const day = dayScheduleFor(date);
  const interval = Math.max(10, Number(uiState.settings?.slotInterval) || 30);
  const duration = treatmentDuration(treatmentId);
  let start;
  let end;
  if (day && day.open) {
    start = hhmmToMinutes(day.start);
    end = hhmmToMinutes(day.end);
  } else {
    // Día cerrado: el equipo aún puede agendar manualmente en un rango amplio
    start = 8 * 60;
    end = 20 * 60;
  }
  const busy = state.appointments
    .filter(a => a.date === date && a.specialistId === specialistId && a.id !== ignoreAppointmentId &&
      ACTIVE_APPOINTMENT_STATUSES.includes(a.status))
    .map(a => ({ start: slotMinutes(a.time), dur: treatmentDuration(a.treatmentId) }));
  const result = [];
  for (let t = start; t + duration <= end; t += interval) {
    const taken = busy.some(b => t < b.start + b.dur && b.start < t + duration);
    result.push({ time: minutesToSlot(t), status: taken ? 'taken' : 'available' });
  }
  return result;
}

function formatMoney(amount) {
  const cur = currentCurrency();
  return `${cur.symbol} ${Number(amount || 0).toLocaleString('es-DO', { maximumFractionDigits: cur.decimals })}`;
}

function showToast(message) {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => {
    el.remove();
  }, 3600);
}

// Quita títulos como "Lic.", "Dra." o "Est." para iniciales y saludos
function nameWithoutTitles(name) {
  const words = String(name || '').split(' ').filter(Boolean);
  const plain = words.filter(w => !w.endsWith('.'));
  return plain.length ? plain : words;
}

function getInitials(name) {
  return nameWithoutTitles(name || 'NB')
    .slice(0, 2)
    .map(p => p[0].toUpperCase())
    .join('');
}

const PASTEL_CLASSES = ['pastel-rose', 'pastel-sage', 'pastel-lavender', 'pastel-amber', 'pastel-blue'];

function formatAge(age) {
  return age ? `${age} años` : 'edad por registrar';
}

// ============================================================================
// NAVEGACIÓN PRINCIPAL
// ============================================================================
function toggleMobileMenu(forceOpen) {
  const isOpen = typeof forceOpen === 'boolean'
    ? forceOpen
    : !document.body.classList.contains('menu-open');
  document.body.classList.toggle('menu-open', isOpen);
  document.getElementById('menuToggleBtn')?.setAttribute('aria-expanded', String(isOpen));
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') toggleMobileMenu(false);
});

function switchView(viewName) {
  if (viewName === 'team' && !isStaffManager()) viewName = 'dashboard';
  const viewChanged = uiState.currentView !== viewName;
  uiState.currentView = viewName;
  toggleMobileMenu(false);
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === viewName);
  });

  const isClientMode = viewName === 'client-portal';
  document.getElementById('modeAdminBtn')?.classList.toggle('active', !isClientMode);
  document.getElementById('modeClientBtn')?.classList.toggle('active', isClientMode);

  const titles = {
    'dashboard': ['Panel General Niskin', 'Resumen ejecutivo de citas, ingresos, inventario y evolución de pacientes'],
    'agenda': ['Agenda y Citas', 'Control de reservas, confirmación de depósitos y atención en cabina'],
    'patients': ['Expedientes Clínicos', 'Ficha cosmetológica, seguimiento del progreso, plan de tratamiento, rutina y sesiones'],
    'inventory': ['Inventario de Cabina y Skincare Retail', 'Control de existencias, alertas de stock mínimo y descuento automático por sesión'],
    'treatments': ['Catálogo de Tratamientos y Protocolos', 'Servicios de Niskin Beauty Studio e insumos vinculados por sesión'],
    'finances': ['Finanzas y Flujo de Caja', 'Registro de ingresos por tratamientos, depósitos, ventas de skincare y gastos operativos'],
    'settings': ['Configuración del Negocio', 'Datos del estudio, WhatsApp, pagos, horarios de reserva y recordatorios'],
    'team': ['Equipo y Accesos', 'Cuentas de administradoras y cosmetólogas que pueden entrar al panel'],
    'client-portal': ['Portal del Cliente — Mi Espacio Niskin', 'Experiencia interactiva para tus clientas: agendar citas, ver su récord y fotos de mejoría']
  };

  const [title, subtitle] = titles[viewName] || titles['dashboard'];
  document.getElementById('topbarHeading').textContent = title;
  document.getElementById('topbarSubheading').textContent = subtitle;

  renderWorkspace();
  if (viewChanged) window.scrollTo({ top: 0 });
}

function renderWorkspace() {
  const container = document.getElementById('workspaceContent');
  if (!container) return;

  switch (uiState.currentView) {
    case 'dashboard':
      container.innerHTML = renderDashboardView();
      break;
    case 'agenda':
      container.innerHTML = renderAgendaView();
      break;
    case 'patients':
      container.innerHTML = renderPatientsView();
      break;
    case 'inventory':
      container.innerHTML = renderInventoryView();
      break;
    case 'treatments':
      container.innerHTML = renderTreatmentsView();
      break;
    case 'finances':
      container.innerHTML = renderFinancesView();
      break;
    case 'team':
      container.innerHTML = renderTeamView();
      break;
    case 'settings':
      container.innerHTML = renderSettingsView();
      updateSettingsPreview();
      break;
    case 'client-portal':
      container.innerHTML = renderClientPortalView();
      break;
    default:
      container.innerHTML = renderDashboardView();
  }
}

// ============================================================================
// 1. VISTA DASHBOARD (FIEL AL BOCETO DE ESCRITORIO 1)
// ============================================================================
function renderDashboardView() {
  const todayAppointments = state.appointments.filter(a => a.date === uiState.selectedDate);
  const confirmedCount = state.appointments.filter(a => a.status === 'Confirmada' || a.status === 'Completada').length;
  const pendingDeposits = state.appointments
    .filter(a => a.status === 'Pendiente Depósito')
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const occupancyPct = Math.min(100, Math.round((todayAppointments.length / 6) * 100));

  const totalIncome = state.finances
    .filter(f => f.type === 'Ingreso')
    .reduce((acc, item) => acc + Number(item.amount), 0);
  const totalExpenses = state.finances
    .filter(f => f.type === 'Gasto')
    .reduce((acc, item) => acc + Number(item.amount), 0);
  const netBalance = totalIncome - totalExpenses;

  const lowStockItems = state.inventory.filter(i => i.stock <= i.minStock);

  const filteredAppointments = !uiState.searchQuery ? appointmentsOfDay(uiState.selectedDate) : state.appointments.filter(a => {
    const q = uiState.searchQuery.toLowerCase();
    return (
      a.patientName.toLowerCase().includes(q) ||
      a.treatmentName.toLowerCase().includes(q) ||
      a.specialistName.toLowerCase().includes(q)
    );
  });

  return `
    ${renderPushPromptCard()}
    <div class="action-bar">
      <div>
        <span style="font-size:0.85rem;color:var(--text-secondary);">
          Fecha seleccionada en agenda: <strong>${uiState.selectedDate}</strong> • ${todayAppointments.length} cita(s) en ese día
          ${!isStaffManager() ? '' : uiState.serverSynced
            ? ` • <span style="color:var(--status-success-text);font-weight:600;">☁️ ${uiState.backendLabel}</span>`
            : ` • <span style="color:var(--text-muted);cursor:pointer;text-decoration:underline;" onclick="openRenderConfigModal()">☁️ Destino API: ${getRenderBaseUrl()}</span>`}
        </span>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        <button class="btn-soft" onclick="switchView('client-portal')">
          <span>📱</span> Ver Portal del Cliente
        </button>
        <button class="btn-gold" onclick="openAppointmentModal()">
          <span>＋</span> Agendar Nueva Cita
        </button>
      </div>
    </div>

    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-top">
          <div>
            <div class="kpi-label">Citas y Ocupación (${uiState.selectedDate})</div>
            <div class="kpi-value">${todayAppointments.length} Citas</div>
          </div>
          <div class="kpi-icon-dot">📅</div>
        </div>
        <div class="kpi-progress-wrap">
          <div class="kpi-progress-track">
            <div class="kpi-progress-bar" style="width: ${occupancyPct}%;"></div>
          </div>
          <div class="kpi-subtext">
            <span>Capacidad de cabina ocupada</span>
            <strong>${occupancyPct}% (${confirmedCount} confirmadas en total)</strong>
          </div>
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-top">
          <div>
            <div class="kpi-label">Ingresos Brutos del Mes</div>
            <div class="kpi-value">${formatMoney(totalIncome)}</div>
          </div>
          <div class="kpi-icon-dot">✨</div>
        </div>
        <div class="kpi-subtext" style="margin-top:auto;">
          <span>Balance Neto (Ingresos - Gastos):</span>
          <strong style="color:var(--status-success-text);">${formatMoney(netBalance)}</strong>
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-top">
          <div>
            <div class="kpi-label">Pacientes & Alertas de Stock</div>
            <div class="kpi-value">${state.patients.length} Expedientes</div>
          </div>
          <div class="kpi-icon-dot">🧴</div>
        </div>
        <div class="kpi-subtext" style="margin-top:auto;">
          <span>Insumos por reabastecer:</span>
          <strong style="color:${lowStockItems.length > 0 ? 'var(--status-warning-text)' : 'var(--status-success-text)'};">
            ${lowStockItems.length} producto(s) en alerta
          </strong>
        </div>
      </div>
    </div>

    <div class="dashboard-grid">
      <div class="surface-card">
        <div class="card-header">
          <div>
            <h2>${uiState.searchQuery ? 'Resultados de búsqueda' : `Citas del ${escapeHTML(formatDateLong(uiState.selectedDate))}`}</h2>
            <p style="font-size:0.8rem;color:var(--text-secondary);">${uiState.searchQuery ? `${filteredAppointments.length} cita(s) encontradas` : 'Toca un día en el calendario para ver sus citas.'}</p>
          </div>
          <button class="btn-soft btn-sm" onclick="switchView('agenda')">Ver Agenda Completa</button>
        </div>

        <div class="card-subhead">
          <span>Paciente / Especialista</span>
          <span>Tratamiento</span>
          <span>Fecha y Hora</span>
          <span>Estado / Depósito</span>
          <span style="text-align:right;">Acciones</span>
        </div>

        <div class="list-rows">
          ${filteredAppointments.length ? filteredAppointments.map(app => renderAppointmentRow(app)).join('') : `
            <div style="padding:28px;text-align:center;color:var(--text-secondary);display:flex;flex-direction:column;align-items:center;gap:12px;">
              <span>${isClosedDay(uiState.selectedDate) ? 'Día cerrado. ' : ''}No hay citas este día.</span>
              <button class="btn-soft btn-sm" onclick="openAppointmentModal(null, '${uiState.selectedDate}')">＋ Agendar este día</button>
            </div>
          `}
        </div>
      </div>

      <div class="right-stack">
        <div class="surface-card calendar-widget">
          ${renderCalendarWidget('admin')}
        </div>

        <div class="surface-card mini-feed-card">
          <h3>Alertas de Inventario y Evolución</h3>
          <div class="mini-feed-list">
            ${lowStockItems.slice(0, 2).map(item => `
              <div class="mini-feed-item">
                <span class="pastel-avatar pastel-amber">⚠️</span>
                <div class="entity-text" style="flex:1;">
                  <h4>Stock Bajo: ${item.name}</h4>
                  <p>Quedan <strong>${item.stock} ${item.unit}</strong> (Mínimo: ${item.minStock})</p>
                </div>
                <button class="btn-soft btn-sm" onclick="restockItem('${item.id}', 5)">+5</button>
              </div>
            `).join('')}
            ${pendingDeposits.slice(0, 4).map(app => `
              <div class="mini-feed-item">
                <span class="pastel-avatar pastel-rose">💳</span>
                <div class="entity-text" style="flex:1;min-width:0;">
                  <h4>Depósito pendiente • ${app.patientName}</h4>
                  <p>${app.treatmentName} • ${app.date} (${app.time})</p>
                </div>
                <button class="btn-soft btn-sm" onclick="openConfirmAppointmentModal('${app.id}')">Confirmar</button>
              </div>
            `).join('')}
            ${!pendingDeposits.length && !lowStockItems.length ? `
              <p style="font-size:0.84rem;color:var(--text-secondary);">Todo al día: sin depósitos pendientes ni alertas de stock.</p>
            ` : ''}
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderAppointmentRow(app) {
  const isSuccess = app.status === 'Confirmada' || app.status === 'Completada';
  const isCancelled = app.status === 'Cancelada';
  const badgeClass = isCancelled ? 'status-danger' : (isSuccess ? 'status-confirmed' : 'status-pending');

  return `
    <div class="list-row">
      <div class="row-entity">
        <div class="pastel-avatar ${app.pastelClass || 'pastel-rose'}">${app.initials}</div>
        <div class="entity-text">
          <h4>${app.patientName}</h4>
          <p>${app.specialistName}</p>
        </div>
      </div>
      <div class="entity-text">
        <h4>${app.treatmentName}</h4>
        <p>${formatMoney(app.price)}</p>
      </div>
      <div class="entity-text">
        <h4>${app.time}</h4>
        <p class="nowrap">${escapeHTML(formatDateShort(app.date))}</p>
      </div>
      <div>
        <span class="status-pill ${badgeClass}">
          <span class="dot"></span>
          ${app.status}
        </span>
        <div style="font-size:0.72rem;color:var(--text-muted);margin-top:3px;">
          ${app.status === 'Completada'
            ? `Cobrado: ${formatMoney(Number(app.depositPaid || 0) + Number(app.finalPaid || 0))}`
            : isPayAtEnd(app)
              ? `Paga al finalizar: ${formatMoney(app.price)}`
              : `Depósito: ${formatMoney(app.depositPaid)}`}
        </div>
      </div>
      <div class="row-actions">
        <button class="round-action-btn" title="Ver expediente" onclick="openPatientRecord('${app.patientId}')">
          📋
        </button>
        <button class="round-action-btn whatsapp-btn" title="Enviar mensaje por WhatsApp" aria-label="WhatsApp" onclick="sendAppointmentWhatsApp('${app.id}')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3z"/></svg>
        </button>
        ${app.status === 'Pendiente Depósito' ? `
          <button class="round-action-btn" title="Confirmar cita (con o sin depósito)" onclick="openConfirmAppointmentModal('${app.id}')">
            💳
          </button>
        ` : ''}
        ${app.status !== 'Completada' && !isCancelled ? `
          <button class="round-action-btn" title="Completar sesión y cobrar" onclick="openCompleteSessionModal('${app.id}')">
            ✓
          </button>
        ` : ''}
        <button class="round-action-btn danger-btn" title="Eliminar cita" aria-label="Eliminar cita" onclick="askDelete('appointment', '${app.id}')">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>
        </button>
      </div>
    </div>
  `;
}

// ============================================================================
// WIDGET DE CALENDARIO INTERACTIVO
// ============================================================================
function renderCalendarWidget(contextMode) {
  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  const year = uiState.calendarYear;
  const month = uiState.calendarMonth;
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const activeDate = contextMode === 'portal' ? uiState.portalSelectedDate : uiState.selectedDate;
  const appointmentDates = new Set(state.appointments.map(a => a.date));

  let cells = '';
  for (let i = 0; i < firstDay; i++) {
    cells += `<div class="cal-day empty"></div>`;
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const mStr = String(month + 1).padStart(2, '0');
    const dStr = String(d).padStart(2, '0');
    const fullDate = `${year}-${mStr}-${dStr}`;
    const isSelected = fullDate === activeDate;
    const hasEvent = appointmentDates.has(fullDate);
    const closed = isClosedDay(fullDate);
    const isToday = fullDate === toISODate(new Date());
    // En la vista previa del portal, las clientas no pueden elegir días cerrados ni pasados
    const portalBlocked = contextMode === 'portal' && (closed || fullDate < toISODate(new Date()));
    const clickHandler = contextMode === 'portal'
      ? `selectPortalDate('${fullDate}')`
      : `selectAdminDate('${fullDate}')`;
    const count = contextMode === 'portal' ? 0 : state.appointments.filter(a => a.date === fullDate && a.status !== 'Cancelada').length;

    cells += `
      <button class="cal-day ${isSelected ? 'selected' : ''} ${hasEvent ? 'has-events' : ''} ${closed ? 'closed' : ''} ${isToday ? 'today' : ''}"
              ${portalBlocked ? 'disabled' : `onclick="${clickHandler}"`}
              aria-label="${d}${count ? `, ${count} cita(s)` : ''}${closed ? ', cerrado' : ''}">
        <span>${d}</span>
        ${hasEvent ? '<span class="cal-dot"></span>' : ''}
      </button>
    `;
  }

  return `
    <div class="cal-top">
      <h3>${monthNames[month]} ${year}</h3>
      <div class="cal-nav">
        <button class="cal-arrow" onclick="changeCalendarMonth(-1)" title="Mes anterior">‹</button>
        <button class="cal-arrow" onclick="changeCalendarMonth(1)" title="Mes siguiente">›</button>
      </div>
    </div>
    <div class="cal-weekdays">
      <span>Dom</span><span>Lun</span><span>Mar</span><span>Mié</span><span>Jue</span><span>Vie</span><span>Sáb</span>
    </div>
    <div class="cal-days">
      ${cells}
    </div>
  `;
}

function changeCalendarMonth(delta) {
  let m = uiState.calendarMonth + delta;
  let y = uiState.calendarYear;
  if (m < 0) { m = 11; y--; }
  if (m > 11) { m = 0; y++; }
  uiState.calendarMonth = m;
  uiState.calendarYear = y;
  renderWorkspace();
}

function selectAdminDate(dateStr) {
  uiState.selectedDate = dateStr;
  renderWorkspace();
  openDayAppointmentsSheet(dateStr);
}

function appointmentsOfDay(dateStr) {
  return state.appointments
    .filter(a => a.date === dateStr)
    .sort((a, b) => slotMinutes(a.time) - slotMinutes(b.time));
}

// Hoja con las citas del día elegido en el calendario
function openDayAppointmentsSheet(dateStr) {
  const list = appointmentsOfDay(dateStr);
  const day = dayScheduleFor(dateStr);
  const active = list.filter(a => a.status !== 'Cancelada').length;
  const statusClass = st => (st === 'Cancelada' ? 'status-danger' : (st === 'Confirmada' || st === 'Completada') ? 'status-confirmed' : 'status-pending');
  openModalWithHTML(
    `Citas del ${formatDateLong(dateStr)}`,
    `
      <p class="day-sheet-meta">
        ${day && day.open ? `Horario: ${escapeHTML(day.start)} – ${escapeHTML(day.end)}` : 'Día cerrado según Configuración'}
        • ${active} cita(s) activa(s)
      </p>
      ${list.length ? `
        <div class="day-appt-list">
          ${list.map(a => `
            <article class="day-appt">
              <div class="day-appt-time">${escapeHTML(a.time)}</div>
              <div class="day-appt-body">
                <h4>${escapeHTML(a.patientName)}</h4>
                <p>${escapeHTML(a.treatmentName)} • ${escapeHTML(a.specialistName)}</p>
                <div class="day-appt-foot">
                  <span class="status-pill ${statusClass(a.status)}"><span class="dot"></span>${escapeHTML(a.status)}</span>
                  <span class="day-appt-actions">
                    <button class="round-action-btn whatsapp-btn" title="WhatsApp" aria-label="WhatsApp" onclick="sendAppointmentWhatsApp('${escapeHTML(a.id)}')">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2z"/></svg>
                    </button>
                    ${a.status === 'Pendiente Depósito' ? `<button class="round-action-btn" title="Confirmar cita" onclick="openConfirmAppointmentModal('${escapeHTML(a.id)}')">💳</button>` : ''}
                    ${a.status !== 'Completada' && a.status !== 'Cancelada' ? `<button class="round-action-btn" title="Completar y cobrar" onclick="openCompleteSessionModal('${escapeHTML(a.id)}')">✓</button>` : ''}
                    <button class="round-action-btn" title="Ver expediente" onclick="closeModal(); openPatientRecord('${escapeHTML(a.patientId)}')">📋</button>
                  </span>
                </div>
              </div>
            </article>
          `).join('')}
        </div>
      ` : `<div class="day-empty">No hay citas este día.</div>`}
    `,
    `
      <button class="btn-soft" onclick="closeModal()">Cerrar</button>
      <button class="btn-gold" onclick="openAppointmentModal(null, '${escapeHTML(dateStr)}')">＋ Agendar este día</button>
    `
  );
}

function selectPortalDate(dateStr) {
  uiState.portalSelectedDate = dateStr;
  renderWorkspace();
}

// ============================================================================
// 2. VISTA AGENDA Y CITAS
// ============================================================================
function renderAgendaView() {
  const statuses = ['Todas', 'Confirmada', 'Pendiente Depósito', 'Completada', 'Cancelada'];
  const filtered = state.appointments.filter(a => {
    const matchStatus = uiState.agendaFilterStatus === 'Todas' || a.status === uiState.agendaFilterStatus;
    const matchSearch = !uiState.searchQuery ||
      a.patientName.toLowerCase().includes(uiState.searchQuery.toLowerCase()) ||
      a.treatmentName.toLowerCase().includes(uiState.searchQuery.toLowerCase());
    return matchStatus && matchSearch;
  });

  return `
    <div class="action-bar">
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        ${statuses.map(st => `
          <button class="btn-soft ${uiState.agendaFilterStatus === st ? 'active' : ''}"
                  style="${uiState.agendaFilterStatus === st ? 'background:var(--gold-primary);color:#fff;border-color:var(--gold-primary);' : ''}"
                  onclick="setAgendaFilter('${st}')">
            ${st}
          </button>
        `).join('')}
      </div>
      <button class="btn-gold" onclick="openAppointmentModal()">
        <span>＋</span> Nueva Cita en Agenda
      </button>
    </div>

    <div class="surface-card">
      <div class="card-header">
        <div>
          <h2>Control de Citas y Sesiones (${filtered.length})</h2>
          <p style="font-size:0.8rem;color:var(--text-secondary);">Al marcar una cita como completada (✓), se registra en el récord de la clienta, se descuenta el insumo de cabina y se suma el ingreso a Finanzas.</p>
        </div>
      </div>
      <div class="card-subhead">
        <span>Paciente / Especialista</span>
        <span>Tratamiento</span>
        <span>Fecha y Hora</span>
        <span>Estado / Depósito</span>
        <span style="text-align:right;">Acciones</span>
      </div>
      <div class="list-rows">
        ${filtered.length ? filtered.map(a => renderAppointmentRow(a)).join('') : `
          <div style="padding:32px;text-align:center;color:var(--text-secondary);">No hay citas en este filtro.</div>
        `}
      </div>
    </div>
  `;
}

function setAgendaFilter(status) {
  uiState.agendaFilterStatus = status;
  renderWorkspace();
}

const PAYMENT_METHODS = ['Transferencia Bancaria', 'Efectivo', 'Tarjeta / POS'];

function isPayAtEnd(app) {
  return app.paymentMode === 'al-finalizar';
}

function paymentMethodOptions(selected) {
  return PAYMENT_METHODS.map(m => `<option ${m === selected ? 'selected' : ''}>${m}</option>`).join('');
}

// Confirmar una cita pendiente: con depósito recibido o sin depósito (paga todo al finalizar)
function openConfirmAppointmentModal(appointmentId) {
  const app = state.appointments.find(a => a.id === appointmentId);
  if (!app || app.status !== 'Pendiente Depósito') return;
  const treatment = state.treatments.find(t => t.id === app.treatmentId);
  const suggested = depositForTreatment(treatment) || (treatment ? treatment.depositRequired : 0);
  openModalWithHTML(
    `Confirmar cita — ${app.patientName}`,
    `
      <p style="font-size:0.88rem;color:var(--text-secondary);">${escapeHTML(app.treatmentName)} • ${escapeHTML(formatDateLong(app.date))} a las ${escapeHTML(app.time)} • Precio ${formatMoney(app.price)}</p>
      <div class="confirm-option">
        <h4>Recibí el depósito</h4>
        <div class="form-row">
          <div class="form-group">
            <label for="mDepAmount">Monto recibido</label>
            <input id="mDepAmount" type="number" min="1" class="form-control" value="${escapeHTML(suggested)}">
          </div>
          <div class="form-group">
            <label for="mDepMethod">Método</label>
            <select id="mDepMethod" class="form-control">${paymentMethodOptions('Transferencia Bancaria')}</select>
          </div>
        </div>
        <button class="btn-gold btn-block" onclick="confirmAppointmentDeposit('${escapeHTML(app.id)}')">Confirmar con depósito</button>
      </div>
      <div class="confirm-option">
        <h4>Confirmar sin depósito</h4>
        <p style="font-size:0.82rem;color:var(--text-secondary);">La cita queda confirmada y la clienta paga el total (${formatMoney(app.price)}) al finalizar su sesión.</p>
        <button class="btn-soft btn-block" onclick="confirmWithoutDeposit('${escapeHTML(app.id)}')">Confirmar — paga al finalizar</button>
      </div>
    `,
    `<button class="btn-soft" onclick="closeModal()">Cancelar</button>`
  );
}

function confirmAppointmentDeposit(appointmentId) {
  const app = state.appointments.find(a => a.id === appointmentId);
  if (!app || app.status !== 'Pendiente Depósito') return;
  const amountInput = document.getElementById('mDepAmount');
  const treatment = state.treatments.find(t => t.id === app.treatmentId);
  const deposit = amountInput ? Number(amountInput.value) : depositForTreatment(treatment);
  if (!(deposit > 0)) {
    showToast('Escribe el monto del depósito recibido.');
    return;
  }
  const method = document.getElementById('mDepMethod')?.value || 'Transferencia Bancaria';
  app.depositPaid = deposit;
  app.paymentMode = 'deposito';
  app.status = 'Confirmada';

  state.finances.unshift({
    id: 'fin-' + Date.now(),
    date: app.date,
    concept: `Depósito de Reserva (${app.treatmentName}) — ${app.patientName}`,
    category: 'Depósito de Reserva',
    type: 'Ingreso',
    method,
    amount: deposit
  });

  saveState();
  closeModal();
  showToast(`Depósito de ${formatMoney(deposit)} confirmado para ${app.patientName}.`);
  renderWorkspace();
}

function confirmWithoutDeposit(appointmentId) {
  const app = state.appointments.find(a => a.id === appointmentId);
  if (!app || app.status !== 'Pendiente Depósito') return;
  app.depositPaid = 0;
  app.paymentMode = 'al-finalizar';
  app.status = 'Confirmada';
  saveState();
  closeModal();
  showToast(`Cita de ${app.patientName} confirmada sin depósito. Paga ${formatMoney(app.price)} al finalizar.`);
  renderWorkspace();
}

// Completar la sesión: se cobra lo que falta (o el total si no hubo depósito)
function openCompleteSessionModal(appointmentId) {
  const app = state.appointments.find(a => a.id === appointmentId);
  if (!app || app.status === 'Completada' || app.status === 'Cancelada') return;
  const due = Math.max(0, Number(app.price) - Number(app.depositPaid || 0));
  openModalWithHTML(
    `Completar sesión y cobrar`,
    `
      <ul class="team-credentials">
        <li><span>Clienta</span><strong style="font-family:inherit;">${escapeHTML(app.patientName)}</strong></li>
        <li><span>Tratamiento</span><strong style="font-family:inherit;">${escapeHTML(app.treatmentName)}</strong></li>
        <li><span>Precio</span><strong style="font-family:inherit;">${formatMoney(app.price)}</strong></li>
        <li><span>${isPayAtEnd(app) ? 'Depósito' : 'Depósito pagado'}</span><strong style="font-family:inherit;">${isPayAtEnd(app) ? 'Sin depósito' : formatMoney(app.depositPaid)}</strong></li>
      </ul>
      <div class="form-row">
        <div class="form-group">
          <label for="mFinalAmount">${isPayAtEnd(app) ? 'Total a cobrar' : 'Resto a cobrar'}</label>
          <input id="mFinalAmount" type="number" min="0" class="form-control" value="${escapeHTML(due)}">
        </div>
        <div class="form-group">
          <label for="mFinalMethod">Método de pago</label>
          <select id="mFinalMethod" class="form-control">${paymentMethodOptions('Efectivo')}</select>
        </div>
      </div>
      <p class="admin-gate-hint" style="text-align:left;">Al completar se registra el cobro en Finanzas, se descuentan los insumos de cabina y se agrega la sesión al expediente.</p>
    `,
    `
      <button class="btn-soft" onclick="closeModal()">Cancelar</button>
      <button class="btn-gold" onclick="completeAppointmentSession('${escapeHTML(app.id)}')">Cobrar y completar</button>
    `
  );
}

function completeAppointmentSession(appointmentId) {
  const app = state.appointments.find(a => a.id === appointmentId);
  if (!app || app.status === 'Completada' || app.status === 'Cancelada') return;

  const amountInput = document.getElementById('mFinalAmount');
  const remainingAmount = amountInput
    ? Math.max(0, Number(amountInput.value) || 0)
    : Math.max(0, Number(app.price) - Number(app.depositPaid || 0));
  const method = document.getElementById('mFinalMethod')?.value || 'Efectivo';

  app.status = 'Completada';
  app.finalPaid = remainingAmount;

  if (remainingAmount > 0) {
    state.finances.unshift({
      id: 'fin-' + Date.now(),
      date: app.date,
      concept: `${isPayAtEnd(app) ? 'Pago total al finalizar' : 'Liquidación'} — ${app.treatmentName} — ${app.patientName}`,
      category: 'Servicio en Cabina',
      type: 'Ingreso',
      method,
      amount: remainingAmount
    });
  }

  const treatment = state.treatments.find(t => t.id === app.treatmentId);
  if (treatment && Array.isArray(treatment.suppliesUsed)) {
    treatment.suppliesUsed.forEach(use => {
      const invItem = state.inventory.find(i => i.id === use.inventoryId);
      if (invItem) {
        invItem.stock = Math.max(0, invItem.stock - use.qty);
      }
    });
  }

  const patient = state.patients.find(p => p.id === app.patientId);
  if (patient) {
    patient.sessions.unshift({
      id: 'ses-' + Date.now(),
      date: app.date,
      treatmentName: app.treatmentName,
      specialistName: app.specialistName,
      activesApplied: treatment ? treatment.description : 'Protocolo personalizado en cabina Niskin',
      notes: 'Sesión completada satisfactoriamente. Se actualizaron indicaciones de cuidado en casa.',
      improvementScore: ''
    });
  }

  saveState();
  closeModal();
  showToast(remainingAmount > 0
    ? `Sesión completada. Cobro de ${formatMoney(remainingAmount)} registrado en Finanzas.`
    : 'Sesión completada.');
  renderWorkspace();
}

// ============================================================================
// 3. VISTA EXPEDIENTES CLÍNICOS Y FOTOS DE MEJORÍA (ANTES Y DESPUÉS)
// ============================================================================
function openPatientRecord(patientId) {
  uiState.selectedPatientId = patientId;
  switchView('patients');
}

function selectPatient(patientId) {
  uiState.selectedPatientId = patientId;
  renderWorkspace();
}

// ============================================================================
// EXPEDIENTES: SEGUIMIENTO DEL PROGRESO
// ============================================================================
const METRIC_DEFS = [
  ['hydration', 'Hidratación y función barrera'],
  ['toneUniformity', 'Uniformidad del tono'],
  ['texturePores', 'Textura, firmeza y poros'],
  ['blemishControl', 'Control de imperfecciones']
];

// Evaluaciones ordenadas por fecha. Si la paciente solo tiene el registro antiguo
// (antes/actual), se muestra como dos evaluaciones hasta que se guarde una nueva.
function progressLogOf(p) {
  if (Array.isArray(p.progressLog) && p.progressLog.length) {
    return [...p.progressLog].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }
  const m = p.metrics || {};
  const hasLegacy = METRIC_DEFS.some(([k]) => m[k] && (Number(m[k].before) || Number(m[k].current)));
  if (!hasLegacy) return [];
  const dates = (p.sessions || []).map(s => s.date).filter(Boolean).sort();
  const first = { id: 'legacy-1', date: dates[0] || '', specialistName: '', notes: 'Evaluación inicial registrada antes del seguimiento.', legacy: true };
  const last = { id: 'legacy-2', date: dates[dates.length - 1] || TODAY_ISO, specialistName: '', notes: 'Último estado registrado antes del seguimiento.', legacy: true };
  METRIC_DEFS.forEach(([k]) => {
    first[k] = Number(m[k]?.before) || 0;
    last[k] = Number(m[k]?.current) || 0;
  });
  return [first, last];
}

// Convierte el registro antiguo en evaluaciones reales antes de modificarlas
function materializeProgressLog(p) {
  if (Array.isArray(p.progressLog) && p.progressLog.length) return;
  p.progressLog = progressLogOf(p).map(({ legacy, ...entry }, i) => ({ ...entry, id: `eval-${Date.now()}-${i}` }));
}

// Mantiene metrics (inicio → actual) al día: lo usan la página de clientas y la vista previa
function syncMetricsFromLog(p) {
  const log = progressLogOf(p);
  p.metrics = p.metrics || {};
  METRIC_DEFS.forEach(([k]) => {
    p.metrics[k] = log.length
      ? { before: Number(log[0][k]) || 0, current: Number(log[log.length - 1][k]) || 0 }
      : { before: 0, current: 0 };
  });
}

function sparkline(values) {
  if (values.length < 2) return '';
  const w = 120;
  const h = 34;
  const step = w / (values.length - 1);
  const points = values.map((v, i) => `${(i * step).toFixed(1)},${(h - 3 - (Math.max(0, Math.min(100, v)) / 100) * (h - 6)).toFixed(1)}`);
  const [lx, ly] = points[points.length - 1].split(',');
  return `
    <svg class="sparkline" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">
      <polyline points="${points.join(' ')}" fill="none" stroke="var(--gold-primary)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
      <circle cx="${lx}" cy="${ly}" r="3" fill="var(--gold-primary)"/>
    </svg>
  `;
}

function renderProgressSection(p) {
  const log = progressLogOf(p);
  if (!log.length) {
    return `
      <div class="progress-empty">
        <p>Aún no hay evaluaciones. Registra la primera para empezar a seguir la evolución de la piel de ${escapeHTML(nameWithoutTitles(p.name)[0])}.</p>
        <button class="btn-gold btn-sm" onclick="openEvaluationModal('${escapeHTML(p.id)}')">＋ Primera evaluación</button>
      </div>
    `;
  }
  const first = log[0];
  const last = log[log.length - 1];
  return `
    <div class="progress-metrics">
      ${METRIC_DEFS.map(([k, label]) => {
        const start = Number(first[k]) || 0;
        const now = Number(last[k]) || 0;
        const delta = now - start;
        return `
          <div class="progress-metric">
            <div class="progress-metric-top">
              <span>${escapeHTML(label)}</span>
              ${log.length > 1 ? `<span class="progress-delta ${delta > 0 ? 'up' : delta < 0 ? 'down' : ''}">${delta > 0 ? '+' : ''}${delta}</span>` : ''}
            </div>
            <div class="progress-metric-values">
              <strong>${now}%</strong>
              ${log.length > 1 ? `<span>inicio ${start}%</span>` : ''}
            </div>
            <div class="kpi-progress-track"><div class="kpi-progress-bar" style="width:${Math.max(0, Math.min(100, now))}%"></div></div>
            ${sparkline(log.map(e => Number(e[k]) || 0))}
          </div>
        `;
      }).join('')}
    </div>

    <h4 class="subsection-title">Historial de evaluaciones (${log.length})</h4>
    <div class="eval-list">
      ${[...log].reverse().map(e => `
        <div class="eval-item">
          <div class="eval-date">${escapeHTML(e.date ? formatDateShort(e.date) : 'Sin fecha')}</div>
          <div class="eval-body">
            <div class="eval-values">
              ${METRIC_DEFS.map(([k, label]) => `<span title="${escapeHTML(label)}">${escapeHTML(label.split(' ')[0])}: <strong>${Number(e[k]) || 0}%</strong></span>`).join('')}
            </div>
            ${e.notes ? `<p>${escapeHTML(e.notes)}</p>` : ''}
            ${e.specialistName ? `<p class="eval-by">Evaluó: ${escapeHTML(e.specialistName)}</p>` : ''}
          </div>
          <div class="eval-actions">
            <button class="round-action-btn" title="Editar evaluación" onclick="openEvaluationModal('${escapeHTML(p.id)}', '${escapeHTML(e.id)}')">✎</button>
            <button class="round-action-btn danger-btn" title="Eliminar evaluación" onclick="askDeleteEvaluation('${escapeHTML(p.id)}', '${escapeHTML(e.id)}')">✕</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function patientAppointments(patientId) {
  return state.appointments
    .filter(a => a.patientId === patientId)
    .sort((a, b) => (a.date + String(slotMinutes(a.time)).padStart(4, '0')).localeCompare(b.date + String(slotMinutes(b.time)).padStart(4, '0')));
}

function renderPatientsView() {
  if (!state.patients.length) {
    return `
      <div class="action-bar">
        <span style="font-size:0.86rem;color:var(--text-secondary);">Aún no hay expedientes.</span>
        <button class="btn-gold" onclick="openNewPatientModal()"><span>＋</span> Nueva Paciente</button>
      </div>
    `;
  }
  const q = (uiState.searchQuery || '').toLowerCase();
  const list = q ? state.patients.filter(pat => `${pat.name} ${pat.phone} ${pat.email}`.toLowerCase().includes(q)) : state.patients;
  const p = state.patients.find(item => item.id === uiState.selectedPatientId) || list[0] || state.patients[0];
  const appts = patientAppointments(p.id);
  const todayIso = toISODate(new Date());
  const upcoming = appts.filter(a => a.date >= todayIso && ACTIVE_APPOINTMENT_STATUSES.includes(a.status));
  const sessionDates = (p.sessions || []).map(s => s.date).filter(Boolean).sort();
  const nextAppt = upcoming[0];
  const statusClass = st => (st === 'Cancelada' ? 'status-danger' : (st === 'Confirmada' || st === 'Completada') ? 'status-confirmed' : 'status-pending');

  return `
    <div class="action-bar">
      <span style="font-size:0.86rem;color:var(--text-secondary);">
        Ficha cosmetológica, seguimiento del progreso, plan de tratamiento y sesiones de cada paciente.
      </span>
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        <button class="btn-soft" onclick="previewClientPortalFor('${escapeHTML(p.id)}')">
          <span>📱</span> Ver como ${escapeHTML(nameWithoutTitles(p.name)[0])} en el portal
        </button>
        <button class="btn-gold" onclick="openNewPatientModal()">
          <span>＋</span> Nueva Paciente
        </button>
      </div>
    </div>

    <div class="patients-layout">
      <div class="surface-card">
        <div class="card-header">
          <h2>Pacientes (${list.length})</h2>
        </div>
        <div>
          ${list.map(pat => `
            <div class="patient-Selector-item ${pat.id === p.id ? 'active' : ''}" onclick="selectPatient('${escapeHTML(pat.id)}')">
              <div class="pastel-avatar ${escapeHTML(pat.pastelClass)}">${escapeHTML(pat.initials)}</div>
              <div class="entity-text" style="flex:1;">
                <h4>${escapeHTML(pat.name)}</h4>
                <p>${escapeHTML(pat.skinBiotype)} • ${(pat.sessions || []).length} ses.</p>
              </div>
              <span style="color:var(--gold-primary);font-weight:700;">›</span>
            </div>
          `).join('') || '<p style="padding:18px;color:var(--text-secondary);font-size:0.86rem;">Sin resultados.</p>'}
        </div>
      </div>

      <div class="surface-card">
        <div class="clinical-detail-header">
          <div class="patient-head">
            <div class="pastel-avatar ${escapeHTML(p.pastelClass)}" style="width:56px;height:56px;font-size:1.15rem;">${escapeHTML(p.initials)}</div>
            <div style="min-width:0;">
              <h2 class="patient-name">${escapeHTML(p.name)} <span>(${escapeHTML(formatAge(p.age))})</span></h2>
              <p class="patient-contact">📞 ${escapeHTML(p.phone || 'Sin teléfono')} • ✉️ ${escapeHTML(p.email || 'Sin correo')}</p>
              <div class="skin-badges">
                <span class="skin-tag">✨ ${escapeHTML(p.skinBiotype)}</span>
                <span class="skin-tag">☀️ ${escapeHTML(p.fitzpatrick)}</span>
                <span class="skin-tag">🎯 ${escapeHTML(p.mainConcern)}</span>
              </div>
            </div>
          </div>
          <div class="patient-actions">
            <button class="btn-gold btn-sm" onclick="openNewSessionModal('${escapeHTML(p.id)}')">＋ Registrar sesión</button>
            <button class="btn-soft btn-sm" onclick="openEvaluationModal('${escapeHTML(p.id)}')">📈 Nueva evaluación</button>
            <button class="btn-soft btn-sm" onclick="openEditPatientModal('${escapeHTML(p.id)}')">✎ Editar datos</button>
            <button class="btn-soft btn-sm whatsapp-soft" onclick="sendPatientWhatsApp('${escapeHTML(p.id)}')">WhatsApp</button>
            ${isStaffManager() ? `<button class="btn-soft btn-sm danger-soft" onclick="askDelete('patient', '${escapeHTML(p.id)}')">Eliminar</button>` : ''}
          </div>
        </div>

        <div class="clinical-body">
          <div class="patient-stats">
            <div><span>Sesiones</span><strong>${(p.sessions || []).length}</strong></div>
            <div><span>Primera visita</span><strong>${sessionDates[0] ? escapeHTML(formatDateShort(sessionDates[0])) : '—'}</strong></div>
            <div><span>Última visita</span><strong>${sessionDates.length ? escapeHTML(formatDateShort(sessionDates[sessionDates.length - 1])) : '—'}</strong></div>
            <div><span>Próxima cita</span><strong>${nextAppt ? `${escapeHTML(formatDateShort(nextAppt.date))} • ${escapeHTML(nextAppt.time)}` : 'Sin cita'}</strong></div>
          </div>

          ${p.allergies && !/^ningun/i.test(p.allergies) ? `
            <div class="allergy-alert">⚠️ <strong>Alergias / precauciones:</strong> ${escapeHTML(p.allergies)}</div>
          ` : ''}

          <section>
            <div class="section-head">
              <h3>Seguimiento del progreso</h3>
              <button class="btn-soft btn-sm" onclick="openEvaluationModal('${escapeHTML(p.id)}')">＋ Nueva evaluación</button>
            </div>
            ${renderProgressSection(p)}
          </section>

          <section>
            <div class="section-head">
              <h3>Plan de tratamiento</h3>
              <button class="btn-soft btn-sm" onclick="saveTreatmentPlan('${escapeHTML(p.id)}')">💾 Guardar plan</button>
            </div>
            <textarea id="treatmentPlan_${escapeHTML(p.id)}" class="form-control" rows="3" style="width:100%;" placeholder="Objetivos, protocolo recomendado, frecuencia de sesiones, próximos pasos…">${escapeHTML(p.treatmentPlan || '')}</textarea>
          </section>

          <section>
            <div class="section-head">
              <h3>Rutina en casa</h3>
              <button class="btn-soft btn-sm" onclick="saveRoutineChanges('${escapeHTML(p.id)}')">💾 Guardar rutina</button>
            </div>
            <div class="routine-grid">
              <div class="routine-box">
                <h4>☀️ Día (AM)</h4>
                <textarea id="routineAM_${escapeHTML(p.id)}" class="form-control" rows="4" style="width:100%;background:#FFFFFF;">${escapeHTML(p.homeRoutineAM || '')}</textarea>
              </div>
              <div class="routine-box">
                <h4>🌙 Noche (PM)</h4>
                <textarea id="routinePM_${escapeHTML(p.id)}" class="form-control" rows="4" style="width:100%;background:#FFFFFF;">${escapeHTML(p.homeRoutinePM || '')}</textarea>
              </div>
            </div>
          </section>

          <section>
            <div class="section-head">
              <h3>Sesiones en cabina (${(p.sessions || []).length})</h3>
              <button class="btn-soft btn-sm" onclick="openNewSessionModal('${escapeHTML(p.id)}')">＋ Registrar sesión</button>
            </div>
            ${(p.sessions || []).length ? `
              <div class="session-timeline">
                ${[...p.sessions].sort((a, b) => String(b.date).localeCompare(String(a.date))).map(ses => `
                  <div class="session-card">
                    <div class="session-card-top">
                      <div style="min-width:0;">
                        <strong style="font-size:0.95rem;color:var(--text-primary);">${escapeHTML(ses.treatmentName)}</strong>
                        <span style="font-size:0.8rem;color:var(--text-secondary);"> • ${escapeHTML(ses.specialistName)}</span>
                      </div>
                      <div class="session-meta">
                        ${ses.improvementScore ? `<span class="status-pill status-confirmed"><span class="dot"></span>${escapeHTML(ses.improvementScore)}</span>` : ''}
                        <span class="session-date">${escapeHTML(formatDateShort(ses.date))}</span>
                        <button class="round-action-btn" title="Editar sesión" onclick="openEditSessionModal('${escapeHTML(p.id)}', '${escapeHTML(ses.id)}')">✎</button>
                        <button class="round-action-btn danger-btn" title="Eliminar sesión" onclick="askDeleteSession('${escapeHTML(p.id)}', '${escapeHTML(ses.id)}')">✕</button>
                      </div>
                    </div>
                    ${ses.activesApplied ? `<p style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:6px;"><strong>Activos y aparatología:</strong> ${escapeHTML(ses.activesApplied)}</p>` : ''}
                    ${ses.notes ? `<p style="font-size:0.84rem;color:var(--text-primary);"><strong>Evolución y observaciones:</strong> ${escapeHTML(ses.notes)}</p>` : ''}
                  </div>
                `).join('')}
              </div>
            ` : '<div class="progress-empty"><p>Aún no hay sesiones registradas.</p></div>'}
          </section>

          <section>
            <div class="section-head">
              <h3>Citas (${appts.length})</h3>
              <button class="btn-soft btn-sm" onclick="openAppointmentModal(null, null, '${escapeHTML(p.id)}')">＋ Agendar</button>
            </div>
            ${appts.length ? `
              <div class="patient-appts">
                ${[...appts].reverse().map(a => `
                  <div class="patient-appt">
                    <div>
                      <strong>${escapeHTML(formatDateShort(a.date))} • ${escapeHTML(a.time)}</strong>
                      <p>${escapeHTML(a.treatmentName)} • ${escapeHTML(a.specialistName)}</p>
                    </div>
                    <span class="status-pill ${statusClass(a.status)}"><span class="dot"></span>${escapeHTML(a.status)}</span>
                  </div>
                `).join('')}
              </div>
            ` : '<div class="progress-empty"><p>Sin citas registradas.</p></div>'}
          </section>
        </div>
      </div>
    </div>
  `;
}

function saveTreatmentPlan(patientId) {
  const patient = state.patients.find(p => p.id === patientId);
  const el = document.getElementById(`treatmentPlan_${patientId}`);
  if (!patient || !el) return;
  patient.treatmentPlan = el.value.trim();
  saveState();
  showToast(`Plan de tratamiento guardado para ${patient.name}.`);
}

// ---------------------------------------------------------------------------
// Editar datos de la paciente
// ---------------------------------------------------------------------------
const SKIN_TYPES = ['Por evaluar', 'Piel Normal', 'Piel Seca', 'Piel Grasa', 'Piel Mixta', 'Piel Mixta Deshidratada', 'Piel Sensible', 'Piel Sensible / Rosácea Leve', 'Piel Grasa Seborreica', 'Piel Madura'];
const FITZPATRICK = ['Por evaluar', 'Fototipo I', 'Fototipo II', 'Fototipo III', 'Fototipo IV', 'Fototipo V', 'Fototipo VI'];

function openEditPatientModal(patientId) {
  const p = state.patients.find(x => x.id === patientId);
  if (!p) return;
  const fitzOptions = FITZPATRICK.includes(p.fitzpatrick) ? FITZPATRICK : [p.fitzpatrick, ...FITZPATRICK];
  openModalWithHTML(
    `Editar datos — ${p.name}`,
    `
      <div class="form-group">
        <label for="mEpName">Nombre completo</label>
        <input id="mEpName" class="form-control" maxlength="80" value="${escapeHTML(p.name)}">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label for="mEpPhone">Teléfono / WhatsApp</label>
          <input id="mEpPhone" class="form-control" type="tel" maxlength="30" value="${escapeHTML(p.phone || '')}">
        </div>
        <div class="form-group">
          <label for="mEpAge">Edad</label>
          <input id="mEpAge" class="form-control" type="number" min="12" max="110" value="${escapeHTML(p.age || '')}" placeholder="Opcional">
        </div>
      </div>
      <div class="form-group">
        <label for="mEpEmail">Correo</label>
        <input id="mEpEmail" class="form-control" type="email" maxlength="120" value="${escapeHTML(p.email || '')}">
        ${p.source === 'Registro Web' ? '<span class="admin-gate-hint" style="text-align:left;margin-top:2px;">Es solo de contacto: el correo con que la clienta entra a la página de reservas no cambia.</span>' : ''}
      </div>
      <div class="form-row">
        <div class="form-group">
          <label for="mEpBiotype">Biotipo de piel</label>
          <input id="mEpBiotype" class="form-control" list="skinTypeOptions" maxlength="60" value="${escapeHTML(p.skinBiotype || '')}">
          <datalist id="skinTypeOptions">${SKIN_TYPES.map(o => `<option value="${escapeHTML(o)}">`).join('')}</datalist>
        </div>
        <div class="form-group">
          <label for="mEpFitz">Fototipo (Fitzpatrick)</label>
          <select id="mEpFitz" class="form-control">
            ${fitzOptions.map(o => `<option ${o === p.fitzpatrick ? 'selected' : ''}>${escapeHTML(o)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-group">
        <label for="mEpConcern">Motivo de consulta / objetivo</label>
        <input id="mEpConcern" class="form-control" maxlength="160" value="${escapeHTML(p.mainConcern || '')}">
      </div>
      <div class="form-group">
        <label for="mEpAllergies">Alergias / precauciones</label>
        <input id="mEpAllergies" class="form-control" maxlength="160" value="${escapeHTML(p.allergies || '')}">
      </div>
      <p id="mEpMsg" class="form-message" hidden></p>
    `,
    `
      <button class="btn-soft" onclick="closeModal()">Cancelar</button>
      <button class="btn-gold" onclick="savePatientEdits('${escapeHTML(p.id)}')">Guardar cambios</button>
    `
  );
}

function savePatientEdits(patientId) {
  const p = state.patients.find(x => x.id === patientId);
  if (!p) return;
  const msg = document.getElementById('mEpMsg');
  const name = document.getElementById('mEpName').value.trim();
  const email = document.getElementById('mEpEmail').value.trim();
  const ageRaw = document.getElementById('mEpAge').value;
  if (name.length < 3) {
    msg.textContent = 'Escribe el nombre completo.';
    msg.hidden = false;
    return;
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    msg.textContent = 'Revisa el correo.';
    msg.hidden = false;
    return;
  }
  const age = Number(ageRaw);
  Object.assign(p, {
    name,
    initials: getInitials(name),
    phone: document.getElementById('mEpPhone').value.trim(),
    email,
    age: ageRaw && age >= 12 && age <= 110 ? Math.round(age) : null,
    skinBiotype: document.getElementById('mEpBiotype').value.trim() || 'Por evaluar',
    fitzpatrick: document.getElementById('mEpFitz').value,
    mainConcern: document.getElementById('mEpConcern').value.trim() || 'Por definir',
    allergies: document.getElementById('mEpAllergies').value.trim() || 'Ninguna conocida'
  });
  // Las citas guardan el nombre de la paciente: se actualiza para que la agenda coincida
  state.appointments.forEach(a => {
    if (a.patientId === p.id) {
      a.patientName = p.name;
      a.initials = p.initials;
    }
  });
  saveState();
  closeModal();
  showToast('Datos de la paciente actualizados.');
  renderWorkspace();
}

// ---------------------------------------------------------------------------
// Evaluaciones (seguimiento)
// ---------------------------------------------------------------------------
function openEvaluationModal(patientId, evalId) {
  const p = state.patients.find(x => x.id === patientId);
  if (!p) return;
  const log = progressLogOf(p);
  const existing = evalId ? log.find(e => e.id === evalId) : null;
  const base = existing || log[log.length - 1] || {};
  const me = getCurrentStaff();
  openModalWithHTML(
    existing ? 'Editar evaluación' : `Nueva evaluación — ${p.name}`,
    `
      <div class="form-row">
        <div class="form-group">
          <label for="mEvDate">Fecha</label>
          <input id="mEvDate" type="date" class="form-control" value="${escapeHTML(existing?.date || toISODate(new Date()))}">
        </div>
        <div class="form-group">
          <label for="mEvBy">Evaluó</label>
          <input id="mEvBy" class="form-control" list="evSpecialists" maxlength="80" value="${escapeHTML(existing?.specialistName ?? (me?.isMaster ? '' : me?.name || ''))}">
          <datalist id="evSpecialists">${state.specialists.map(s => `<option value="${escapeHTML(s.name)}">`).join('')}</datalist>
        </div>
      </div>
      <p class="admin-gate-hint" style="text-align:left;margin-top:-4px;">Califica cada indicador de 0 a 100 según lo observado hoy.</p>
      ${METRIC_DEFS.map(([k, label]) => `
        <div class="form-group eval-slider">
          <label for="mEv_${k}">${escapeHTML(label)} <output id="mEvOut_${k}">${Number(base[k]) || 0}%</output></label>
          <input id="mEv_${k}" type="range" min="0" max="100" step="1" value="${Number(base[k]) || 0}"
                 oninput="document.getElementById('mEvOut_${k}').textContent = this.value + '%'">
        </div>
      `).join('')}
      <div class="form-group">
        <label for="mEvNotes">Observaciones</label>
        <textarea id="mEvNotes" class="form-control" rows="3" maxlength="600" placeholder="Cómo se ve la piel, cambios desde la última visita, recomendaciones…">${escapeHTML(existing?.notes || '')}</textarea>
      </div>
    `,
    `
      <button class="btn-soft" onclick="closeModal()">Cancelar</button>
      <button class="btn-gold" onclick="saveEvaluation('${escapeHTML(p.id)}', ${existing ? `'${escapeHTML(existing.id)}'` : 'null'})">${existing ? 'Guardar cambios' : 'Guardar evaluación'}</button>
    `
  );
}

function saveEvaluation(patientId, evalId) {
  const p = state.patients.find(x => x.id === patientId);
  if (!p) return;
  const legacyIndex = evalId && evalId.startsWith('legacy-') ? Number(evalId.split('-')[1]) - 1 : -1;
  materializeProgressLog(p);
  const values = {
    date: document.getElementById('mEvDate').value || toISODate(new Date()),
    specialistName: document.getElementById('mEvBy').value.trim(),
    notes: document.getElementById('mEvNotes').value.trim()
  };
  METRIC_DEFS.forEach(([k]) => { values[k] = Number(document.getElementById(`mEv_${k}`).value) || 0; });

  const sorted = [...p.progressLog].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const target = legacyIndex >= 0 ? sorted[legacyIndex] : (evalId ? p.progressLog.find(e => e.id === evalId) : null);
  if (target) Object.assign(target, values);
  else p.progressLog.push({ id: `eval-${Date.now()}`, ...values });

  syncMetricsFromLog(p);
  saveState();
  closeModal();
  showToast(target ? 'Evaluación actualizada.' : 'Evaluación registrada.');
  renderWorkspace();
}

// Confirmación genérica para borrar registros del expediente
function openConfirmModal(title, message, action) {
  uiState.pendingConfirm = action;
  openModalWithHTML(
    title,
    `<p style="font-size:0.9rem;">${message}</p><p class="form-message">Esta acción no se puede deshacer.</p>`,
    `
      <button class="btn-soft" onclick="closeModal()">Cancelar</button>
      <button class="btn-danger" onclick="runPendingConfirm()">Eliminar</button>
    `
  );
}

function runPendingConfirm() {
  const action = uiState.pendingConfirm;
  uiState.pendingConfirm = null;
  closeModal();
  if (typeof action === 'function') action();
}

function askDeleteEvaluation(patientId, evalId) {
  const p = state.patients.find(x => x.id === patientId);
  const e = p && progressLogOf(p).find(x => x.id === evalId);
  if (!e) return;
  openConfirmModal('Eliminar evaluación', `Se eliminará la evaluación del ${escapeHTML(e.date ? formatDateLong(e.date) : 'registro sin fecha')}.`, () => {
    const legacyIndex = evalId.startsWith('legacy-') ? Number(evalId.split('-')[1]) - 1 : -1;
    materializeProgressLog(p);
    const sorted = [...p.progressLog].sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const target = legacyIndex >= 0 ? sorted[legacyIndex] : p.progressLog.find(x => x.id === evalId);
    p.progressLog = p.progressLog.filter(x => x !== target);
    syncMetricsFromLog(p);
    saveState();
    showToast('Evaluación eliminada.');
    renderWorkspace();
  });
}

// ---------------------------------------------------------------------------
// Sesiones: editar y eliminar
// ---------------------------------------------------------------------------
function openEditSessionModal(patientId, sessionId) {
  const p = state.patients.find(x => x.id === patientId);
  const ses = p?.sessions.find(s => s.id === sessionId);
  if (!ses) return;
  openModalWithHTML(
    'Editar sesión',
    `
      <div class="form-row">
        <div class="form-group">
          <label for="mEsDate">Fecha</label>
          <input id="mEsDate" type="date" class="form-control" value="${escapeHTML(ses.date)}">
        </div>
        <div class="form-group">
          <label for="mEsSpecialist">Especialista</label>
          <input id="mEsSpecialist" class="form-control" list="esSpecialists" value="${escapeHTML(ses.specialistName)}">
          <datalist id="esSpecialists">${state.specialists.map(s => `<option value="${escapeHTML(s.name)}">`).join('')}</datalist>
        </div>
      </div>
      <div class="form-group">
        <label for="mEsTreatment">Tratamiento</label>
        <input id="mEsTreatment" class="form-control" list="esTreatments" value="${escapeHTML(ses.treatmentName)}">
        <datalist id="esTreatments">${state.treatments.map(t => `<option value="${escapeHTML(t.name)}">`).join('')}</datalist>
      </div>
      <div class="form-group">
        <label for="mEsActives">Activos y aparatología</label>
        <input id="mEsActives" class="form-control" value="${escapeHTML(ses.activesApplied || '')}">
      </div>
      <div class="form-group">
        <label for="mEsResult">Resultado / respuesta de la piel (opcional)</label>
        <input id="mEsResult" class="form-control" maxlength="80" value="${escapeHTML(ses.improvementScore || '')}" placeholder="Ej. Buena tolerancia, leve eritema">
      </div>
      <div class="form-group">
        <label for="mEsNotes">Evolución y observaciones</label>
        <textarea id="mEsNotes" class="form-control" rows="3">${escapeHTML(ses.notes || '')}</textarea>
      </div>
      <p class="admin-gate-hint" style="text-align:left;">Editar no cambia cobros ni inventario ya registrados.</p>
    `,
    `
      <button class="btn-soft" onclick="closeModal()">Cancelar</button>
      <button class="btn-gold" onclick="saveSessionEdits('${escapeHTML(p.id)}', '${escapeHTML(ses.id)}')">Guardar cambios</button>
    `
  );
}

function saveSessionEdits(patientId, sessionId) {
  const p = state.patients.find(x => x.id === patientId);
  const ses = p?.sessions.find(s => s.id === sessionId);
  if (!ses) return;
  Object.assign(ses, {
    date: document.getElementById('mEsDate').value || ses.date,
    specialistName: document.getElementById('mEsSpecialist').value.trim() || ses.specialistName,
    treatmentName: document.getElementById('mEsTreatment').value.trim() || ses.treatmentName,
    activesApplied: document.getElementById('mEsActives').value.trim(),
    improvementScore: document.getElementById('mEsResult').value.trim(),
    notes: document.getElementById('mEsNotes').value.trim()
  });
  saveState();
  closeModal();
  showToast('Sesión actualizada.');
  renderWorkspace();
}

function askDeleteSession(patientId, sessionId) {
  const p = state.patients.find(x => x.id === patientId);
  const ses = p?.sessions.find(s => s.id === sessionId);
  if (!ses) return;
  openConfirmModal('Eliminar sesión', `Se eliminará la sesión de <strong>${escapeHTML(ses.treatmentName)}</strong> del ${escapeHTML(formatDateLong(ses.date))} del expediente. Los cobros e inventario no cambian.`, () => {
    p.sessions = p.sessions.filter(s => s.id !== sessionId);
    saveState();
    showToast('Sesión eliminada del expediente.');
    renderWorkspace();
  });
}

function renderSkinMetricBar(label, beforeVal, currentVal) {
  return `
    <div class="metric-item">
      <div class="metric-item-top">
        <span>${label}</span>
        <span style="color:var(--gold-hover);">Antes: ${beforeVal}% → <strong>Ahora: ${currentVal}%</strong></span>
      </div>
      <div class="kpi-progress-track">
        <div class="kpi-progress-bar" style="width: ${currentVal}%;"></div>
      </div>
    </div>
  `;
}

function saveRoutineChanges(patientId) {
  const patient = state.patients.find(p => p.id === patientId);
  if (!patient) return;
  const amEl = document.getElementById(`routineAM_${patientId}`);
  const pmEl = document.getElementById(`routinePM_${patientId}`);
  if (amEl) patient.homeRoutineAM = amEl.value;
  if (pmEl) patient.homeRoutinePM = pmEl.value;
  saveState();
  showToast(`Rutina en casa actualizada para ${patient.name} (sincronizada con su portal de cliente).`);
}

// ============================================================================
// 4. VISTA INVENTARIO (CABINA Y VENTA RETAIL)
// ============================================================================
function renderInventoryView() {
  const categories = ['Todos', 'Insumo de Cabina', 'Venta Retail (Skincare)'];
  const items = state.inventory.filter(item => {
    const matchCat = uiState.inventoryFilter === 'Todos' || item.category === uiState.inventoryFilter;
    const matchSearch = !uiState.searchQuery || item.name.toLowerCase().includes(uiState.searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });

  const lowStockCount = state.inventory.filter(i => i.stock <= i.minStock).length;
  const totalInventoryValue = state.inventory.reduce((sum, i) => sum + i.stock * i.unitCost, 0);

  return `
    <div class="action-bar">
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        ${categories.map(cat => `
          <button class="btn-soft"
                  style="${uiState.inventoryFilter === cat ? 'background:var(--gold-primary);color:#fff;border-color:var(--gold-primary);' : ''}"
                  onclick="setInventoryFilter('${cat}')">
            ${cat}
          </button>
        `).join('')}
      </div>
      <button class="btn-gold" onclick="openInventoryModal()">
        <span>＋</span> Agregar Producto / Insumo
      </button>
    </div>

    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label">Total Referencias en Inventario</div>
        <div class="kpi-value">${state.inventory.length} Productos</div>
        <div class="kpi-subtext"><span>Insumos de cabina y productos de skincare</span></div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Alertas de Reabastecimiento</div>
        <div class="kpi-value" style="color:${lowStockCount > 0 ? 'var(--status-warning-text)' : 'var(--status-success-text)'};">
          ${lowStockCount} en Stock Bajo
        </div>
        <div class="kpi-subtext"><span>Se descuentan automáticamente al registrar sesiones</span></div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Valor Costo en Almacén</div>
        <div class="kpi-value">${formatMoney(totalInventoryValue)}</div>
        <div class="kpi-subtext"><span>Costo acumulado de existencias actuales</span></div>
      </div>
    </div>

    <div class="surface-card">
      <div class="card-header">
        <h2>Control de Existencias (${items.length})</h2>
      </div>
      <div class="card-subhead" style="grid-template-columns: 2.2fr 1.2fr 1fr 1fr 160px;">
        <span>Producto / Insumo</span>
        <span>Categoría</span>
        <span>Existencia Actual</span>
        <span>Costo / Precio Venta</span>
        <span style="text-align:right;">Ajuste / Venta</span>
      </div>
      <div class="list-rows">
        ${items.map(item => {
          const isLow = item.stock <= item.minStock;
          return `
            <div class="list-row" style="grid-template-columns: 2.2fr 1.2fr 1fr 1fr 160px;">
              <div class="row-entity">
                <div class="pastel-avatar ${isLow ? 'pastel-amber' : 'pastel-sage'}">${isLow ? '⚠️' : '🧴'}</div>
                <div class="entity-text">
                  <h4>${item.name}</h4>
                  <p>SKU: ${item.sku} • Mínimo: ${item.minStock} ${item.unit}</p>
                </div>
              </div>
              <div>
                <span class="skin-tag">${item.category}</span>
              </div>
              <div>
                <span class="status-pill ${isLow ? 'status-pending' : 'status-confirmed'}">
                  <span class="dot"></span>
                  ${item.stock} ${item.unit}
                </span>
              </div>
              <div class="entity-text">
                <h4>Costo: ${formatMoney(item.unitCost)}</h4>
                <p>${item.salePrice > 0 ? `Venta: ${formatMoney(item.salePrice)}` : 'Uso exclusivo cabina'}</p>
              </div>
              <div class="row-actions">
                <button class="btn-soft btn-sm" title="Descontar 1 unidad" onclick="restockItem('${item.id}', -1)">−</button>
                <button class="btn-soft btn-sm" title="Abastecer 1 unidad" onclick="restockItem('${item.id}', 1)">+</button>
                ${item.salePrice > 0 ? `
                  <button class="btn-gold btn-sm" title="Registrar venta retail y sumar a finanzas" onclick="sellRetailProduct('${item.id}')">
                    Vender
                  </button>
                ` : ''}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function setInventoryFilter(cat) {
  uiState.inventoryFilter = cat;
  renderWorkspace();
}

function restockItem(itemId, delta) {
  const item = state.inventory.find(i => i.id === itemId);
  if (!item) return;
  item.stock = Math.max(0, item.stock + delta);
  saveState();
  showToast(`Stock de "${item.name}" actualizado a ${item.stock} ${item.unit}.`);
  renderWorkspace();
}

function sellRetailProduct(itemId) {
  const item = state.inventory.find(i => i.id === itemId);
  if (!item || item.stock <= 0) {
    showToast('No hay stock disponible de este producto.');
    return;
  }
  item.stock -= 1;
  state.finances.unshift({
    id: 'fin-' + Date.now(),
    date: uiState.selectedDate,
    concept: `Venta Skincare: ${item.name}`,
    category: 'Venta Retail Skincare',
    type: 'Ingreso',
    method: 'Tarjeta / POS',
    amount: item.salePrice
  });
  saveState();
  showToast(`Venta registrada: ${formatMoney(item.salePrice)} sumados a Finanzas.`);
  renderWorkspace();
}

// ============================================================================
// 5. VISTA CATÁLOGO DE TRATAMIENTOS Y PROTOCOLOS
// ============================================================================
function renderTreatmentsView() {
  return `
    <div class="action-bar">
      <div>
        <span style="font-size:0.86rem;color:var(--text-secondary);">
          Protocolos faciales y corporales disponibles tanto en la agenda administrativa como en el portal de citas de clientes.
        </span>
      </div>
      <button class="btn-gold" onclick="openNewTreatmentModal()">
        <span>＋</span> Nuevo Protocolo / Tratamiento
      </button>
    </div>

    <div class="treatment-grid">
      ${state.treatments.length ? state.treatments.map(t => `
        <article class="surface-card treatment-card">
          <div>
            <div class="treatment-card-top">
              <span class="skin-tag">${escapeHTML(t.category)}</span>
              <span class="treatment-duration">⏱ ${escapeHTML(t.durationMin)} min</span>
            </div>
            <h3>${escapeHTML(t.name)}</h3>
            ${t.description ? `<p class="treatment-desc">${escapeHTML(t.description)}</p>` : ''}
            ${(t.suppliesUsed || []).length ? `<p class="treatment-supplies">Insumos por sesión: ${(t.suppliesUsed || []).map(u => escapeHTML(state.inventory.find(i => i.id === u.inventoryId)?.name || 'insumo')).join(', ')}</p>` : ''}
          </div>
          <div class="treatment-card-foot">
            <div>
              <div class="treatment-price">${formatMoney(t.price)}</div>
              <div class="treatment-deposit">${depositForTreatment(t) ? `Depósito reserva: ${formatMoney(depositForTreatment(t))}` : 'Sin depósito • paga al finalizar'}</div>
            </div>
            <div class="treatment-actions">
              <button class="round-action-btn" title="Editar" aria-label="Editar ${escapeHTML(t.name)}" onclick="openTreatmentModal('${escapeHTML(t.id)}')">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
              </button>
              <button class="round-action-btn danger-btn" title="Eliminar" aria-label="Eliminar ${escapeHTML(t.name)}" onclick="askDelete('treatment', '${escapeHTML(t.id)}')">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>
              </button>
              <button class="btn-soft btn-sm" onclick="openAppointmentModal('${escapeHTML(t.id)}')">Agendar</button>
            </div>
          </div>
        </article>
      `).join('') : `
        <div class="surface-card" style="padding:28px;text-align:center;color:var(--text-secondary);grid-column:1/-1;">
          Aún no hay tratamientos. Crea el primero con <strong>Nuevo Protocolo / Tratamiento</strong>.
        </div>
      `}
    </div>
  `;
}

// ============================================================================
// 6. VISTA FINANZAS Y FLUJO DE CAJA
// ============================================================================
function renderFinancesView() {
  const incomes = state.finances.filter(f => f.type === 'Ingreso');
  const expenses = state.finances.filter(f => f.type === 'Gasto');
  const totalIn = incomes.reduce((s, f) => s + Number(f.amount), 0);
  const totalOut = expenses.reduce((s, f) => s + Number(f.amount), 0);
  const net = totalIn - totalOut;

  const filtered = state.finances.filter(f => {
    if (uiState.financeFilter === 'Todos') return true;
    return f.type === uiState.financeFilter;
  });

  return `
    <div class="action-bar">
      <div style="display:flex;gap:8px;">
        ${['Todos', 'Ingreso', 'Gasto'].map(fType => `
          <button class="btn-soft"
                  style="${uiState.financeFilter === fType ? 'background:var(--gold-primary);color:#fff;border-color:var(--gold-primary);' : ''}"
                  onclick="setFinanceFilter('${fType}')">
            ${fType === 'Todos' ? 'Todos los Movimientos' : fType + 's'}
          </button>
        `).join('')}
      </div>
      <div style="display:flex;gap:10px;">
        <button class="btn-gold" onclick="openFinanceModal()">
          <span>＋</span> Registrar Ingreso o Gasto
        </button>
      </div>
    </div>

    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label">Ingresos Totales (Citas + Retail)</div>
        <div class="kpi-value" style="color:var(--status-success-text);">${formatMoney(totalIn)}</div>
        <div class="kpi-subtext"><span>${incomes.length} transacciones de ingreso</span></div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Gastos Operativos e Insumos</div>
        <div class="kpi-value" style="color:var(--status-danger-text);">${formatMoney(totalOut)}</div>
        <div class="kpi-subtext"><span>${expenses.length} registros de gasto</span></div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Utilidad Neta / Caja Actual</div>
        <div class="kpi-value">${formatMoney(net)}</div>
        <div class="kpi-subtext"><span>Rentabilidad positiva del estudio</span></div>
      </div>
    </div>

    <div class="surface-card">
      <div class="card-header">
        <h2>Libro de Movimientos Financieros (${filtered.length})</h2>
      </div>
      <div class="card-subhead" style="grid-template-columns: 2.3fr 1.2fr 1.1fr 1fr 130px;">
        <span>Concepto / Cliente</span>
        <span>Categoría</span>
        <span>Método de Pago</span>
        <span>Fecha</span>
        <span style="text-align:right;">Monto</span>
      </div>
      <div class="list-rows">
        ${filtered.map(f => {
          const isIncome = f.type === 'Ingreso';
          return `
            <div class="list-row" style="grid-template-columns: 2.3fr 1.2fr 1.1fr 1fr 130px;">
              <div class="row-entity">
                <div class="pastel-avatar ${isIncome ? 'pastel-sage' : 'pastel-rose'}">${isIncome ? '↑' : '↓'}</div>
                <div class="entity-text">
                  <h4>${f.concept}</h4>
                  <p>${f.type}</p>
                </div>
              </div>
              <div><span class="skin-tag">${f.category}</span></div>
              <div class="entity-text"><p>${f.method}</p></div>
              <div class="entity-text"><p>${f.date}</p></div>
              <div style="text-align:right;font-weight:700;color:${isIncome ? 'var(--status-success-text)' : 'var(--status-danger-text)'};">
                ${isIncome ? '+' : '-'}${formatMoney(f.amount)}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function setFinanceFilter(filter) {
  uiState.financeFilter = filter;
  renderWorkspace();
}

// ============================================================================
// 7. APARTADO PARA CLIENTES ("MI ESPACIO NISKIN" - BOCETO MÓVIL 3 + RÉCORD)
// ============================================================================
function previewClientPortalFor(patientId) {
  uiState.portalClientId = patientId;
  uiState.portalTab = 'record';
  switchView('client-portal');
}

function setPortalClient(patientId) {
  uiState.portalClientId = patientId;
  renderWorkspace();
}

function setPortalTab(tabName) {
  uiState.portalTab = tabName;
  renderWorkspace();
}

function selectPortalSpecialist(espId) {
  uiState.portalSelectedSpecialistId = espId;
  renderWorkspace();
}

function selectPortalTreatment(tratId) {
  uiState.portalSelectedTreatmentId = tratId;
  renderWorkspace();
}

function selectPortalSlot(slot) {
  uiState.portalSelectedSlot = slot;
  renderWorkspace();
}

function renderClientPortalView() {
  const client = state.patients.find(p => p.id === uiState.portalClientId) || state.patients[0];
  const selectedTreatment = state.treatments.find(t => t.id === uiState.portalSelectedTreatmentId) || state.treatments[0];
  const clientAppointments = state.appointments.filter(a => a.patientId === client.id);

  return `
    <div class="action-bar">
      <div>
        <span style="font-size:0.88rem;color:var(--text-secondary);">
          <strong>Vista Interactiva del Cliente:</strong> A la izquierda tienes el teléfono móvil con el flujo de reserva fiel a tu boceto, y a la derecha el panel personal donde <strong>${client.name}</strong> revisa sus fotos de mejoría, historial y rutina.
        </span>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button class="btn-soft ${uiState.portalTab === 'booking' ? 'active' : ''}"
                style="${uiState.portalTab === 'booking' ? 'background:var(--gold-primary);color:#fff;' : ''}"
                onclick="setPortalTab('booking')">
          📅 1. Agendar Cita en Móvil
        </button>
        <button class="btn-soft ${uiState.portalTab === 'record' ? 'active' : ''}"
                style="${uiState.portalTab === 'record' ? 'background:var(--gold-primary);color:#fff;' : ''}"
                onclick="setPortalTab('record')">
          ✨ 2. Ver Mi Récord en Móvil
        </button>
      </div>
    </div>

    <div class="client-portal-stage">
      <div class="phone-mockup">
        <div class="phone-topbar">
          <button class="phone-plus-btn" onclick="setPortalTab('booking')" title="Nueva Reserva">＋</button>
          <img src="assets/logo.svg" alt="Niskin Beauty Studio" style="height:34px;">
          <button class="phone-menu-btn" onclick="setPortalTab(uiState.portalTab === 'booking' ? 'record' : 'booking')" title="Cambiar entre Reserva y Mi Récord">
            ☰
          </button>
        </div>

        <div class="phone-body">
          <div class="phone-user-pill">
            <div style="display:flex;align-items:center;gap:10px;width:100%;">
              <span class="phone-user-dot"></span>
              <select class="phone-user-select" onchange="setPortalClient(this.value)" aria-label="Seleccionar clienta activa">
                ${state.patients.map(p => `
                  <option value="${p.id}" ${p.id === client.id ? 'selected' : ''}>
                    Clienta: ${p.name} (${p.skinBiotype})
                  </option>
                `).join('')}
              </select>
            </div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;background:var(--bg-subtle);padding:4px;border-radius:12px;">
            <button class="mode-btn ${uiState.portalTab === 'booking' ? 'active' : ''}" style="justify-content:center;" onclick="setPortalTab('booking')">
              Agendar Cita
            </button>
            <button class="mode-btn ${uiState.portalTab === 'record' ? 'active' : ''}" style="justify-content:center;" onclick="setPortalTab('record')">
              Mi Récord y Progreso
            </button>
          </div>

          ${uiState.portalTab === 'booking' ? `
            <div>
              <label style="font-size:0.75rem;font-weight:700;text-transform:uppercase;color:var(--text-secondary);display:block;margin-bottom:6px;">
                Paso 1: Elige tu Tratamiento Niskin
              </label>
              <select class="form-control" style="width:100%;background:#FFFFFF;" onchange="selectPortalTreatment(this.value)">
                ${state.treatments.map(t => `
                  <option value="${t.id}" ${t.id === selectedTreatment.id ? 'selected' : ''}>
                    ${t.name} — ${formatMoney(t.price)} (${t.durationMin}m)
                  </option>
                `).join('')}
              </select>
            </div>

            <div>
              <label style="font-size:0.75rem;font-weight:700;text-transform:uppercase;color:var(--text-secondary);display:block;margin-bottom:6px;">
                Paso 2: Especialista Cosmetóloga
              </label>
              <div class="phone-selectable-list">
                ${state.specialists.slice(0, 2).map(esp => {
                  const isSel = esp.id === uiState.portalSelectedSpecialistId;
                  return `
                    <div class="phone-select-card ${isSel ? 'selected' : ''}" onclick="selectPortalSpecialist('${esp.id}')">
                      <div class="phone-card-left">
                        <div class="phone-avatar-box">
                          <svg width="44" height="44" viewBox="0 0 48 48" fill="none">
                            <circle cx="24" cy="17" r="9" fill="#C8B09B"/>
                            <path d="M20 16 Q24 19 28 16" stroke="#8C6D53" stroke-width="1.6" fill="none" stroke-linecap="round"/>
                            <path d="M10 42 C12 31, 36 31, 38 42" fill="#A98B73"/>
                          </svg>
                        </div>
                        <div>
                          <div style="font-size:0.9rem;font-weight:700;color:var(--text-primary);">${esp.name}</div>
                          <div style="font-size:0.75rem;color:var(--text-secondary);">${esp.specialty}</div>
                        </div>
                      </div>
                      <div class="phone-check-circle">✓</div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>

            <div class="surface-card" style="padding:14px 16px;border-radius:18px;">
              ${renderCalendarWidget('portal')}
            </div>

            <div>
              <label style="font-size:0.75rem;font-weight:700;text-transform:uppercase;color:var(--text-secondary);display:block;margin-bottom:6px;">
                Paso 3: Horario Disponible (${uiState.portalSelectedDate})
              </label>
              ${(() => {
                const slots = portalPreviewSlots();
                if (!slots.length) {
                  return `<div class="slot-empty">${isClosedDay(uiState.portalSelectedDate) ? 'El estudio no abre ese día.' : 'No quedan horarios ese día.'}</div>`;
                }
                return `
                  <div class="phone-slots-grid">
                    ${slots.map(s => `
                      <button class="phone-slot-pill ${uiState.portalSelectedSlot === s.time ? 'selected' : ''} ${s.status === 'taken' ? 'taken' : ''}"
                              ${s.status === 'taken' ? 'disabled aria-disabled="true" title="Ya hay una cita en este horario"' : `onclick="selectPortalSlot('${s.time}')"`}>
                        ${s.time}
                        ${s.status === 'taken' ? '<small>Ocupado</small>' : ''}
                      </button>
                    `).join('')}
                  </div>
                `;
              })()}
            </div>

            <button class="phone-cta-btn" onclick="submitClientPortalBooking()">
              <span>Confirmar Cita • ${formatMoney(selectedTreatment.price)}</span>
              <span style="font-size:1.2rem;">›</span>
            </button>
          ` : `
            <div style="display:flex;flex-direction:column;gap:14px;">
              <div style="background:#FFFFFF;padding:12px 14px;border-radius:14px;border:1px solid var(--border-light);">
                <div style="font-size:0.84rem;font-weight:700;margin-bottom:4px;">☀️ Mi Rutina de Día (AM)</div>
                <p style="font-size:0.76rem;color:var(--text-secondary);white-space:pre-line;">${client.homeRoutineAM}</p>
              </div>
              <div style="background:#FFFFFF;padding:12px 14px;border-radius:14px;border:1px solid var(--border-light);">
                <div style="font-size:0.84rem;font-weight:700;margin-bottom:4px;">🌙 Mi Rutina de Noche (PM)</div>
                <p style="font-size:0.76rem;color:var(--text-secondary);white-space:pre-line;">${client.homeRoutinePM}</p>
              </div>
            </div>
          `}
        </div>
      </div>

      <div class="surface-card">
        <div class="clinical-detail-header">
          <div>
            <span class="skin-tag" style="margin-bottom:6px;display:inline-block;">✨ Portal Personal del Cliente</span>
            <h2 style="font-family:var(--font-serif);font-size:1.75rem;">Hola, ${client.name}</h2>
            <p style="font-size:0.86rem;color:var(--text-secondary);">
              Diagnóstico Niskin: <strong>${client.skinBiotype}</strong> (${client.fitzpatrick}) • Objetivo: ${client.mainConcern}
            </p>
          </div>
        </div>

        <div class="clinical-body">
          <div>
            <h3 style="font-family:var(--font-serif);font-size:1.35rem;margin-bottom:6px;">
              Mi Progreso
            </h3>
            <div>
              <div class="metrics-progress-list">
                <div style="font-size:0.88rem;font-weight:700;color:var(--gold-hover);">
                  Progreso de Salud Cutánea
                </div>
                ${renderSkinMetricBar('Nivel de Hidratación', client.metrics.hydration.before, client.metrics.hydration.current)}
                ${renderSkinMetricBar('Luminosidad y Tono Uniforme', client.metrics.toneUniformity.before, client.metrics.toneUniformity.current)}
                ${renderSkinMetricBar('Suavidad y Textura', client.metrics.texturePores.before, client.metrics.texturePores.current)}
                ${renderSkinMetricBar('Piel Libre de Imperfecciones', client.metrics.blemishControl.before, client.metrics.blemishControl.current)}
              </div>
            </div>
          </div>

          <div>
            <h3 style="font-family:var(--font-serif);font-size:1.3rem;margin-bottom:10px;">
              Mis Citas Reservadas (${clientAppointments.length})
            </h3>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(min(260px,100%),1fr));gap:12px;">
              ${clientAppointments.map(app => `
                <div style="background:#FBFAF7;border:1px solid var(--border-card);border-radius:12px;padding:14px;">
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                    <strong style="font-size:0.88rem;">📅 ${app.date} • ${app.time}</strong>
                    <span class="status-pill status-confirmed"><span class="dot"></span>${app.status}</span>
                  </div>
                  <div style="font-size:0.9rem;font-weight:600;color:var(--gold-hover);">${app.treatmentName}</div>
                  <div style="font-size:0.78rem;color:var(--text-secondary);margin-top:4px;">Especialista: ${app.specialistName}</div>
                </div>
              `).join('')}
            </div>
          </div>

          <div>
            <h3 style="font-family:var(--font-serif);font-size:1.3rem;margin-bottom:10px;">
              Mi Rutina de Skincare en Casa (Indicada por tu Cosmetóloga)
            </h3>
            <div class="routine-grid">
              <div class="routine-box">
                <h4>☀️ Paso a Paso de Día (AM)</h4>
                <p style="font-size:0.84rem;white-space:pre-line;color:var(--text-primary);">${client.homeRoutineAM}</p>
              </div>
              <div class="routine-box">
                <h4>🌙 Paso a Paso de Noche (PM)</h4>
                <p style="font-size:0.84rem;white-space:pre-line;color:var(--text-primary);">${client.homeRoutinePM}</p>
              </div>
            </div>
          </div>

          <div>
            <h3 style="font-family:var(--font-serif);font-size:1.3rem;margin-bottom:10px;">
              Mi Récord de Tratamientos en Cabina (${client.sessions.length})
            </h3>
            <div class="session-timeline">
              ${client.sessions.map(s => `
                <div class="session-card">
                  <div class="session-card-top">
                    <strong>${s.treatmentName}</strong>
                    <span class="status-pill status-confirmed"><span class="dot"></span>${s.improvementScore ? `Resultado: ${escapeHTML(s.improvementScore)} • ` : ''}${s.date}</span>
                  </div>
                  <p style="font-size:0.82rem;color:var(--text-secondary);"><strong>Activos aplicados en tu piel:</strong> ${s.activesApplied}</p>
                  <p style="font-size:0.84rem;margin-top:4px;"><strong>Notas de tu especialista (${s.specialistName}):</strong> ${s.notes}</p>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

// Horarios de la vista previa del portal: los que ya tienen cita aparecen deshabilitados
function portalPreviewSlots() {
  const date = uiState.portalSelectedDate;
  if (isClosedDay(date)) return [];
  const now = new Date();
  const todayIso = toISODate(now);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const slots = slotStatusesFor({
    date,
    specialistId: uiState.portalSelectedSpecialistId,
    treatmentId: uiState.portalSelectedTreatmentId
  }).filter(s => date > todayIso || (date === todayIso && slotMinutes(s.time) > nowMinutes));
  const selected = slots.find(s => s.time === uiState.portalSelectedSlot);
  if (!selected || selected.status !== 'available') {
    uiState.portalSelectedSlot = slots.find(s => s.status === 'available')?.time || '';
  }
  return slots;
}

function submitClientPortalBooking() {
  const client = state.patients.find(p => p.id === uiState.portalClientId);
  const specialist = state.specialists.find(s => s.id === uiState.portalSelectedSpecialistId);
  const treatment = state.treatments.find(t => t.id === uiState.portalSelectedTreatmentId);
  if (!client || !specialist || !treatment) return;
  const slot = portalPreviewSlots().find(s => s.time === uiState.portalSelectedSlot);
  if (!slot || slot.status !== 'available') {
    showToast('Elige un horario disponible.');
    renderWorkspace();
    return;
  }
  const deposit = depositForTreatment(treatment);

  const newAppointment = {
    id: 'cita-' + Date.now(),
    patientId: client.id,
    patientName: client.name,
    pastelClass: client.pastelClass || 'pastel-rose',
    initials: client.initials,
    treatmentId: treatment.id,
    treatmentName: treatment.name,
    specialistId: specialist.id,
    specialistName: specialist.name,
    date: uiState.portalSelectedDate,
    time: uiState.portalSelectedSlot,
    price: treatment.price,
    depositPaid: 0,
    paymentMode: deposit > 0 ? 'deposito' : 'al-finalizar',
    status: deposit > 0 ? 'Pendiente Depósito' : 'Confirmada'
  };

  state.appointments.unshift(newAppointment);

  saveState();
  showToast(`¡Cita agendada con éxito para ${client.name} el ${uiState.portalSelectedDate} a las ${uiState.portalSelectedSlot}!`);
  renderWorkspace();
}

// ============================================================================
// MODALES DE CREACIÓN
// ============================================================================
function closeModal() {
  const backdrop = document.getElementById('modalBackdrop');
  if (backdrop) backdrop.classList.remove('open');
}

function openModalWithHTML(title, bodyHTML, footerHTML) {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = bodyHTML;
  document.getElementById('modalFooter').innerHTML = footerHTML;
  document.getElementById('modalBackdrop').classList.add('open');
}

function refreshAppointmentTimeOptions() {
  const date = document.getElementById('mAppDate')?.value;
  const select = document.getElementById('mAppTime');
  const hint = document.getElementById('mAppTimeHint');
  if (!date || !select) return;
  const slots = slotStatusesFor({
    date,
    specialistId: document.getElementById('mAppSpecialist').value,
    treatmentId: document.getElementById('mAppTreatment').value
  });
  const previous = select.value;
  select.innerHTML = slots.map(s => `
    <option value="${s.time}" ${s.status === 'taken' ? 'disabled' : ''} ${s.time === previous && s.status === 'available' ? 'selected' : ''}>
      ${s.time}${s.status === 'taken' ? ' — ocupado' : ''}
    </option>
  `).join('');
  if (!select.value || select.selectedOptions[0]?.disabled) {
    const first = slots.find(s => s.status === 'available');
    if (first) select.value = first.time;
  }
  if (hint) {
    const free = slots.filter(s => s.status === 'available').length;
    hint.textContent = isClosedDay(date)
      ? 'Este día está cerrado en Configuración; puedes agendar igualmente.'
      : free ? `${free} horario(s) libre(s) para esta especialista.` : 'No quedan horarios libres para esta especialista.';
  }
}

function openAppointmentModal(preselectedTreatmentId, preselectedDate, preselectedPatientId) {
  const tId = preselectedTreatmentId || state.treatments[0]?.id;
  openModalWithHTML(
    'Agendar Nueva Cita en Niskin Beauty Studio',
    `
      <div class="form-group">
        <label>Paciente</label>
        <select id="mAppPatient" class="form-control">
          ${state.patients.map(p => `<option value="${p.id}" ${p.id === preselectedPatientId ? 'selected' : ''}>${escapeHTML(p.name)} (${escapeHTML(p.skinBiotype)})</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Tratamiento / Protocolo</label>
        <select id="mAppTreatment" class="form-control" onchange="refreshAppointmentTimeOptions()">
          ${state.treatments.map(t => `<option value="${t.id}" ${t.id === tId ? 'selected' : ''}>${t.name} — ${formatMoney(t.price)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Especialista Asignada</label>
        <select id="mAppSpecialist" class="form-control" onchange="refreshAppointmentTimeOptions()">
          ${state.specialists.map(s => `<option value="${s.id}">${s.name} (${s.role})</option>`).join('')}
        </select>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Fecha de la Cita</label>
          <input type="date" id="mAppDate" class="form-control" value="${preselectedDate || uiState.selectedDate}" onchange="refreshAppointmentTimeOptions()">
        </div>
        <div class="form-group">
          <label>Hora</label>
          <select id="mAppTime" class="form-control"></select>
          <span id="mAppTimeHint" style="font-size:0.74rem;color:var(--text-muted);"></span>
        </div>
      </div>
      <div class="form-group">
        <label>Estado del Depósito</label>
        <select id="mAppStatus" class="form-control">
          <option value="Confirmada">Confirmada (con depósito pagado)</option>
          <option value="Confirmada-sin-deposito">Confirmada sin depósito (paga al finalizar)</option>
          <option value="Pendiente Depósito">Pendiente de depósito</option>
        </select>
      </div>
    `,
    `
      <button class="btn-soft" onclick="closeModal()">Cancelar</button>
      <button class="btn-gold" onclick="saveNewAppointment()">Guardar Cita</button>
    `
  );
  refreshAppointmentTimeOptions();
}

function saveNewAppointment() {
  const patId = document.getElementById('mAppPatient').value;
  const tratId = document.getElementById('mAppTreatment').value;
  const espId = document.getElementById('mAppSpecialist').value;
  const date = document.getElementById('mAppDate').value;
  const time = document.getElementById('mAppTime').value;
  const statusChoice = document.getElementById('mAppStatus').value;
  const payAtEnd = statusChoice === 'Confirmada-sin-deposito';
  const status = payAtEnd ? 'Confirmada' : statusChoice;

  const pat = state.patients.find(p => p.id === patId);
  const trat = state.treatments.find(t => t.id === tratId);
  const esp = state.specialists.find(s => s.id === espId);
  if (!pat || !trat || !esp) return;
  const slot = slotStatusesFor({ date, specialistId: espId, treatmentId: tratId }).find(s => s.time === time);
  if (!time || !slot || slot.status !== 'available') {
    showToast('Ese horario ya está ocupado para esta especialista. Elige otro.');
    return;
  }

  const deposit = status === 'Confirmada' && !payAtEnd ? (depositForTreatment(trat) || trat.depositRequired) : 0;

  state.appointments.unshift({
    id: 'cita-' + Date.now(),
    patientId: pat.id,
    patientName: pat.name,
    pastelClass: pat.pastelClass,
    initials: pat.initials,
    treatmentId: trat.id,
    treatmentName: trat.name,
    specialistId: esp.id,
    specialistName: esp.name,
    date,
    time,
    price: trat.price,
    depositPaid: deposit,
    paymentMode: payAtEnd ? 'al-finalizar' : 'deposito',
    status
  });

  if (deposit > 0) {
    state.finances.unshift({
      id: 'fin-' + Date.now(),
      date,
      concept: `Depósito Cita ${trat.name} — ${pat.name}`,
      category: 'Depósito de Reserva',
      type: 'Ingreso',
      method: 'Transferencia Bancaria',
      amount: deposit
    });
  }

  saveState();
  closeModal();
  showToast(`Cita agendada para ${pat.name} el ${date} a las ${time}.`);
  renderWorkspace();
}

function openNewPatientModal() {
  openModalWithHTML(
    'Crear Nuevo Expediente Clínico de Paciente',
    `
      <div class="form-row">
        <div class="form-group">
          <label>Nombre Completo</label>
          <input type="text" id="mPatName" class="form-control" placeholder="Ej. Sofía Rodríguez">
        </div>
        <div class="form-group">
          <label>Edad</label>
          <input type="number" id="mPatAge" class="form-control" value="28">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Teléfono / WhatsApp</label>
          <input type="text" id="mPatPhone" class="form-control" placeholder="809-555-0000">
        </div>
        <div class="form-group">
          <label>Correo Electrónico</label>
          <input type="email" id="mPatEmail" class="form-control" placeholder="cliente@email.com">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Biotipo Cutáneo</label>
          <select id="mPatBiotype" class="form-control">
            <option>Piel Mixta Deshidratada</option>
            <option>Piel Grasa / Tendencia Acneica</option>
            <option>Piel Seca / Alípica</option>
            <option>Piel Sensible / Reactiva</option>
            <option>Piel Normal / Eudérmica</option>
          </select>
        </div>
        <div class="form-group">
          <label>Fototipo Fitzpatrick</label>
          <select id="mPatFitz" class="form-control">
            <option>Fototipo II</option>
            <option>Fototipo III</option>
            <option selected>Fototipo IV</option>
            <option>Fototipo V</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>Motivo de Consulta / Condición Principal</label>
        <input type="text" id="mPatConcern" class="form-control" placeholder="Ej. Hiperpigmentación post-inflamatoria y poros dilatados">
      </div>
      <div class="form-group">
        <label>Alergias o Sensibilidades</label>
        <input type="text" id="mPatAllergies" class="form-control" value="Ninguna conocida">
      </div>
    `,
    `
      <button class="btn-soft" onclick="closeModal()">Cancelar</button>
      <button class="btn-gold" onclick="saveNewPatient()">Crear Expediente</button>
    `
  );
}

function saveNewPatient() {
  const name = document.getElementById('mPatName').value.trim();
  if (!name) {
    showToast('Por favor ingresa el nombre de la paciente.');
    return;
  }
  const age = Number(document.getElementById('mPatAge').value || 28);
  const phone = document.getElementById('mPatPhone').value.trim() || '809-555-0100';
  const email = document.getElementById('mPatEmail').value.trim() || 'paciente@niskin.com';
  const skinBiotype = document.getElementById('mPatBiotype').value;
  const fitzpatrick = document.getElementById('mPatFitz').value;
  const mainConcern = document.getElementById('mPatConcern').value.trim() || 'Luminosidad e hidratación facial';
  const allergies = document.getElementById('mPatAllergies').value.trim() || 'Ninguna';

  const newId = 'pac-' + Date.now();
  const pastelClass = PASTEL_CLASSES[state.patients.length % PASTEL_CLASSES.length];

  const newPatient = {
    id: newId,
    name,
    phone,
    email,
    age,
    pastelClass,
    initials: getInitials(name),
    skinBiotype,
    fitzpatrick,
    mainConcern,
    allergies,
    homeRoutineAM: '1. Gel Limpiador Suave Syndet\n2. Sérum Hidratante Ácido Hialurónico\n3. Protector Solar SPF 50+',
    homeRoutinePM: '1. Doble Limpieza Suave\n2. Sérum Renovador / Niacinamida\n3. Crema Reparadora con Ceramidas',
    metrics: {
      hydration: { before: 0, current: 0 },
      toneUniformity: { before: 0, current: 0 },
      texturePores: { before: 0, current: 0 },
      blemishControl: { before: 0, current: 0 }
    },
    sessions: [],
    progressLog: [],
    treatmentPlan: ''
  };

  state.patients.unshift(newPatient);
  uiState.selectedPatientId = newId;
  saveState();
  closeModal();
  showToast(`Expediente clínico creado para ${name}.`);
  renderWorkspace();
}

function openNewSessionModal(patientId) {
  const pat = state.patients.find(p => p.id === patientId);
  if (!pat) return;
  const me = getCurrentStaff();

  openModalWithHTML(
    `Registrar sesión — ${pat.name}`,
    `
      <div class="form-row">
        <div class="form-group">
          <label for="mSesDate">Fecha</label>
          <input id="mSesDate" type="date" class="form-control" value="${toISODate(new Date())}">
        </div>
        <div class="form-group">
          <label for="mSesSpecialist">Especialista</label>
          <select id="mSesSpecialist" class="form-control">
            ${state.specialists.map(s => `<option value="${escapeHTML(s.name)}" ${s.id === me?.specialistId ? 'selected' : ''}>${escapeHTML(s.name)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-group">
        <label for="mSesTreatment">Tratamiento realizado</label>
        <select id="mSesTreatment" class="form-control">
          ${state.treatments.map(t => `<option value="${t.id}">${escapeHTML(t.name)} (${formatMoney(t.price)})</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label for="mSesActives">Activos y aparatología aplicada</label>
        <input type="text" id="mSesActives" class="form-control" placeholder="Ej. Exosomas, ácido hialurónico, LED roja 15 min">
      </div>
      <div class="form-group">
        <label for="mSesResult">Resultado / respuesta de la piel (opcional)</label>
        <input type="text" id="mSesResult" class="form-control" maxlength="80" placeholder="Ej. Buena tolerancia, leve eritema">
      </div>
      <div class="form-group">
        <label for="mSesNotes">Evolución y observaciones</label>
        <textarea id="mSesNotes" class="form-control" rows="3" placeholder="Cómo respondió la piel y recomendaciones post-tratamiento…"></textarea>
      </div>
      <label class="settings-switch"><input type="checkbox" id="mSesCharge" checked> <span>Registrar el cobro en Finanzas (no lo marques si la cita ya se cobró al completarla)</span></label>
      <label class="settings-switch"><input type="checkbox" id="mSesSupplies" checked> <span>Descontar los insumos del tratamiento del inventario</span></label>
    `,
    `
      <button class="btn-soft" onclick="closeModal()">Cancelar</button>
      <button class="btn-gold" onclick="saveNewSession('${escapeHTML(pat.id)}')">Registrar sesión</button>
    `
  );
}

function saveNewSession(patientId) {
  const pat = state.patients.find(p => p.id === patientId);
  const tratId = document.getElementById('mSesTreatment').value;
  const trat = state.treatments.find(t => t.id === tratId);
  if (!pat || !trat) return;
  const date = document.getElementById('mSesDate').value || toISODate(new Date());
  const charge = document.getElementById('mSesCharge').checked;
  const useSupplies = document.getElementById('mSesSupplies').checked;

  pat.sessions.unshift({
    id: 'ses-' + Date.now(),
    date,
    treatmentName: trat.name,
    specialistName: document.getElementById('mSesSpecialist').value,
    activesApplied: document.getElementById('mSesActives').value.trim(),
    notes: document.getElementById('mSesNotes').value.trim(),
    improvementScore: document.getElementById('mSesResult').value.trim()
  });

  if (useSupplies && Array.isArray(trat.suppliesUsed)) {
    trat.suppliesUsed.forEach(u => {
      const inv = state.inventory.find(i => i.id === u.inventoryId);
      if (inv) inv.stock = Math.max(0, inv.stock - u.qty);
    });
  }

  if (charge) {
    state.finances.unshift({
      id: 'fin-' + Date.now(),
      date,
      concept: `Sesión en cabina: ${trat.name} — ${pat.name}`,
      category: 'Servicio en Cabina',
      type: 'Ingreso',
      method: 'Efectivo',
      amount: trat.price
    });
  }

  saveState();
  closeModal();
  showToast(`Sesión registrada en el expediente de ${pat.name}.`);
  renderWorkspace();
}

function openInventoryModal() {
  openModalWithHTML(
    'Agregar Nuevo Producto o Insumo al Inventario',
    `
      <div class="form-group">
        <label>Nombre del Producto / Insumo</label>
        <input type="text" id="mInvName" class="form-control" placeholder="Ej. Ampolla Ácido Tranexámico Despigmentante">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Categoría</label>
          <select id="mInvCat" class="form-control">
            <option value="Insumo de Cabina">Insumo de Cabina</option>
            <option value="Venta Retail (Skincare)">Venta Retail (Skincare)</option>
          </select>
        </div>
        <div class="form-group">
          <label>Código SKU</label>
          <input type="text" id="mInvSku" class="form-control" value="CAB-${Math.floor(100 + Math.random()*900)}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Cantidad Inicial en Stock</label>
          <input type="number" id="mInvStock" class="form-control" value="10">
        </div>
        <div class="form-group">
          <label>Alerta de Stock Mínimo</label>
          <input type="number" id="mInvMin" class="form-control" value="4">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Costo Unitario (RD$)</label>
          <input type="number" id="mInvCost" class="form-control" value="850">
        </div>
        <div class="form-group">
          <label>Precio de Venta Retail (0 si es solo cabina)</label>
          <input type="number" id="mInvPrice" class="form-control" value="0">
        </div>
      </div>
    `,
    `
      <button class="btn-soft" onclick="closeModal()">Cancelar</button>
      <button class="btn-gold" onclick="saveNewInventoryItem()">Guardar Producto</button>
    `
  );
}

function saveNewInventoryItem() {
  const name = document.getElementById('mInvName').value.trim();
  if (!name) {
    showToast('Ingresa el nombre del producto.');
    return;
  }
  state.inventory.unshift({
    id: 'inv-' + Date.now(),
    name,
    category: document.getElementById('mInvCat').value,
    sku: document.getElementById('mInvSku').value.trim(),
    stock: Number(document.getElementById('mInvStock').value || 0),
    minStock: Number(document.getElementById('mInvMin').value || 3),
    unit: 'Unidades',
    unitCost: Number(document.getElementById('mInvCost').value || 0),
    salePrice: Number(document.getElementById('mInvPrice').value || 0)
  });
  saveState();
  closeModal();
  showToast(`Producto "${name}" agregado al inventario.`);
  renderWorkspace();
}

function openNewTreatmentModal() {
  openTreatmentModal(null);
}

// Crear o editar un protocolo/tratamiento del catálogo
function openTreatmentModal(treatmentId) {
  const t = treatmentId ? state.treatments.find(x => x.id === treatmentId) : null;
  if (treatmentId && !t) return;
  const symbol = currentCurrency().symbol;
  const supplies = new Map((t?.suppliesUsed || []).map(u => [u.inventoryId, u.qty]));
  const depositType = uiState.settings?.depositType || 'treatment';
  const depositHint = uiState.settings?.requireDeposit === false
    ? 'Ahora mismo no se cobra depósito (Configuración → Cobro de la reservación).'
    : depositType !== 'treatment'
      ? `Ahora mismo el depósito se calcula como ${depositType === 'fixed' ? 'monto fijo' : 'porcentaje del precio'} en Configuración; este valor se usará si eliges "el de cada tratamiento".`
      : 'Se cobra al reservar en línea.';

  openModalWithHTML(
    t ? `Editar — ${t.name}` : 'Nuevo protocolo / tratamiento',
    `
      <div class="form-group">
        <label for="mTratName">Nombre del tratamiento</label>
        <input type="text" id="mTratName" class="form-control" maxlength="120" value="${escapeHTML(t?.name || '')}" placeholder="Ej. Radiofrecuencia Fraccionada + Velo de Colágeno">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label for="mTratCat">Categoría</label>
          <input type="text" id="mTratCat" class="form-control" maxlength="60" value="${escapeHTML(t?.category || 'Protocolo Facial')}">
        </div>
        <div class="form-group">
          <label for="mTratDur">Duración (minutos)</label>
          <input type="number" id="mTratDur" class="form-control" min="10" max="480" step="5" value="${escapeHTML(t?.durationMin || 60)}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label for="mTratPrice">Precio de la sesión (${escapeHTML(symbol)})</label>
          <input type="number" id="mTratPrice" class="form-control" min="0" value="${escapeHTML(t?.price ?? 3000)}">
        </div>
        <div class="form-group">
          <label for="mTratDep">Depósito para reservar (${escapeHTML(symbol)})</label>
          <input type="number" id="mTratDep" class="form-control" min="0" value="${escapeHTML(t?.depositRequired ?? 1000)}">
        </div>
      </div>
      <p class="admin-gate-hint" style="text-align:left;margin-top:-6px;">${escapeHTML(depositHint)}</p>
      <div class="form-group">
        <label for="mTratDesc">Descripción para las clientas</label>
        <textarea id="mTratDesc" class="form-control" rows="3" maxlength="500" placeholder="Activos, aparatología y beneficios del protocolo…">${escapeHTML(t?.description || '')}</textarea>
      </div>
      <div class="form-group">
        <label>Insumos que se descuentan por sesión</label>
        <div class="supply-list">
          ${state.inventory.length ? state.inventory.map(item => `
            <label class="supply-row">
              <input type="checkbox" class="mSupplyCheck" value="${escapeHTML(item.id)}" ${supplies.has(item.id) ? 'checked' : ''}
                     onchange="this.closest('.supply-row').querySelector('.mSupplyQty').disabled = !this.checked">
              <span class="supply-name">${escapeHTML(item.name)}</span>
              <input type="number" class="form-control mSupplyQty" min="0.1" step="0.1" value="${escapeHTML(supplies.get(item.id) || 1)}"
                     ${supplies.has(item.id) ? '' : 'disabled'} aria-label="Cantidad de ${escapeHTML(item.name)}">
              <span class="supply-unit">${escapeHTML(item.unit || '')}</span>
            </label>
          `).join('') : '<p class="admin-gate-hint" style="text-align:left;">No hay insumos en el inventario.</p>'}
        </div>
      </div>
      <p id="mTratMsg" class="form-message" hidden></p>
    `,
    `
      ${t ? `<button class="btn-soft danger-soft" onclick="askDelete('treatment', '${escapeHTML(t.id)}')">Eliminar</button>` : ''}
      <button class="btn-soft" onclick="closeModal()">Cancelar</button>
      <button class="btn-gold" onclick="saveTreatment(${t ? `'${escapeHTML(t.id)}'` : 'null'})">${t ? 'Guardar cambios' : 'Guardar protocolo'}</button>
    `
  );
}

function saveTreatment(treatmentId) {
  const msg = document.getElementById('mTratMsg');
  const fail = text => {
    msg.textContent = text;
    msg.hidden = false;
  };
  const name = document.getElementById('mTratName').value.trim();
  const durationMin = Number(document.getElementById('mTratDur').value);
  const price = Number(document.getElementById('mTratPrice').value);
  const depositRequired = Number(document.getElementById('mTratDep').value);
  if (name.length < 3) return fail('Escribe el nombre del tratamiento.');
  if (!(durationMin >= 10 && durationMin <= 480)) return fail('La duración debe estar entre 10 y 480 minutos.');
  if (!(price >= 0)) return fail('Escribe un precio válido.');
  if (!(depositRequired >= 0) || depositRequired > price) return fail('El depósito no puede ser mayor que el precio.');

  const suppliesUsed = [...document.querySelectorAll('.supply-row')]
    .filter(row => row.querySelector('.mSupplyCheck').checked)
    .map(row => ({
      inventoryId: row.querySelector('.mSupplyCheck').value,
      qty: Math.max(0.1, Number(row.querySelector('.mSupplyQty').value) || 1)
    }));

  const data = {
    name,
    category: document.getElementById('mTratCat').value.trim() || 'Protocolo Facial',
    durationMin: Math.round(durationMin),
    price,
    depositRequired,
    description: document.getElementById('mTratDesc').value.trim(),
    suppliesUsed
  };

  if (treatmentId) {
    const t = state.treatments.find(x => x.id === treatmentId);
    if (!t) return;
    Object.assign(t, data);
    showToast(`"${name}" actualizado.`);
  } else {
    state.treatments.push({ id: 'trat-' + Date.now(), ...data });
    showToast(`Tratamiento "${name}" agregado al catálogo.`);
  }
  saveState();
  closeModal();
  renderWorkspace();
}

function openFinanceModal() {
  openModalWithHTML(
    'Registrar Movimiento Financiero (Ingreso o Gasto)',
    `
      <div class="form-group">
        <label>Concepto o Descripción</label>
        <input type="text" id="mFinConcept" class="form-control" placeholder="Ej. Compra de sueros / Pago de servicio">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Tipo de Movimiento</label>
          <select id="mFinType" class="form-control">
            <option value="Ingreso">Ingreso (+)</option>
            <option value="Gasto">Gasto Operativo / Insumos (-)</option>
          </select>
        </div>
        <div class="form-group">
          <label>Categoría</label>
          <select id="mFinCat" class="form-control">
            <option>Servicio en Cabina</option>
            <option>Venta Retail Skincare</option>
            <option>Depósito de Reserva</option>
            <option>Compra de Insumos</option>
            <option>Gastos Operativos / Cabina</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Monto (RD$)</label>
          <input type="number" id="mFinAmount" class="form-control" value="2500">
        </div>
        <div class="form-group">
          <label>Método de Pago</label>
          <select id="mFinMethod" class="form-control">
            <option>Transferencia Bancaria</option>
            <option>Tarjeta / POS</option>
            <option>Efectivo</option>
          </select>
        </div>
      </div>
    `,
    `
      <button class="btn-soft" onclick="closeModal()">Cancelar</button>
      <button class="btn-gold" onclick="saveNewFinanceMovement()">Registrar Movimiento</button>
    `
  );
}

function saveNewFinanceMovement() {
  const concept = document.getElementById('mFinConcept').value.trim();
  if (!concept) return;
  state.finances.unshift({
    id: 'fin-' + Date.now(),
    date: uiState.selectedDate,
    concept,
    type: document.getElementById('mFinType').value,
    category: document.getElementById('mFinCat').value,
    amount: Number(document.getElementById('mFinAmount').value || 0),
    method: document.getElementById('mFinMethod').value
  });
  saveState();
  closeModal();
  showToast('Movimiento registrado en Finanzas.');
  renderWorkspace();
}

// ============================================================================
// INICIALIZACIÓN
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('globalSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', e => {
      uiState.searchQuery = e.target.value;
      renderWorkspace();
    });
  }

  // Sin sesión de administradora no se muestran datos (y se borra cualquier copia local previa)
  if (!getAdminToken()) {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
    state = JSON.parse(JSON.stringify(INITIAL_NISKIN_DATA));
    showAdminGate();
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const requestedView = params.get('vista');
  const viewAliases = { agenda: 'agenda', inventario: 'inventory', expedientes: 'patients', configuracion: 'settings', equipo: 'team' };
  if (requestedView === 'cliente' || window.location.hash === '#cliente') {
    switchView('client-portal');
  } else {
    switchView(viewAliases[requestedView] || 'dashboard');
  }
  refreshPushStatus();

  applyStaffToUI();
  refreshCurrentStaff();

  // Sincroniza automáticamente el Frontend en Hostinger con el Backend en Render + MongoDB
  syncFromCloudServer();
});

async function refreshPushStatus() {
  if (!window.NiskinPush) return;
  uiState.pushStatus = await NiskinPush.status();
  if (uiState.currentView === 'dashboard') renderWorkspace();
}

// Trae citas nuevas de clientas al volver a la pestaña y cada 2 minutos
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') syncFromCloudServer();
});
setInterval(() => {
  if (document.visibilityState === 'visible') syncFromCloudServer();
}, 2 * 60 * 1000);
