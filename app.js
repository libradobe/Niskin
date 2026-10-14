const STORAGE_KEY = 'niskin_studio_state_v1';
const RENDER_URL_STORAGE_KEY = 'niskin_render_backend_url';

function getRenderBaseUrl() {
  const saved = localStorage.getItem(RENDER_URL_STORAGE_KEY);
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
  selectedDate: '2026-10-14',
  calendarMonth: 9,
  calendarYear: 2026,
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
  portalSelectedDate: '2026-10-21',
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

  // Sincronización con el Backend en Render + MongoDB Atlas
  const endpoint = getApiEndpoint('/api/state');
  if (getRenderBaseUrl() || window.location.protocol.startsWith('http')) {
    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state })
    })
      .then(res => res.json())
      .then(resp => {
        if (resp && resp.status === 'ok') {
          uiState.serverSynced = true;
          uiState.backendLabel = 'Conectado a Render + MongoDB';
        }
      })
      .catch(() => {
        // Permanece respaldado en localStorage mientras el servidor Render despierta
      });
  }
}

async function syncFromCloudServer() {
  const endpoint = getApiEndpoint('/api/state');
  if (!getRenderBaseUrl() && !window.location.protocol.startsWith('http')) return;

  try {
    const res = await fetch(endpoint, { cache: 'no-store' });
    if (res.ok) {
      const payload = await res.json();
      if (payload && payload.status === 'ok') {
        uiState.serverSynced = true;
        uiState.backendLabel = 'Conectado a Render + MongoDB';
        if (payload.hasServerData && payload.data) {
          state = payload.data;
          localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
          renderWorkspace();
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
  const currentUrl = getRenderBaseUrl();
  openModalWithHTML(
    'Conexión Hostinger (Frontend) ↔ Render + MongoDB (Backend)',
    `
      <div style="font-size:0.84rem;color:var(--text-secondary);background:#FAF6EE;padding:12px 14px;border-radius:10px;border:1px solid var(--border-card);">
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

function formatMoney(amount) {
  return `RD$ ${Number(amount || 0).toLocaleString('es-DO')}`;
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

function getInitials(name) {
  return (name || 'NB')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0].toUpperCase())
    .join('');
}

const PASTEL_CLASSES = ['pastel-rose', 'pastel-sage', 'pastel-lavender', 'pastel-amber', 'pastel-blue'];

// ============================================================================
// NAVEGACIÓN PRINCIPAL
// ============================================================================
function switchView(viewName) {
  uiState.currentView = viewName;
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === viewName);
  });

  const isClientMode = viewName === 'client-portal';
  document.getElementById('modeAdminBtn')?.classList.toggle('active', !isClientMode);
  document.getElementById('modeClientBtn')?.classList.toggle('active', isClientMode);

  const titles = {
    'dashboard': ['Panel General Niskin', 'Resumen ejecutivo de citas, ingresos, inventario y evolución de pacientes'],
    'agenda': ['Agenda y Citas', 'Control de reservas, confirmación de depósitos y atención en cabina'],
    'patients': ['Expedientes Clínicos y Fotos de Mejoría', 'Ficha cosmetológica, historial de tratamientos, rutina AM/PM y comparador Antes/Después'],
    'inventory': ['Inventario de Cabina y Skincare Retail', 'Control de existencias, alertas de stock mínimo y descuento automático por sesión'],
    'treatments': ['Catálogo de Tratamientos y Protocolos', 'Servicios de Niskin Beauty Studio e insumos vinculados por sesión'],
    'finances': ['Finanzas y Flujo de Caja', 'Registro de ingresos por tratamientos, depósitos, ventas de skincare y gastos operativos'],
    'client-portal': ['Portal del Cliente — Mi Espacio Niskin', 'Experiencia interactiva para tus clientas: agendar citas, ver su récord y fotos de mejoría']
  };

  const [title, subtitle] = titles[viewName] || titles['dashboard'];
  document.getElementById('topbarHeading').textContent = title;
  document.getElementById('topbarSubheading').textContent = subtitle;

  renderWorkspace();
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
      initBeforeAfterSliders();
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
    case 'client-portal':
      container.innerHTML = renderClientPortalView();
      initBeforeAfterSliders();
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
  const occupancyPct = Math.min(100, Math.round((todayAppointments.length / 6) * 100));

  const totalIncome = state.finances
    .filter(f => f.type === 'Ingreso')
    .reduce((acc, item) => acc + Number(item.amount), 0);
  const totalExpenses = state.finances
    .filter(f => f.type === 'Gasto')
    .reduce((acc, item) => acc + Number(item.amount), 0);
  const netBalance = totalIncome - totalExpenses;

  const lowStockItems = state.inventory.filter(i => i.stock <= i.minStock);

  const filteredAppointments = state.appointments.filter(a => {
    if (!uiState.searchQuery) return true;
    const q = uiState.searchQuery.toLowerCase();
    return (
      a.patientName.toLowerCase().includes(q) ||
      a.treatmentName.toLowerCase().includes(q) ||
      a.specialistName.toLowerCase().includes(q)
    );
  });

  return `
    <div class="action-bar">
      <div>
        <span style="font-size:0.85rem;color:var(--text-secondary);">
          Fecha seleccionada en agenda: <strong>${uiState.selectedDate}</strong> • ${todayAppointments.length} cita(s) en ese día
          ${uiState.serverSynced
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
            <h2>Próximas Citas y Sesiones en Cabina</h2>
            <p style="font-size:0.8rem;color:var(--text-secondary);">Haz clic en el expediente de cada clienta para ver sus fotos de mejoría o registrar su sesión</p>
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
          ${filteredAppointments.map(app => renderAppointmentRow(app)).join('')}
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
            <div class="mini-feed-item">
              <span class="pastel-avatar pastel-sage">📸</span>
              <div class="entity-text" style="flex:1;">
                <h4>Fotos de Mejoría Actualizadas</h4>
                <p>Valeria Méndez (92% mejoría en textura y acné)</p>
              </div>
              <button class="btn-soft btn-sm" onclick="openPatientRecord('pac-1')">Ver</button>
            </div>
            <div class="mini-feed-item">
              <span class="pastel-avatar pastel-rose">💳</span>
              <div class="entity-text" style="flex:1;">
                <h4>Depósito Pendiente de Confirmar</h4>
                <p>Mariela Gómez • HydraGlow (02:30 PM)</p>
              </div>
              <button class="btn-soft btn-sm" onclick="confirmAppointmentDeposit('cita-3')">Confirmar</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderAppointmentRow(app) {
  const isSuccess = app.status === 'Confirmada' || app.status === 'Completada';
  const badgeClass = isSuccess ? 'status-confirmed' : 'status-pending';

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
        <p>${app.date}</p>
      </div>
      <div>
        <span class="status-pill ${badgeClass}">
          <span class="dot"></span>
          ${app.status}
        </span>
        <div style="font-size:0.72rem;color:var(--text-muted);margin-top:3px;">
          Depósito: ${formatMoney(app.depositPaid)}
        </div>
      </div>
      <div class="row-actions">
        <button class="round-action-btn" title="Ver Expediente y Fotos de Mejoría" onclick="openPatientRecord('${app.patientId}')">
          📋
        </button>
        ${app.status !== 'Completada' ? `
          <button class="round-action-btn" title="Completar sesión, descontar insumos y registrar ingreso" onclick="completeAppointmentSession('${app.id}')">
            ✓
          </button>
        ` : ''}
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
    const hasEvent = appointmentDates.has(fullDate) || (contextMode === 'portal' && [15, 17, 21, 24, 28].includes(d));
    const clickHandler = contextMode === 'portal'
      ? `selectPortalDate('${fullDate}')`
      : `selectAdminDate('${fullDate}')`;

    cells += `
      <button class="cal-day ${isSelected ? 'selected' : ''} ${hasEvent ? 'has-events' : ''}" onclick="${clickHandler}">
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
}

function selectPortalDate(dateStr) {
  uiState.portalSelectedDate = dateStr;
  renderWorkspace();
}

// ============================================================================
// 2. VISTA AGENDA Y CITAS
// ============================================================================
function renderAgendaView() {
  const statuses = ['Todas', 'Confirmada', 'Pendiente Depósito', 'Completada'];
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

function confirmAppointmentDeposit(appointmentId) {
  const app = state.appointments.find(a => a.id === appointmentId);
  if (!app) return;
  const treatment = state.treatments.find(t => t.id === app.treatmentId);
  const deposit = treatment ? treatment.depositRequired : 1000;
  app.depositPaid = deposit;
  app.status = 'Confirmada';

  state.finances.unshift({
    id: 'fin-' + Date.now(),
    date: app.date,
    concept: `Depósito de Reserva (${app.treatmentName}) — ${app.patientName}`,
    category: 'Depósito de Reserva',
    type: 'Ingreso',
    method: 'Transferencia Bancaria',
    amount: deposit
  });

  saveState();
  showToast(`Depósito de ${formatMoney(deposit)} confirmado para ${app.patientName}`);
  renderWorkspace();
}

function completeAppointmentSession(appointmentId) {
  const app = state.appointments.find(a => a.id === appointmentId);
  if (!app || app.status === 'Completada') return;

  app.status = 'Completada';
  const remainingAmount = Math.max(0, Number(app.price) - Number(app.depositPaid || 0));

  if (remainingAmount > 0) {
    state.finances.unshift({
      id: 'fin-' + Date.now(),
      date: app.date,
      concept: `Liquidación Sesión ${app.treatmentName} — ${app.patientName}`,
      category: 'Servicio en Cabina',
      type: 'Ingreso',
      method: 'Tarjeta / POS',
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
      improvementScore: '94%'
    });
  }

  saveState();
  showToast(`Sesión completada: insumos descontados e ingreso registrado en Finanzas.`);
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

function renderPatientsView() {
  const p = state.patients.find(item => item.id === uiState.selectedPatientId) || state.patients[0];

  return `
    <div class="action-bar">
      <div>
        <span style="font-size:0.86rem;color:var(--text-secondary);">
          Selecciona una paciente para consultar su ficha dermatológica, subir fotos de mejoría o registrar una sesión en cabina.
        </span>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        <button class="btn-soft" onclick="previewClientPortalFor('${p.id}')">
          <span>📱</span> Ver como ${p.name} en Portal Cliente
        </button>
        <button class="btn-gold" onclick="openNewPatientModal()">
          <span>＋</span> Nueva Paciente
        </button>
      </div>
    </div>

    <div class="patients-layout">
      <div class="surface-card">
        <div class="card-header">
          <h2>Pacientes (${state.patients.length})</h2>
        </div>
        <div>
          ${state.patients.map(pat => `
            <div class="patient-Selector-item ${pat.id === p.id ? 'active' : ''}" onclick="selectPatient('${pat.id}')">
              <div class="pastel-avatar ${pat.pastelClass}">${pat.initials}</div>
              <div class="entity-text" style="flex:1;">
                <h4>${pat.name}</h4>
                <p>${pat.skinBiotype} • ${pat.sessions.length} ses.</p>
              </div>
              <span style="color:var(--gold-primary);font-weight:700;">›</span>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="surface-card">
        <div class="clinical-detail-header">
          <div style="display:flex;align-items:center;gap:16px;">
            <div class="pastel-avatar ${p.pastelClass}" style="width:56px;height:56px;font-size:1.15rem;">${p.initials}</div>
            <div>
              <h2 style="font-family:var(--font-serif);font-size:1.65rem;">${p.name} (${p.age} años)</h2>
              <p style="font-size:0.84rem;color:var(--text-secondary);">📞 ${p.phone} • ✉️ ${p.email}</p>
              <div class="skin-badges">
                <span class="skin-tag">✨ ${p.skinBiotype}</span>
                <span class="skin-tag">☀️ ${p.fitzpatrick}</span>
                <span class="skin-tag">🎯 Motivo: ${p.mainConcern}</span>
              </div>
            </div>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button class="btn-gold btn-sm" onclick="openNewSessionModal('${p.id}')">
              ＋ Registrar Sesión en Cabina
            </button>
          </div>
        </div>

        <div class="clinical-body">
          <div>
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:10px;">
              <div>
                <h3 style="font-family:var(--font-serif);font-size:1.35rem;">Registro Fotográfico de Evolución (Antes vs. Después)</h3>
                <p style="font-size:0.82rem;color:var(--text-secondary);">Desliza el control central hacia los lados para comparar la mejoría clínica o sube nuevas fotografías desde tu equipo (se sincronizan con Render + MongoDB).</p>
              </div>
              <div style="display:flex;gap:8px;">
                <label class="btn-soft btn-sm" style="cursor:pointer;">
                  📷 Subir Foto "Antes"
                  <input type="file" accept="image/*" style="display:none;" onchange="handlePhotoUpload(event, '${p.id}', 'before')">
                </label>
                <label class="btn-soft btn-sm" style="cursor:pointer;">
                  ✨ Subir Foto "Después"
                  <input type="file" accept="image/*" style="display:none;" onchange="handlePhotoUpload(event, '${p.id}', 'after')">
                </label>
              </div>
            </div>

            <div class="ba-section-grid">
              <div class="ba-slider-container" data-ba-slider>
                <div class="ba-img-layer">
                  <img src="${p.afterPhoto}" alt="Después - ${p.name}">
                </div>
                <div class="ba-before-clip" data-ba-clip style="width: 50%;">
                  <img src="${p.beforePhoto}" alt="Antes - ${p.name}" style="width: 100%; height: 100%; object-fit: cover;">
                </div>
                <span class="ba-label ba-label-before">Antes (Sesión 1)</span>
                <span class="ba-label ba-label-after">Después (Actual)</span>
                <div class="ba-handle" data-ba-handle style="left: 50%;">⟷</div>
                <input type="range" min="5" max="95" value="50" class="ba-range-input" data-ba-input aria-label="Comparador Antes y Después">
              </div>

              <div class="metrics-progress-list">
                <div style="font-size:0.85rem;font-weight:700;color:var(--text-primary);margin-bottom:2px;">
                  Evaluación Cosmetológica de Mejoría
                </div>
                ${renderSkinMetricBar('Hidratación y Función Barrera', p.metrics.hydration.before, p.metrics.hydration.current)}
                ${renderSkinMetricBar('Uniformidad de Tono / Despigmentación', p.metrics.toneUniformity.before, p.metrics.toneUniformity.current)}
                ${renderSkinMetricBar('Textura, Firmeza y Poros', p.metrics.texturePores.before, p.metrics.texturePores.current)}
                ${renderSkinMetricBar('Control de Imperfecciones y Eritema', p.metrics.blemishControl.before, p.metrics.blemishControl.current)}
                <div style="font-size:0.78rem;color:var(--text-secondary);background:#FAF6EE;padding:10px 12px;border-radius:10px;border:1px solid var(--border-card);">
                  <strong>Alergias / Precauciones:</strong> ${p.allergies}
                </div>
              </div>
            </div>
          </div>

          <div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
              <h3 style="font-family:var(--font-serif);font-size:1.3rem;">Rutina de Skincare en Casa Recetada</h3>
              <button class="btn-soft btn-sm" onclick="saveRoutineChanges('${p.id}')">💾 Guardar Cambios en Rutina</button>
            </div>
            <div class="routine-grid">
              <div class="routine-box">
                <h4>☀️ Rutina de Día (AM)</h4>
                <textarea id="routineAM_${p.id}" class="form-control" rows="4" style="width:100%;background:#FFFFFF;">${p.homeRoutineAM}</textarea>
              </div>
              <div class="routine-box">
                <h4>🌙 Rutina de Noche (PM)</h4>
                <textarea id="routinePM_${p.id}" class="form-control" rows="4" style="width:100%;background:#FFFFFF;">${p.homeRoutinePM}</textarea>
              </div>
            </div>
          </div>

          <div>
            <h3 style="font-family:var(--font-serif);font-size:1.3rem;margin-bottom:12px;">
              Historial Clínico de Sesiones (${p.sessions.length})
            </h3>
            <div class="session-timeline">
              ${p.sessions.map(ses => `
                <div class="session-card">
                  <div class="session-card-top">
                    <div>
                      <strong style="font-size:0.95rem;color:var(--text-primary);">${ses.treatmentName}</strong>
                      <span style="font-size:0.8rem;color:var(--text-secondary);margin-left:8px;">• ${ses.specialistName}</span>
                    </div>
                    <div style="display:flex;align-items:center;gap:10px;">
                      <span class="status-pill status-confirmed"><span class="dot"></span> Mejoría: ${ses.improvementScore}</span>
                      <span style="font-size:0.8rem;font-weight:600;color:var(--gold-hover);">${ses.date}</span>
                    </div>
                  </div>
                  <p style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:6px;">
                    <strong>Activos y Aparatología Aplicada:</strong> ${ses.activesApplied}
                  </p>
                  <p style="font-size:0.84rem;color:var(--text-primary);">
                    <strong>Evolución y Observaciones:</strong> ${ses.notes}
                  </p>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
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

function initBeforeAfterSliders() {
  document.querySelectorAll('[data-ba-slider]').forEach(container => {
    const input = container.querySelector('[data-ba-input]');
    const clip = container.querySelector('[data-ba-clip]');
    const handle = container.querySelector('[data-ba-handle]');
    if (!input || !clip || !handle) return;

    const updateSlider = () => {
      const val = input.value;
      clip.style.width = `${val}%`;
      handle.style.left = `${val}%`;
    };
    input.addEventListener('input', updateSlider);
  });
}

function handlePhotoUpload(event, patientId, mode) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    const patient = state.patients.find(p => p.id === patientId);
    if (!patient) return;
    if (mode === 'before') {
      patient.beforePhoto = e.target.result;
    } else {
      patient.afterPhoto = e.target.result;
    }
    saveState();
    showToast(`Fotografía "${mode === 'before' ? 'Antes' : 'Después'}" actualizada en el récord de ${patient.name}.`);
    renderWorkspace();
  };
  reader.readAsDataURL(file);
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

    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:20px;">
      ${state.treatments.map(t => `
        <div class="surface-card" style="padding:22px;display:flex;flex-direction:column;justify-content:space-between;gap:14px;">
          <div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
              <span class="skin-tag">${t.category}</span>
              <span style="font-size:0.82rem;color:var(--text-secondary);">⏱ ${t.durationMin} min</span>
            </div>
            <h3 style="font-family:var(--font-serif);font-size:1.35rem;margin-bottom:6px;">${t.name}</h3>
            <p style="font-size:0.84rem;color:var(--text-secondary);margin-bottom:12px;">${t.description}</p>
          </div>
          <div style="border-top:1px solid var(--border-light);padding-top:12px;display:flex;justify-content:space-between;align-items:center;">
            <div>
              <div style="font-size:1.1rem;font-weight:700;color:var(--text-primary);">${formatMoney(t.price)}</div>
              <div style="font-size:0.76rem;color:var(--gold-hover);">Depósito reserva: ${formatMoney(t.depositRequired)}</div>
            </div>
            <button class="btn-soft btn-sm" onclick="openAppointmentModal('${t.id}')">Agendar</button>
          </div>
        </div>
      `).join('')}
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
      <div style="display:flex;gap:8px;">
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
              Mi Récord y Fotos
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
              <div class="phone-slots-grid">
                ${['10:00 AM', '02:30 PM', '04:30 PM'].map(slot => `
                  <button class="phone-slot-pill ${uiState.portalSelectedSlot === slot ? 'selected' : ''}"
                          onclick="selectPortalSlot('${slot}')">
                    ${slot}
                  </button>
                `).join('')}
              </div>
            </div>

            <button class="phone-cta-btn" onclick="submitClientPortalBooking()">
              <span>Confirmar Cita • ${formatMoney(selectedTreatment.price)}</span>
              <span style="font-size:1.2rem;">›</span>
            </button>
          ` : `
            <div style="display:flex;flex-direction:column;gap:14px;">
              <div class="ba-slider-container" data-ba-slider style="height:220px;">
                <div class="ba-img-layer">
                  <img src="${client.afterPhoto}" alt="Después">
                </div>
                <div class="ba-before-clip" data-ba-clip style="width:50%;">
                  <img src="${client.beforePhoto}" alt="Antes" style="width:100%;height:100%;object-fit:cover;">
                </div>
                <span class="ba-label ba-label-before">Antes</span>
                <span class="ba-label ba-label-after">Ahora</span>
                <div class="ba-handle" data-ba-handle style="left:50%;">⟷</div>
                <input type="range" min="5" max="95" value="50" class="ba-range-input" data-ba-input>
              </div>
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
          <label class="btn-gold btn-sm" style="cursor:pointer;">
            📸 Subir Mi Foto de Seguimiento
            <input type="file" accept="image/*" style="display:none;" onchange="handlePhotoUpload(event, '${client.id}', 'after')">
          </label>
        </div>

        <div class="clinical-body">
          <div>
            <h3 style="font-family:var(--font-serif);font-size:1.35rem;margin-bottom:6px;">
              Mi Evolución Fotográfica (Antes y Después)
            </h3>
            <p style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:14px;">
              Desliza el círculo dorado para comparar el estado inicial de tu piel en la primera evaluación frente a tu mejoría actual.
            </p>
            <div class="ba-section-grid">
              <div class="ba-slider-container" data-ba-slider>
                <div class="ba-img-layer">
                  <img src="${client.afterPhoto}" alt="Después - ${client.name}">
                </div>
                <div class="ba-before-clip" data-ba-clip style="width: 50%;">
                  <img src="${client.beforePhoto}" alt="Antes - ${client.name}" style="width:100%;height:100%;object-fit:cover;">
                </div>
                <span class="ba-label ba-label-before">Sesión 1 (Antes)</span>
                <span class="ba-label ba-label-after">Actualidad (Después)</span>
                <div class="ba-handle" data-ba-handle style="left: 50%;">⟷</div>
                <input type="range" min="5" max="95" value="50" class="ba-range-input" data-ba-input>
              </div>

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
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px;">
              ${clientAppointments.map(app => `
                <div style="background:#FAF8F4;border:1px solid var(--border-card);border-radius:12px;padding:14px;">
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
                    <span class="status-pill status-confirmed"><span class="dot"></span> Evolución: ${s.improvementScore} • ${s.date}</span>
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

function submitClientPortalBooking() {
  const client = state.patients.find(p => p.id === uiState.portalClientId);
  const specialist = state.specialists.find(s => s.id === uiState.portalSelectedSpecialistId);
  const treatment = state.treatments.find(t => t.id === uiState.portalSelectedTreatmentId);
  if (!client || !specialist || !treatment) return;

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
    depositPaid: treatment.depositRequired,
    status: 'Confirmada'
  };

  state.appointments.unshift(newAppointment);
  state.finances.unshift({
    id: 'fin-' + Date.now(),
    date: uiState.portalSelectedDate,
    concept: `Reserva Online (${treatment.name}) — ${client.name}`,
    category: 'Depósito de Reserva',
    type: 'Ingreso',
    method: 'Pago Online Portal Cliente',
    amount: treatment.depositRequired
  });

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

function openAppointmentModal(preselectedTreatmentId) {
  const tId = preselectedTreatmentId || state.treatments[0]?.id;
  openModalWithHTML(
    'Agendar Nueva Cita en Niskin Beauty Studio',
    `
      <div class="form-group">
        <label>Paciente</label>
        <select id="mAppPatient" class="form-control">
          ${state.patients.map(p => `<option value="${p.id}">${p.name} (${p.skinBiotype})</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Tratamiento / Protocolo</label>
        <select id="mAppTreatment" class="form-control">
          ${state.treatments.map(t => `<option value="${t.id}" ${t.id === tId ? 'selected' : ''}>${t.name} — ${formatMoney(t.price)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Especialista Asignada</label>
        <select id="mAppSpecialist" class="form-control">
          ${state.specialists.map(s => `<option value="${s.id}">${s.name} (${s.role})</option>`).join('')}
        </select>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Fecha de la Cita</label>
          <input type="date" id="mAppDate" class="form-control" value="${uiState.selectedDate}">
        </div>
        <div class="form-group">
          <label>Hora</label>
          <select id="mAppTime" class="form-control">
            <option>09:00 AM</option>
            <option>10:00 AM</option>
            <option>11:30 AM</option>
            <option>02:30 PM</option>
            <option>04:00 PM</option>
            <option>05:30 PM</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>Estado del Depósito</label>
        <select id="mAppStatus" class="form-control">
          <option value="Confirmada">Confirmada (Con depósito pagado)</option>
          <option value="Pendiente Depósito">Pendiente de Depósito</option>
        </select>
      </div>
    `,
    `
      <button class="btn-soft" onclick="closeModal()">Cancelar</button>
      <button class="btn-gold" onclick="saveNewAppointment()">Guardar Cita</button>
    `
  );
}

function saveNewAppointment() {
  const patId = document.getElementById('mAppPatient').value;
  const tratId = document.getElementById('mAppTreatment').value;
  const espId = document.getElementById('mAppSpecialist').value;
  const date = document.getElementById('mAppDate').value;
  const time = document.getElementById('mAppTime').value;
  const status = document.getElementById('mAppStatus').value;

  const pat = state.patients.find(p => p.id === patId);
  const trat = state.treatments.find(t => t.id === tratId);
  const esp = state.specialists.find(s => s.id === espId);
  if (!pat || !trat || !esp) return;

  const deposit = status === 'Confirmada' ? trat.depositRequired : 0;

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
      hydration: { before: 45, current: 78 },
      toneUniformity: { before: 50, current: 82 },
      texturePores: { before: 52, current: 80 },
      blemishControl: { before: 55, current: 85 }
    },
    beforePhoto: createSkinVisualSVG({
      mode: 'before',
      clientName: name,
      sessionLabel: 'Antes ( Evaluación Inicial )',
      dateLabel: uiState.selectedDate,
      conditionType: 'hydration'
    }),
    afterPhoto: createSkinVisualSVG({
      mode: 'after',
      clientName: name,
      sessionLabel: 'Después ( Progreso Actual )',
      dateLabel: uiState.selectedDate,
      conditionType: 'hydration'
    }),
    sessions: [
      {
        id: 'ses-' + Date.now(),
        date: uiState.selectedDate,
        treatmentName: 'Evaluación Diagnóstica con Lámpara de Wood',
        specialistName: 'Lic. Valeria Niskin',
        activesApplied: 'Higiene facial preparatoria e hidratación calmante',
        notes: 'Apertura de expediente clínico y toma de fotografías iniciales.',
        improvementScore: '75%'
      }
    ]
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

  openModalWithHTML(
    `Registrar Sesión en Cabina — ${pat.name}`,
    `
      <div class="form-group">
        <label>Tratamiento Realizado (descuenta insumos automáticamente)</label>
        <select id="mSesTreatment" class="form-control">
          ${state.treatments.map(t => `<option value="${t.id}">${t.name} (${formatMoney(t.price)})</option>`).join('')}
        </select>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Especialista</label>
          <select id="mSesSpecialist" class="form-control">
            ${state.specialists.map(s => `<option value="${s.name}">${s.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Porcentaje de Mejoría Estimado</label>
          <input type="text" id="mSesScore" class="form-control" value="92%">
        </div>
      </div>
      <div class="form-group">
        <label>Activos y Aparatología Aplicada en Cabina</label>
        <input type="text" id="mSesActives" class="form-control" placeholder="Ej. Exosomas, Ácido Hialurónico, Fototerapia LED Roja 15 min">
      </div>
      <div class="form-group">
        <label>Notas de Evolución Clínica</label>
        <textarea id="mSesNotes" class="form-control" rows="3" placeholder="Describe cómo respondió la piel y las recomendaciones post-tratamiento..."></textarea>
      </div>
    `,
    `
      <button class="btn-soft" onclick="closeModal()">Cancelar</button>
      <button class="btn-gold" onclick="saveNewSession('${pat.id}')">Registrar Sesión, Insumos e Ingreso</button>
    `
  );
}

function saveNewSession(patientId) {
  const pat = state.patients.find(p => p.id === patientId);
  const tratId = document.getElementById('mSesTreatment').value;
  const trat = state.treatments.find(t => t.id === tratId);
  const specialistName = document.getElementById('mSesSpecialist').value;
  const improvementScore = document.getElementById('mSesScore').value || '90%';
  const activesApplied = document.getElementById('mSesActives').value.trim() || trat?.description || 'Protocolo en cabina';
  const notes = document.getElementById('mSesNotes').value.trim() || 'Excelente respuesta cutánea al protocolo.';

  if (!pat || !trat) return;

  pat.sessions.unshift({
    id: 'ses-' + Date.now(),
    date: uiState.selectedDate,
    treatmentName: trat.name,
    specialistName,
    activesApplied,
    notes,
    improvementScore
  });

  pat.metrics.hydration.current = Math.min(99, pat.metrics.hydration.current + 3);
  pat.metrics.toneUniformity.current = Math.min(99, pat.metrics.toneUniformity.current + 3);

  if (Array.isArray(trat.suppliesUsed)) {
    trat.suppliesUsed.forEach(u => {
      const inv = state.inventory.find(i => i.id === u.inventoryId);
      if (inv) inv.stock = Math.max(0, inv.stock - u.qty);
    });
  }

  state.finances.unshift({
    id: 'fin-' + Date.now(),
    date: uiState.selectedDate,
    concept: `Sesión en Cabina: ${trat.name} — ${pat.name}`,
    category: 'Servicio en Cabina',
    type: 'Ingreso',
    method: 'Tarjeta / POS',
    amount: trat.price
  });

  saveState();
  closeModal();
  showToast(`Sesión agregada al récord de ${pat.name}, insumos descontados e ingreso sumado.`);
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
  openModalWithHTML(
    'Agregar Nuevo Protocolo al Catálogo Niskin',
    `
      <div class="form-group">
        <label>Nombre del Tratamiento</label>
        <input type="text" id="mTratName" class="form-control" placeholder="Ej. Radiofrecuencia Fraccionada + Velo de Colágeno">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Categoría</label>
          <input type="text" id="mTratCat" class="form-control" value="Rejuvenecimiento & Lifting">
        </div>
        <div class="form-group">
          <label>Duración (Minutos)</label>
          <input type="number" id="mTratDur" class="form-control" value="60">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Precio de Sesión (RD$)</label>
          <input type="number" id="mTratPrice" class="form-control" value="3800">
        </div>
        <div class="form-group">
          <label>Depósito Requerido (RD$)</label>
          <input type="number" id="mTratDep" class="form-control" value="1000">
        </div>
      </div>
      <div class="form-group">
        <label>Descripción Clínica del Protocolo</label>
        <textarea id="mTratDesc" class="form-control" rows="3" placeholder="Detalles de los activos y aparatología incluidos..."></textarea>
      </div>
    `,
    `
      <button class="btn-soft" onclick="closeModal()">Cancelar</button>
      <button class="btn-gold" onclick="saveNewTreatment()">Guardar Protocolo</button>
    `
  );
}

function saveNewTreatment() {
  const name = document.getElementById('mTratName').value.trim();
  if (!name) return;
  state.treatments.push({
    id: 'trat-' + Date.now(),
    name,
    category: document.getElementById('mTratCat').value.trim() || 'Protocolo Facial',
    durationMin: Number(document.getElementById('mTratDur').value || 60),
    price: Number(document.getElementById('mTratPrice').value || 3000),
    depositRequired: Number(document.getElementById('mTratDep').value || 1000),
    description: document.getElementById('mTratDesc').value.trim() || 'Protocolo especializado Niskin Beauty Studio.',
    suppliesUsed: [{ inventoryId: 'inv-1', qty: 1 }]
  });
  saveState();
  closeModal();
  showToast(`Tratamiento "${name}" agregado al catálogo.`);
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

  const params = new URLSearchParams(window.location.search);
  const requestedView = params.get('vista');
  if (requestedView === 'cliente' || window.location.hash === '#cliente') {
    switchView('client-portal');
  } else {
    switchView('dashboard');
  }

  // Sincroniza automáticamente el Frontend en Hostinger con el Backend en Render + MongoDB
  syncFromCloudServer();
});
