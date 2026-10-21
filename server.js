require('dotenv').config();
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const {
  Patient,
  Appointment,
  Inventory,
  Finance,
  Treatment,
  Specialist,
  ClientAccount,
  StaffAccount,
  StudioSettings,
  DeletedRecord
} = require('./models/StudioData');

const notify = require('./notify');
const sched = require('./schedule');
const { clientMessage } = require('./client-messages');

const {
  createToken,
  verifyToken,
  hashPassword,
  verifyPassword,
  safeEqualStrings,
  requireRole,
  rateLimit
} = require('./auth');

const app = express();
const PORT = process.env.PORT || 10000;
const MONGODB_URI = process.env.MONGODB_URI || '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const STUDIO_TIMEZONE = 'America/Santo_Domingo';

// La República Dominicana usa UTC-4 todo el año (sin horario de verano)
const STUDIO_UTC_OFFSET_HOURS = -4;
const ACTIVE_STATUSES = ['Confirmada', 'Pendiente Depósito'];

// Render está detrás de un proxy: necesario para que req.ip sea la IP real (rate limit)
app.set('trust proxy', 1);

// CORS: los tokens viajan en el encabezado Authorization (sin cookies).
// Opcional: limita los dominios con ALLOWED_ORIGINS="https://tudominio.com,https://otro.com"
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(o => o.trim().replace(/\/+$/, ''))
  .filter(Boolean);
app.use(cors(allowedOrigins.length ? { origin: allowedOrigins } : {}));

// Sin fotos en la app, 2MB alcanza de sobra para sincronizar el estado del estudio
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Servir solo los archivos públicos del frontend (nunca server.js, modelos ni configuración)
const PUBLIC_FILES = [
  'index.html', 'panel.html', 'clientes.html', 'styles.css', 'clientes.css', 'landing.css', 'app.js', 'clientes.js', 'landing.js', 'data.js',
  'config.js', 'theme-guard.js', 'notificaciones.js', 'sw.js', 'manifest-panel.webmanifest', 'manifest-clientes.webmanifest'
];
PUBLIC_FILES.forEach(file => {
  app.get(`/${file}`, (req, res) => res.sendFile(path.join(__dirname, file)));
});
app.use('/assets', express.static(path.join(__dirname, 'assets')));

async function connectMongoDB() {
  if (!MONGODB_URI) {
    console.warn('⚠️ MONGODB_URI no está definida aún. Define MONGODB_URI en las variables de entorno de Render.');
    return;
  }
  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 8000
    });
    console.log('✅ Conectado exitosamente a MongoDB Atlas (Niskin Beauty Studio)');
  } catch (err) {
    console.error('❌ Error conectando a MongoDB:', err.message);
    return;
  }
  try {
    await notify.initPush();
  } catch (err) {
    console.error('❌ No se pudieron preparar las notificaciones push:', err.message);
  }
}

connectMongoDB();

if (!ADMIN_PASSWORD) {
  console.warn('⚠️ ADMIN_PASSWORD no está definida: el panel administrativo no permitirá iniciar sesión.');
}

function requireMongo(req, res, next) {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      status: 'offline',
      message: 'El servidor está iniciando o MongoDB no está conectado. Intenta de nuevo en unos segundos.'
    });
  }
  next();
}

// ============================================================================
// UTILIDADES
// ============================================================================

// Limpia texto recibido de clientas: quita etiquetas/caracteres peligrosos para HTML y recorta
function cleanText(value, maxLength = 120) {
  return String(value ?? '')
    .replace(/[<>"`\\]/g, '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function getInitials(name) {
  const words = String(name || 'NB').split(' ').filter(Boolean);
  const plain = words.filter(w => !w.endsWith('.'));
  return (plain.length ? plain : words)
    .slice(0, 2)
    .map(p => p[0].toUpperCase())
    .join('');
}

const PASTEL_CLASSES = ['pastel-rose', 'pastel-sage', 'pastel-lavender', 'pastel-amber', 'pastel-blue'];

function todayInStudio() {
  // en-CA formatea como YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone: STUDIO_TIMEZONE }).format(new Date());
}

function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function isValidDateString(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr || '')) return false;
  const d = new Date(`${dateStr}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === dateStr;
}

function weekdayOf(dateStr) {
  return new Date(`${dateStr}T12:00:00Z`).getUTCDay();
}

function slotToMinutes(slot) {
  const m = /^(\d{2}):(\d{2}) (AM|PM)$/.exec(slot || '');
  if (!m) return 0;
  let h = Number(m[1]) % 12;
  if (m[3] === 'PM') h += 12;
  return h * 60 + Number(m[2]);
}

function nowMinutesInStudio() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: STUDIO_TIMEZONE, hour: '2-digit', minute: '2-digit', hour12: false
  }).format(new Date()).split(':');
  return Number(parts[0]) * 60 + Number(parts[1]);
}

// Un horario es reservable si faltan al menos `minHoursNotice` horas
function isSlotInFuture(dateStr, slot, minHoursNotice = 2) {
  return appointmentTimestamp(dateStr, slot) - Date.now() >= minHoursNotice * 60 * 60 * 1000;
}

// Momento exacto (epoch ms) de una cita en hora de República Dominicana
function appointmentTimestamp(dateStr, slot) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const minutes = slotToMinutes(slot);
  return Date.UTC(y, m - 1, d, Math.floor(minutes / 60) - STUDIO_UTC_OFFSET_HOURS, minutes % 60);
}

function formatDateFor(lang, dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString(lang === 'en' ? 'en-US' : 'es-DO', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC'
  });
}

function whenText(lang, a) {
  return `${formatDateFor(lang, a.date)} ${clientMessage(lang, 'at')} ${a.time}`;
}

async function clientLang() {
  try {
    return (await getSettings()).language || 'es';
  } catch (e) {
    return 'es';
  }
}

function formatDateEs(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('es-DO', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC'
  });
}

// Texto de varias líneas (instrucciones de pago, políticas…): conserva saltos de línea
function cleanMultiline(value, maxLength = 600) {
  return String(value ?? '')
    .replace(/[<>"`\\]/g, '')
    .replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, maxLength);
}

// ============================================================================
// CONFIGURACIÓN DEL NEGOCIO
// ============================================================================
let settingsCache = null;

async function getSettings() {
  if (settingsCache) return settingsCache;
  let doc = await StudioSettings.findOne({ id: 'studio' }).lean();
  if (!doc) {
    doc = (await StudioSettings.create({ id: 'studio', weeklySchedule: sched.DEFAULT_WEEKLY_SCHEDULE })).toObject();
  } else if (!Array.isArray(doc.weeklySchedule) || doc.weeklySchedule.length !== 7) {
    // Migración: la configuración anterior usaba una lista de horas fijas y días cerrados
    const weeklySchedule = sched.legacyToWeekly(doc);
    doc = await StudioSettings.findOneAndUpdate(
      { id: 'studio' },
      { $set: { weeklySchedule, slotInterval: doc.slotInterval || 30 } },
      { new: true }
    ).lean();
  }
  settingsCache = doc;
  return doc;
}

function closedWeekdaysOf(st) {
  return (st.weeklySchedule || []).filter(d => !d.open).map(d => d.day);
}

function toPublicSettings(st) {
  return {
    businessName: st.businessName,
    tagline: st.tagline,
    city: st.city,
    address: st.address,
    whatsapp: st.whatsapp,
    instagram: st.instagram,
    welcomeMessage: st.welcomeMessage,
    depositInstructions: st.depositInstructions,
    cancellationPolicy: st.cancellationPolicy,
    requireDeposit: st.requireDeposit !== false,
    depositType: st.depositType || 'treatment',
    depositValue: st.depositValue || 0,
    currency: sched.CURRENCIES[st.currency] ? st.currency : 'DOP',
    language: sched.LANGUAGES.includes(st.language) ? st.language : 'es',
    bookingEnabled: st.bookingEnabled !== false
  };
}

function toAdminSettings(st) {
  return {
    ...toPublicSettings(st),
    weeklySchedule: st.weeklySchedule,
    slotInterval: st.slotInterval || 30,
    closedWeekdays: closedWeekdaysOf(st),
    minHoursNotice: st.minHoursNotice,
    maxDaysAhead: st.maxDaysAhead,
    maxActiveBookings: st.maxActiveBookings,
    remindersEnabled: st.remindersEnabled !== false,
    reminderHoursBefore: st.reminderHoursBefore
  };
}

function clampInt(value, min, max, fallback) {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

function normalizeSlot(slot) {
  const m = /^\s*(\d{1,2}):(\d{2})\s*(AM|PM)\s*$/i.exec(String(slot || ''));
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 1 || h > 12 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')} ${m[3].toUpperCase()}`;
}

const PUBLIC_TREATMENT_FIELDS = 'id name category durationMin price depositRequired description -_id';
const PUBLIC_SPECIALIST_FIELDS = 'id name role specialty avatarBg initials -_id';

function toClientProfile(patient) {
  return {
    id: patient.id,
    name: patient.name,
    email: patient.email,
    phone: patient.phone,
    initials: patient.initials,
    pastelClass: patient.pastelClass,
    skinBiotype: patient.skinBiotype,
    fitzpatrick: patient.fitzpatrick,
    mainConcern: patient.mainConcern,
    allergies: patient.allergies,
    homeRoutineAM: patient.homeRoutineAM,
    homeRoutinePM: patient.homeRoutinePM,
    metrics: patient.metrics,
    progressLog: (patient.progressLog || []).map(e => ({
      date: e.date,
      hydration: e.hydration,
      toneUniformity: e.toneUniformity,
      texturePores: e.texturePores,
      blemishControl: e.blemishControl
    })),
    sessions: (patient.sessions || []).map(s => ({
      id: s.id,
      date: s.date,
      treatmentName: s.treatmentName,
      specialistName: s.specialistName,
      activesApplied: s.activesApplied,
      improvementScore: s.improvementScore
    }))
  };
}

function toClientAppointment(a) {
  return {
    id: a.id,
    treatmentId: a.treatmentId,
    treatmentName: a.treatmentName,
    specialistId: a.specialistId,
    specialistName: a.specialistName,
    date: a.date,
    time: a.time,
    price: a.price,
    depositPaid: a.depositPaid,
    paymentMode: a.paymentMode || 'deposito',
    finalPaid: a.finalPaid || 0,
    status: a.status
  };
}

// ============================================================================
// SALUD
// ============================================================================
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Niskin Beauty Studio API (Render + MongoDB)',
    mongoConnected: mongoose.connection.readyState === 1,
    adminConfigured: Boolean(ADMIN_PASSWORD),
    timestamp: new Date().toISOString()
  });
});

// ============================================================================
// PANEL ADMINISTRATIVO (requiere contraseña de administradora)
// ============================================================================
const STAFF_ROLES = ['administradora', 'cosmetologa'];
const MASTER_STAFF = { id: 'owner', name: 'Administración', email: '', role: 'administradora', specialistId: '' };
const SPECIALIST_COLORS = ['#DECBB1', '#E5D4CE', '#D6E1D8', '#DFD8E8', '#D7E1E8', '#F5E8D3'];

function toStaffInfo(staff) {
  return {
    id: staff.id,
    name: staff.name,
    email: staff.email,
    role: staff.role,
    specialistId: staff.specialistId || '',
    active: staff.active !== false,
    lastLoginAt: staff.lastLoginAt || null,
    isMaster: staff.id === 'owner'
  };
}

// Verifica la sesión del equipo. Las cuentas desactivadas pierden el acceso de inmediato.
async function requireAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  const data = verifyToken(header.startsWith('Bearer ') ? header.slice(7).trim() : '');
  const unauthorized = () => res.status(401).json({ status: 'unauthorized', message: 'Sesión no válida o expirada. Inicia sesión de nuevo.' });
  if (!data || data.role !== 'admin') return unauthorized();

  if (data.sub === 'owner') {
    req.staff = MASTER_STAFF;
    return next();
  }
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ status: 'offline', message: 'El servidor está iniciando. Intenta de nuevo en unos segundos.' });
  }
  try {
    const staff = await StaffAccount.findOne({ id: data.sub, active: true }).lean();
    if (!staff) return unauthorized();
    req.staff = staff;
    next();
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'No se pudo verificar la sesión.' });
  }
}

function requireStaffManager(req, res, next) {
  if (req.staff?.role !== 'administradora') {
    return res.status(403).json({ status: 'error', message: 'Solo una administradora puede hacer esto.' });
  }
  next();
}

function validateStaffPassword(password) {
  return typeof password === 'string' && password.length >= 8 && password.length <= 128;
}

// Inicio de sesión del equipo: correo + contraseña, o la contraseña maestra (ADMIN_PASSWORD) sin correo
app.post('/api/admin/login', rateLimit({ windowMs: 15 * 60 * 1000, max: 10 }), async (req, res) => {
  const body = req.body || {};
  const email = cleanText(body.email, 120).toLowerCase();
  const password = String(body.password || '');
  const invalid = () => res.status(401).json({ status: 'error', message: 'Correo o contraseña incorrectos.' });

  if (!password) return invalid();

  if (!email || email === 'admin') {
    if (!ADMIN_PASSWORD) {
      return res.status(503).json({
        status: 'error',
        message: 'Falta configurar ADMIN_PASSWORD en las variables de entorno de Render.'
      });
    }
    if (!safeEqualStrings(password, ADMIN_PASSWORD)) return invalid();
    return res.json({ status: 'ok', token: createToken('admin', 'owner'), staff: toStaffInfo(MASTER_STAFF) });
  }

  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ status: 'offline', message: 'El servidor está iniciando. Intenta de nuevo en unos segundos.' });
  }
  try {
    const staff = await StaffAccount.findOne({ email });
    if (!staff || !verifyPassword(password, staff.passwordHash, staff.passwordSalt)) return invalid();
    if (!staff.active) {
      return res.status(403).json({ status: 'error', message: 'Tu acceso está desactivado. Habla con la administradora del estudio.' });
    }
    staff.lastLoginAt = new Date();
    await staff.save();
    return res.json({ status: 'ok', token: createToken('admin', staff.id), staff: toStaffInfo(staff.toObject()) });
  } catch (error) {
    console.error('Error en login del equipo:', error);
    return res.status(500).json({ status: 'error', message: 'No se pudo iniciar sesión.' });
  }
});

app.get('/api/admin/me', requireAdmin, (req, res) => {
  res.json({ status: 'ok', staff: toStaffInfo(req.staff) });
});

app.post('/api/admin/me/password', requireAdmin, async (req, res) => {
  if (req.staff.id === 'owner') {
    return res.status(400).json({ status: 'error', message: 'La contraseña maestra se cambia en Render (ADMIN_PASSWORD).' });
  }
  const { currentPassword, newPassword } = req.body || {};
  if (!validateStaffPassword(newPassword)) {
    return res.status(400).json({ status: 'error', message: 'La nueva contraseña debe tener al menos 8 caracteres.' });
  }
  try {
    const staff = await StaffAccount.findOne({ id: req.staff.id });
    if (!verifyPassword(String(currentPassword || ''), staff.passwordHash, staff.passwordSalt)) {
      return res.status(400).json({ status: 'error', message: 'La contraseña actual no es correcta.' });
    }
    const { hash, salt } = hashPassword(newPassword);
    staff.passwordHash = hash;
    staff.passwordSalt = salt;
    await staff.save();
    return res.json({ status: 'ok' });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: 'No se pudo cambiar la contraseña.' });
  }
});

// ---------------------------------------------------------------------------
// Gestión del equipo (solo administradoras)
// ---------------------------------------------------------------------------
app.get('/api/admin/staff', requireAdmin, requireStaffManager, requireMongo, async (req, res) => {
  const staff = await StaffAccount.find({}).sort({ createdAt: 1 }).lean();
  res.json({ status: 'ok', staff: staff.map(toStaffInfo) });
});

app.post('/api/admin/staff', requireAdmin, requireStaffManager, requireMongo, async (req, res) => {
  const body = req.body || {};
  const name = cleanText(body.name, 80);
  const email = cleanText(body.email, 120).toLowerCase();
  const role = STAFF_ROLES.includes(body.role) ? body.role : 'cosmetologa';
  const password = String(body.password || '');
  // specialistMode: 'new' (crear perfil en agenda), 'existing' (vincular), 'none'
  const specialistMode = ['new', 'existing', 'none'].includes(body.specialistMode) ? body.specialistMode : 'new';

  if (name.length < 3) return res.status(400).json({ status: 'error', message: 'Escribe el nombre completo.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return res.status(400).json({ status: 'error', message: 'Escribe un correo válido.' });
  if (!validateStaffPassword(password)) return res.status(400).json({ status: 'error', message: 'La contraseña temporal debe tener al menos 8 caracteres.' });

  try {
    if (await StaffAccount.exists({ email })) {
      return res.status(409).json({ status: 'error', message: 'Ya existe una cuenta del equipo con ese correo.' });
    }

    let specialistId = '';
    if (specialistMode === 'existing') {
      specialistId = String(body.specialistId || '');
      if (!(await Specialist.exists({ id: specialistId }))) {
        return res.status(400).json({ status: 'error', message: 'Elige un perfil de especialista válido.' });
      }
      if (await StaffAccount.exists({ specialistId })) {
        return res.status(409).json({ status: 'error', message: 'Ese perfil de especialista ya tiene una cuenta asignada.' });
      }
    } else if (specialistMode === 'new') {
      const count = await Specialist.countDocuments();
      specialistId = `esp-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`;
      await Specialist.create({
        id: specialistId,
        name,
        role: cleanText(body.specialistRole, 80) || (role === 'administradora' ? 'Cosmetóloga Administradora' : 'Cosmetóloga'),
        specialty: cleanText(body.specialty, 120),
        avatarBg: SPECIALIST_COLORS[count % SPECIALIST_COLORS.length],
        initials: getInitials(name)
      });
    }

    const { hash, salt } = hashPassword(password);
    const staff = await StaffAccount.create({
      id: `staff-${crypto.randomBytes(8).toString('hex')}`,
      name,
      email,
      role,
      specialistId,
      active: true,
      passwordHash: hash,
      passwordSalt: salt
    });
    return res.status(201).json({ status: 'ok', staff: toStaffInfo(staff.toObject()) });
  } catch (error) {
    console.error('Error creando cuenta del equipo:', error);
    if (error.code === 11000) {
      return res.status(409).json({ status: 'error', message: 'Ya existe una cuenta del equipo con ese correo.' });
    }
    return res.status(500).json({ status: 'error', message: 'No se pudo crear la cuenta.' });
  }
});

app.patch('/api/admin/staff/:id', requireAdmin, requireStaffManager, requireMongo, async (req, res) => {
  const body = req.body || {};
  try {
    const staff = await StaffAccount.findOne({ id: req.params.id });
    if (!staff) return res.status(404).json({ status: 'error', message: 'No se encontró esa cuenta.' });

    const isSelf = staff.id === req.staff.id;
    if (typeof body.active === 'boolean') {
      if (isSelf && !body.active) return res.status(400).json({ status: 'error', message: 'No puedes desactivar tu propia cuenta.' });
      staff.active = body.active;
    }
    if (body.role !== undefined) {
      if (!STAFF_ROLES.includes(body.role)) return res.status(400).json({ status: 'error', message: 'Rol no válido.' });
      if (isSelf && body.role !== 'administradora') return res.status(400).json({ status: 'error', message: 'No puedes quitarte el rol de administradora.' });
      staff.role = body.role;
    }
    if (body.name !== undefined) {
      const name = cleanText(body.name, 80);
      if (name.length < 3) return res.status(400).json({ status: 'error', message: 'Escribe el nombre completo.' });
      staff.name = name;
    }
    if (body.password !== undefined) {
      if (!validateStaffPassword(body.password)) return res.status(400).json({ status: 'error', message: 'La contraseña temporal debe tener al menos 8 caracteres.' });
      const { hash, salt } = hashPassword(body.password);
      staff.passwordHash = hash;
      staff.passwordSalt = salt;
    }
    await staff.save();
    return res.json({ status: 'ok', staff: toStaffInfo(staff.toObject()) });
  } catch (error) {
    console.error('Error actualizando cuenta del equipo:', error);
    return res.status(500).json({ status: 'error', message: 'No se pudo actualizar la cuenta.' });
  }
});

// Obtener todo el estado del estudio (solo administradora)
app.get('/api/state', requireAdmin, requireMongo, async (req, res) => {
  try {
    const [patients, appointments, inventory, finances, treatments, specialists] = await Promise.all([
      // Las fotos ya no se usan: no se envían (las que existan quedan intactas en la base de datos)
      Patient.find({}).select('-beforePhoto -afterPhoto').sort({ createdAt: -1 }).lean(),
      Appointment.find({}).sort({ date: 1, time: 1 }).lean(),
      Inventory.find({}).sort({ category: 1, name: 1 }).lean(),
      Finance.find({}).sort({ date: -1, createdAt: -1 }).lean(),
      Treatment.find({}).lean(),
      Specialist.find({}).lean()
    ]);

    const hasData =
      patients.length > 0 ||
      appointments.length > 0 ||
      inventory.length > 0 ||
      treatments.length > 0;

    const st = await getSettings();
    return res.json({
      status: 'ok',
      settings: toAdminSettings(st),
      hasServerData: hasData,
      data: hasData
        ? {
            studioInfo: {
              name: 'Niskin Beauty Studio',
              city: 'La Romana, República Dominicana',
              currency: 'RD$'
            },
            patients,
            appointments,
            inventory,
            finances,
            treatments,
            specialists
          }
        : null
    });
  } catch (error) {
    console.error('Error al consultar MongoDB:', error);
    return res.status(500).json({ status: 'error', message: 'No se pudo leer la base de datos.' });
  }
});

// Sincronizar y guardar cambios del panel en MongoDB (equipo)
app.post('/api/state', requireAdmin, requireMongo, async (req, res) => {
  const { state } = req.body || {};
  if (!state) {
    return res.status(400).json({ status: 'error', message: 'Falta el objeto state en el cuerpo de la petición.' });
  }

  const collections = [
    ['patients', Patient],
    ['appointments', Appointment],
    ['inventory', Inventory],
    ['finances', Finance],
    ['treatments', Treatment],
    ['specialists', Specialist]
  ];

  try {
    // Registros eliminados: nunca se vuelven a crear desde una copia vieja del panel
    const tombstones = await DeletedRecord.find({}).select('collectionName recordId -_id').lean();
    const deleted = new Set(tombstones.map(t => `${t.collectionName}:${t.recordId}`));
    const incoming = {};
    collections.forEach(([key]) => {
      incoming[key] = Array.isArray(state[key])
        ? state[key].filter(item => item && item.id && !deleted.has(`${key}:${item.id}`))
        : [];
    });

    // Estado anterior para detectar cambios y avisar por push
    const [prevAppointments, prevInventory] = await Promise.all([
      Appointment.find({ id: { $in: incoming.appointments.map(a => a.id) } }).lean(),
      Inventory.find({ id: { $in: incoming.inventory.map(i => i.id) } }).lean()
    ]);

    const ops = collections
      .filter(([key]) => incoming[key].length > 0)
      .map(([key, Model]) =>
        Model.bulkWrite(
          incoming[key].map(item => {
            const { _id, __v, createdAt, updatedAt, beforePhoto, afterPhoto, ...fields } = item;
            return {
              updateOne: {
                filter: { id: item.id },
                update: { $set: fields },
                upsert: true
              }
            };
          })
        )
      );

    await Promise.all(ops);

    res.json({
      status: 'ok',
      savedAt: new Date().toISOString()
    });

    notifyStateChanges(prevAppointments, incoming.appointments, prevInventory, incoming.inventory, req.staff)
      .catch(err => console.warn('Error preparando notificaciones:', err.message));
  } catch (error) {
    console.error('Error guardando en MongoDB:', error);
    return res.status(500).json({ status: 'error', message: 'No se pudieron guardar los cambios.' });
  }
});

async function notifyStateChanges(prevAppointments, appointments, prevInventory, inventory, staff) {
  const st = await getSettings();
  const L = st.language || 'es';
  const prevById = new Map(prevAppointments.map(a => [a.id, a]));

  for (const a of appointments) {
    const prev = prevById.get(a.id);
    const vars = { treatment: a.treatmentName, when: whenText(L, a), specialist: a.specialistName, business: st.businessName };
    if (!prev) {
      if (a.date >= todayInStudio() && ACTIVE_STATUSES.includes(a.status)) {
        notify.notifyClient(a.patientId, {
          title: clientMessage(L, 'pushNewTitle', vars),
          body: clientMessage(L, 'pushNewBody', vars),
          tag: `cita-${a.id}`
        });
      }
      continue;
    }
    if (prev.status !== a.status) {
      const keys = {
        'Confirmada': ['pushConfirmedTitle', 'pushConfirmedBody'],
        'Cancelada': ['pushCancelledTitle', 'pushCancelledBody'],
        'Completada': ['pushCompletedTitle', 'pushCompletedBody']
      }[a.status];
      if (keys) {
        const payAtEnd = a.status === 'Confirmada' && a.paymentMode === 'al-finalizar' ? clientMessage(L, 'pushPayAtEnd') : '';
        notify.notifyClient(a.patientId, {
          title: clientMessage(L, keys[0], vars),
          body: clientMessage(L, keys[1], { ...vars, payAtEnd }),
          tag: `cita-${a.id}`
        });
      }
    } else if (prev.date !== a.date || prev.time !== a.time) {
      notify.notifyClient(a.patientId, {
        title: clientMessage(L, 'pushChangedTitle', vars),
        body: clientMessage(L, 'pushChangedBody', vars),
        tag: `cita-${a.id}`
      });
    }
  }

  const prevStock = new Map(prevInventory.map(i => [i.id, i]));
  const newlyLow = inventory.filter(i => {
    const prev = prevStock.get(i.id);
    return prev && Number(prev.stock) > Number(prev.minStock) && Number(i.stock) <= Number(i.minStock);
  });
  if (newlyLow.length) {
    notify.notifyStaff({
      title: 'Stock bajo en inventario',
      body: newlyLow.map(i => `${i.name}: quedan ${i.stock} ${i.unit || ''}`.trim()).join(' • '),
      tag: 'stock-bajo',
      url: './panel.html?vista=inventario'
    });
  }
}

// ---------------------------------------------------------------------------
// Eliminar registros (con marca para que no reaparezcan)
// ---------------------------------------------------------------------------
async function markDeleted(collectionName, ids, staff) {
  if (!ids.length) return;
  await DeletedRecord.bulkWrite(ids.map(recordId => ({
    updateOne: {
      filter: { collectionName, recordId },
      update: { $set: { collectionName, recordId, deletedBy: staff?.name || '' } },
      upsert: true
    }
  })));
}

app.delete('/api/admin/appointments/:id', requireAdmin, requireMongo, async (req, res) => {
  try {
    const appt = await Appointment.findOne({ id: req.params.id }).lean();
    if (!appt) return res.status(404).json({ status: 'error', message: 'No se encontró esa cita.' });
    await Appointment.deleteOne({ id: appt.id });
    await markDeleted('appointments', [appt.id], req.staff);
    res.json({ status: 'ok' });

    if (ACTIVE_STATUSES.includes(appt.status) && appt.date >= todayInStudio()) {
      const L = await clientLang();
      const vars = { treatment: appt.treatmentName, when: whenText(L, appt) };
      notify.notifyClient(appt.patientId, {
        title: clientMessage(L, 'pushCancelledTitle', vars),
        body: clientMessage(L, 'pushCancelledBody', vars),
        tag: `cita-${appt.id}`
      });
    }
  } catch (error) {
    console.error('Error eliminando cita:', error);
    res.status(500).json({ status: 'error', message: 'No se pudo eliminar la cita.' });
  }
});

app.delete('/api/admin/patients/:id', requireAdmin, requireStaffManager, requireMongo, async (req, res) => {
  try {
    const patient = await Patient.findOne({ id: req.params.id }).lean();
    if (!patient) return res.status(404).json({ status: 'error', message: 'No se encontró esa clienta.' });
    const appts = await Appointment.find({ patientId: patient.id }).select('id -_id').lean();
    const apptIds = appts.map(a => a.id);
    await Promise.all([
      Patient.deleteOne({ id: patient.id }),
      Appointment.deleteMany({ patientId: patient.id }),
      ClientAccount.deleteOne({ patientId: patient.id }),
      notify.removeSubscriptionsOf('client', patient.id)
    ]);
    await markDeleted('patients', [patient.id], req.staff);
    await markDeleted('appointments', apptIds, req.staff);
    res.json({ status: 'ok', deletedAppointments: apptIds });
  } catch (error) {
    console.error('Error eliminando clienta:', error);
    res.status(500).json({ status: 'error', message: 'No se pudo eliminar la clienta.' });
  }
});

// Administradoras y cosmetólogas pueden eliminar tratamientos del catálogo
app.delete('/api/admin/treatments/:id', requireAdmin, requireMongo, async (req, res) => {
  try {
    const treatment = await Treatment.findOne({ id: req.params.id }).lean();
    if (!treatment) return res.status(404).json({ status: 'error', message: 'No se encontró ese tratamiento.' });
    await Treatment.deleteOne({ id: treatment.id });
    await markDeleted('treatments', [treatment.id], req.staff);
    res.json({ status: 'ok' });
  } catch (error) {
    console.error('Error eliminando tratamiento:', error);
    res.status(500).json({ status: 'error', message: 'No se pudo eliminar el tratamiento.' });
  }
});

// ---------------------------------------------------------------------------
// Configuración del negocio
// ---------------------------------------------------------------------------
app.get('/api/public/settings', requireMongo, async (req, res) => {
  const st = await getSettings();
  res.json({ status: 'ok', settings: toPublicSettings(st) });
});

// Catálogo público para la página de inicio: negocio, horario, tratamientos y equipo.
// No incluye ningún dato de clientas ni de citas.
app.get('/api/public/catalog', requireMongo, async (req, res) => {
  try {
    const [st, treatments, specialists] = await Promise.all([
      getSettings(),
      Treatment.find({}).select(PUBLIC_TREATMENT_FIELDS).lean(),
      Specialist.find({}).select(PUBLIC_SPECIALIST_FIELDS).lean()
    ]);
    res.set('Cache-Control', 'no-cache');
    res.json({
      status: 'ok',
      settings: {
        ...toPublicSettings(st),
        weeklySchedule: st.weeklySchedule || [],
        maxDaysAhead: st.maxDaysAhead
      },
      treatments: treatments.map(t => ({ ...t, deposit: sched.depositFor(t, st) })),
      specialists
    });
  } catch (error) {
    console.error('Error cargando catálogo público:', error);
    res.status(500).json({ status: 'error', message: 'No se pudo cargar la información del estudio.' });
  }
});

app.get('/api/admin/settings', requireAdmin, requireMongo, async (req, res) => {
  const st = await getSettings();
  res.json({ status: 'ok', settings: toAdminSettings(st) });
});

// Administradoras y cosmetólogas pueden configurar el negocio
app.put('/api/admin/settings', requireAdmin, requireMongo, async (req, res) => {
  const body = req.body || {};
  const current = await getSettings();
  const update = {};

  const textFields = { businessName: 80, tagline: 120, city: 80, address: 160, instagram: 60 };
  for (const [field, max] of Object.entries(textFields)) {
    if (body[field] !== undefined) update[field] = cleanText(body[field], max);
  }
  for (const field of ['welcomeMessage', 'depositInstructions', 'cancellationPolicy']) {
    if (body[field] !== undefined) update[field] = cleanMultiline(body[field]);
  }
  if (body.whatsapp !== undefined) update.whatsapp = String(body.whatsapp || '').replace(/[^\d+]/g, '').slice(0, 16);
  if (body.bookingEnabled !== undefined) update.bookingEnabled = Boolean(body.bookingEnabled);
  if (body.requireDeposit !== undefined) update.requireDeposit = Boolean(body.requireDeposit);
  if (body.depositType !== undefined) {
    if (!['treatment', 'fixed', 'percent'].includes(body.depositType)) {
      return res.status(400).json({ status: 'error', message: 'Tipo de depósito no válido.' });
    }
    update.depositType = body.depositType;
  }
  if (body.depositValue !== undefined) {
    const type = update.depositType || current.depositType || 'treatment';
    update.depositValue = type === 'percent'
      ? clampInt(body.depositValue, 0, 100, 0)
      : clampInt(body.depositValue, 0, 10000000, 0);
  }
  if (body.currency !== undefined) {
    if (!sched.CURRENCIES[body.currency]) return res.status(400).json({ status: 'error', message: 'Moneda no válida.' });
    update.currency = body.currency;
  }
  if (body.language !== undefined) {
    if (!sched.LANGUAGES.includes(body.language)) return res.status(400).json({ status: 'error', message: 'Idioma no válido.' });
    update.language = body.language;
  }
  if (body.slotInterval !== undefined) update.slotInterval = clampInt(body.slotInterval, 10, 240, current.slotInterval || 30);
  if (body.weeklySchedule !== undefined) {
    const weekly = sched.normalizeWeekly(body.weeklySchedule);
    if (!weekly) return res.status(400).json({ status: 'error', message: 'Horario no válido.' });
    if (!weekly.some(d => d.open)) {
      return res.status(400).json({ status: 'error', message: 'El estudio debe abrir al menos un día (revisa que la hora de cierre sea mayor que la de apertura).' });
    }
    update.weeklySchedule = weekly;
    update.closedWeekdays = weekly.filter(d => !d.open).map(d => d.day);
  }
  if (body.remindersEnabled !== undefined) update.remindersEnabled = Boolean(body.remindersEnabled);
  if (body.minHoursNotice !== undefined) update.minHoursNotice = clampInt(body.minHoursNotice, 0, 72, current.minHoursNotice);
  if (body.maxDaysAhead !== undefined) update.maxDaysAhead = clampInt(body.maxDaysAhead, 1, 365, current.maxDaysAhead);
  if (body.maxActiveBookings !== undefined) update.maxActiveBookings = clampInt(body.maxActiveBookings, 1, 20, current.maxActiveBookings);
  if (body.reminderHoursBefore !== undefined) update.reminderHoursBefore = clampInt(body.reminderHoursBefore, 1, 72, current.reminderHoursBefore);
  if (Array.isArray(body.closedWeekdays)) {
    update.closedWeekdays = [...new Set(body.closedWeekdays.map(Number).filter(d => Number.isInteger(d) && d >= 0 && d <= 6))];
  }
  if (Array.isArray(body.slots)) {
    const slots = [...new Set(body.slots.map(normalizeSlot).filter(Boolean))].sort((a, b) => slotToMinutes(a) - slotToMinutes(b)).slice(0, 24);
    if (!slots.length) return res.status(400).json({ status: 'error', message: 'Agrega al menos un horario de atención.' });
    update.slots = slots;
  }
  if (update.businessName !== undefined && update.businessName.length < 2) {
    return res.status(400).json({ status: 'error', message: 'Escribe el nombre del negocio.' });
  }
  if (update.closedWeekdays && update.closedWeekdays.length >= 7) {
    return res.status(400).json({ status: 'error', message: 'El estudio debe abrir al menos un día.' });
  }

  try {
    const doc = await StudioSettings.findOneAndUpdate({ id: 'studio' }, { $set: update }, { new: true, upsert: true }).lean();
    settingsCache = doc;
    res.json({ status: 'ok', settings: toAdminSettings(doc) });
  } catch (error) {
    console.error('Error guardando configuración:', error);
    res.status(500).json({ status: 'error', message: 'No se pudo guardar la configuración.' });
  }
});

// ---------------------------------------------------------------------------
// Suscripciones push
// ---------------------------------------------------------------------------
app.get('/api/push/public-key', (req, res) => {
  const key = notify.getPublicKey();
  if (!key) return res.status(503).json({ status: 'error', message: 'Las notificaciones aún no están listas.' });
  res.json({ status: 'ok', publicKey: key });
});

app.post('/api/admin/push/subscribe', requireAdmin, requireMongo, async (req, res) => {
  const sub = (req.body || {}).subscription;
  if (!notify.isValidSubscription(sub)) return res.status(400).json({ status: 'error', message: 'Suscripción no válida.' });
  await notify.saveSubscription('staff', req.staff.id, sub);
  res.json({ status: 'ok' });
});

app.post('/api/client/push/subscribe', requireRole('client'), requireMongo, async (req, res) => {
  const sub = (req.body || {}).subscription;
  if (!notify.isValidSubscription(sub)) return res.status(400).json({ status: 'error', message: 'Suscripción no válida.' });
  await notify.saveSubscription('client', req.auth.sub, sub);
  res.json({ status: 'ok' });
});

app.post('/api/push/unsubscribe', requireMongo, async (req, res) => {
  const endpoint = String((req.body || {}).endpoint || '');
  if (endpoint) await notify.removeSubscription(endpoint);
  res.json({ status: 'ok' });
});

// ============================================================================
// PORTAL DE CLIENTAS (cada clienta solo ve y modifica sus propios datos)
// ============================================================================
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 15 });

app.post('/api/client/register', authLimiter, requireMongo, async (req, res) => {
  const body = req.body || {};
  const name = cleanText(body.name, 80);
  const email = cleanText(body.email, 120).toLowerCase();
  const phone = cleanText(body.phone, 30);
  const password = String(body.password || '');
  const mainConcern = cleanText(body.mainConcern, 160);
  const allergies = cleanText(body.allergies, 160);
  const age = Number(body.age);
  const L = await clientLang();

  if (name.length < 3) {
    return res.status(400).json({ status: 'error', message: clientMessage(L, 'nameRequired') });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return res.status(400).json({ status: 'error', message: clientMessage(L, 'emailInvalid') });
  }
  if (phone.replace(/\D/g, '').length < 10) {
    return res.status(400).json({ status: 'error', message: clientMessage(L, 'phoneInvalid') });
  }
  if (password.length < 8 || password.length > 128) {
    return res.status(400).json({ status: 'error', message: clientMessage(L, 'passwordShort') });
  }
  if (!body.acceptPrivacy) {
    return res.status(400).json({ status: 'error', message: clientMessage(L, 'privacyRequired') });
  }

  try {
    const existing = await ClientAccount.findOne({ email }).lean();
    if (existing) {
      return res.status(409).json({ status: 'error', message: clientMessage(L, 'emailExists') });
    }

    const patientCount = await Patient.countDocuments();
    const patientId = `pac-web-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;

    const patient = await Patient.create({
      id: patientId,
      name,
      phone,
      email,
      age: Number.isFinite(age) && age >= 12 && age <= 110 ? Math.round(age) : null,
      pastelClass: PASTEL_CLASSES[patientCount % PASTEL_CLASSES.length],
      initials: getInitials(name),
      skinBiotype: 'Por evaluar',
      fitzpatrick: 'Por evaluar',
      mainConcern: mainConcern || 'Por definir en la primera evaluación',
      allergies: allergies || 'Ninguna conocida',
      homeRoutineAM: '',
      homeRoutinePM: '',
      metrics: {
        hydration: { before: 0, current: 0 },
        toneUniformity: { before: 0, current: 0 },
        texturePores: { before: 0, current: 0 },
        blemishControl: { before: 0, current: 0 }
      },
      sessions: [],
      source: 'Registro Web'
    });

    const { hash, salt } = hashPassword(password);
    try {
      await ClientAccount.create({
        id: `acc-${crypto.randomBytes(8).toString('hex')}`,
        patientId: patient.id,
        email,
        passwordHash: hash,
        passwordSalt: salt,
        lastLoginAt: new Date()
      });
    } catch (err) {
      await Patient.deleteOne({ id: patient.id });
      if (err.code === 11000) {
        return res.status(409).json({ status: 'error', message: clientMessage(L, 'emailExists') });
      }
      throw err;
    }

    res.status(201).json({
      status: 'ok',
      token: createToken('client', patient.id)
    });

    notify.notifyStaff({
      title: 'Nueva clienta registrada',
      body: `${patient.name} creó su cuenta desde la página de reservas.`,
      tag: `registro-${patient.id}`,
      url: './panel.html?vista=expedientes'
    });
  } catch (error) {
    console.error('Error registrando clienta:', error);
    return res.status(500).json({ status: 'error', message: clientMessage(L, 'registerFailed') });
  }
});

app.post('/api/client/login', authLimiter, requireMongo, async (req, res) => {
  const email = cleanText((req.body || {}).email, 120).toLowerCase();
  const password = String((req.body || {}).password || '');
  const L = await clientLang();

  try {
    const account = await ClientAccount.findOne({ email });
    if (!account || !verifyPassword(password, account.passwordHash, account.passwordSalt)) {
      return res.status(401).json({ status: 'error', message: clientMessage(L, 'loginInvalid') });
    }
    account.lastLoginAt = new Date();
    await account.save();
    return res.json({ status: 'ok', token: createToken('client', account.patientId) });
  } catch (error) {
    console.error('Error en login de clienta:', error);
    return res.status(500).json({ status: 'error', message: clientMessage(L, 'loginFailed') });
  }
});

// Perfil, citas propias y catálogo público
app.get('/api/client/me', requireRole('client'), requireMongo, async (req, res) => {
  const L = await clientLang();
  try {
    const patient = await Patient.findOne({ id: req.auth.sub }).lean();
    if (!patient) {
      return res.status(401).json({ status: 'unauthorized', message: clientMessage(L, 'accountGone') });
    }
    const [appointments, treatments, specialists, st] = await Promise.all([
      Appointment.find({ patientId: patient.id }).sort({ date: -1, time: -1 }).lean(),
      Treatment.find({}).select(PUBLIC_TREATMENT_FIELDS).lean(),
      Specialist.find({}).select(PUBLIC_SPECIALIST_FIELDS).lean(),
      getSettings()
    ]);

    return res.json({
      status: 'ok',
      profile: toClientProfile(patient),
      appointments: appointments.map(toClientAppointment),
      // `deposit`: lo que se cobra al reservar según Configuración (0 = paga todo al finalizar)
      treatments: treatments.map(t => ({ ...t, deposit: sched.depositFor(t, st) })),
      specialists,
      studio: toPublicSettings(st),
      booking: {
        enabled: st.bookingEnabled !== false,
        closedWeekdays: closedWeekdaysOf(st),
        minDate: todayInStudio(),
        maxDate: addDays(todayInStudio(), st.maxDaysAhead)
      }
    });
  } catch (error) {
    console.error('Error cargando perfil de clienta:', error);
    return res.status(500).json({ status: 'error', message: clientMessage(L, 'loadFailed') });
  }
});

// Citas activas de una especialista en una fecha, con su duración (para detectar cruces)
async function busyAppointments(date, specialistId) {
  const appts = await Appointment.find({
    date,
    specialistId,
    status: { $in: ACTIVE_STATUSES }
  }).select('time treatmentId -_id').lean();
  const durations = new Map(
    (await Treatment.find({ id: { $in: appts.map(a => a.treatmentId) } }).select('id durationMin -_id').lean())
      .map(t => [t.id, t.durationMin])
  );
  return appts.map(a => ({ time: a.time, durationMin: durations.get(a.treatmentId) || 60 }));
}

// Horarios del día: los ocupados se devuelven marcados (sin datos de otras clientas)
app.get('/api/client/availability', requireRole('client'), requireMongo, async (req, res) => {
  const L = await clientLang();
  const { date, specialistId, treatmentId } = req.query;
  if (!isValidDateString(date) || !specialistId) {
    return res.status(400).json({ status: 'error', message: clientMessage(L, 'badDateOrSpecialist') });
  }
  try {
    const st = await getSettings();
    const day = sched.dayScheduleFor(st, date);
    if (!day || !day.open) {
      return res.json({ status: 'ok', closed: true, slots: [], available: [] });
    }
    const treatment = treatmentId ? await Treatment.findOne({ id: String(treatmentId) }).select('durationMin -_id').lean() : null;
    const durationMin = treatment?.durationMin || 60;
    const busy = await busyAppointments(date, String(specialistId));
    const slots = sched.slotStatuses({ settings: st, dateStr: date, durationMin, existing: busy })
      .map(s => (s.status === 'available' && !isSlotInFuture(date, s.time, st.minHoursNotice) ? { ...s, status: 'past' } : s))
      .filter(s => s.status !== 'past');
    return res.json({
      status: 'ok',
      closed: false,
      slots,
      available: slots.filter(s => s.status === 'available').map(s => s.time)
    });
  } catch (error) {
    console.error('Error consultando disponibilidad:', error);
    return res.status(500).json({ status: 'error', message: clientMessage(L, 'availabilityFailed') });
  }
});

app.post('/api/client/appointments', requireRole('client'), requireMongo, async (req, res) => {
  const { treatmentId, specialistId, date, time } = req.body || {};
  const bookingOrigin = cleanText((req.body || {}).origin, 40).replace(/[^\w-]/g, '');
  const L = await clientLang();

  if (!isValidDateString(date)) {
    return res.status(400).json({ status: 'error', message: clientMessage(L, 'invalidDate') });
  }

  try {
    const st = await getSettings();
    const today = todayInStudio();
    if (st.bookingEnabled === false) {
      return res.status(400).json({ status: 'error', message: clientMessage(L, 'bookingPaused') });
    }
    if (date < today || date > addDays(today, st.maxDaysAhead)) {
      return res.status(400).json({ status: 'error', message: clientMessage(L, 'bookingRange', { days: st.maxDaysAhead }) });
    }
    const day = sched.dayScheduleFor(st, date);
    if (!day || !day.open) {
      return res.status(400).json({ status: 'error', message: clientMessage(L, 'closedDay') });
    }

    const [patient, treatment, specialist] = await Promise.all([
      Patient.findOne({ id: req.auth.sub }).lean(),
      Treatment.findOne({ id: String(treatmentId) }).lean(),
      Specialist.findOne({ id: String(specialistId) }).lean()
    ]);
    if (!patient) {
      return res.status(401).json({ status: 'unauthorized', message: clientMessage(L, 'accountGone') });
    }
    if (!treatment || !specialist) {
      return res.status(400).json({ status: 'error', message: clientMessage(L, 'invalidTreatment') });
    }

    const durationMin = treatment.durationMin || 60;
    const validTimes = sched.slotsForDate(st, date, durationMin);
    if (!validTimes.includes(time) || !isSlotInFuture(date, time, st.minHoursNotice)) {
      return res.status(400).json({ status: 'error', message: clientMessage(L, 'slotUnavailable') });
    }

    const activeCount = await Appointment.countDocuments({
      patientId: patient.id,
      status: { $in: ACTIVE_STATUSES },
      date: { $gte: today }
    });
    if (activeCount >= st.maxActiveBookings) {
      return res.status(400).json({ status: 'error', message: clientMessage(L, 'tooManyActive', { count: activeCount }) });
    }

    const busy = await busyAppointments(date, specialist.id);
    const status = sched.slotStatuses({ settings: st, dateStr: date, durationMin, existing: busy }).find(s => s.time === time);
    if (!status || status.status !== 'available') {
      return res.status(409).json({ status: 'error', message: clientMessage(L, 'slotJustTaken') });
    }

    // Depósito según Configuración (por tratamiento, monto fijo o porcentaje).
    // Sin depósito, la cita queda confirmada y la clienta paga el total al finalizar.
    const depositAmount = sched.depositFor(treatment, st);
    const needsDeposit = depositAmount > 0;

    const appointment = await Appointment.create({
      id: `cita-web-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      patientId: patient.id,
      patientName: patient.name,
      pastelClass: patient.pastelClass || 'pastel-rose',
      initials: patient.initials || getInitials(patient.name),
      treatmentId: treatment.id,
      treatmentName: treatment.name,
      specialistId: specialist.id,
      specialistName: specialist.name,
      date,
      time,
      price: treatment.price,
      depositPaid: 0,
      paymentMode: needsDeposit ? 'deposito' : 'al-finalizar',
      status: needsDeposit ? 'Pendiente Depósito' : 'Confirmada',
      bookingOrigin: bookingOrigin || 'directo'
    });

    res.status(201).json({
      status: 'ok',
      appointment: toClientAppointment(appointment.toObject()),
      depositRequired: depositAmount
    });

    notify.notifyStaff({
      title: needsDeposit ? 'Nueva cita reservada 📅' : 'Nueva cita confirmada 📅',
      body: `${patient.name} • ${treatment.name} • ${formatDateEs(date)} a las ${time} con ${specialist.name}. ${needsDeposit ? 'Pendiente de depósito.' : 'Paga al finalizar.'}`,
      tag: `cita-${appointment.id}`,
      url: './panel.html?vista=agenda'
    }, { specialistId: specialist.id });
  } catch (error) {
    console.error('Error creando cita de clienta:', error);
    return res.status(500).json({ status: 'error', message: clientMessage(L, 'bookingFailed') });
  }
});

app.post('/api/client/appointments/:id/cancel', requireRole('client'), requireMongo, async (req, res) => {
  const L = await clientLang();
  try {
    const appointment = await Appointment.findOne({ id: req.params.id, patientId: req.auth.sub });
    if (!appointment) {
      return res.status(404).json({ status: 'error', message: clientMessage(L, 'apptNotFound') });
    }
    if (!ACTIVE_STATUSES.includes(appointment.status) || appointment.date < todayInStudio()) {
      return res.status(400).json({ status: 'error', message: clientMessage(L, 'cannotCancel') });
    }
    appointment.status = 'Cancelada';
    await appointment.save();
    res.json({ status: 'ok', appointment: toClientAppointment(appointment.toObject()) });

    notify.notifyStaff({
      title: 'Cita cancelada por la clienta',
      body: `${appointment.patientName} canceló ${appointment.treatmentName} del ${formatDateEs(appointment.date)} a las ${appointment.time}.`,
      tag: `cita-${appointment.id}`,
      url: './panel.html?vista=agenda'
    }, { specialistId: appointment.specialistId });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: clientMessage(L, 'cancelFailed') });
  }
});

// Rutas de API desconocidas
app.use('/api', (req, res) => {
  res.status(404).json({ status: 'error', message: 'Ruta no encontrada.' });
});

// Página de clientas y fallback del panel
app.get(['/clientes', '/registro', '/citas', '/reservar'], (req, res) => {
  res.sendFile(path.join(__dirname, 'clientes.html'));
});
app.get(['/panel', '/equipo'], (req, res) => {
  res.sendFile(path.join(__dirname, 'panel.html'));
});
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ============================================================================
// RECORDATORIOS AUTOMÁTICOS (push a la clienta antes de su cita confirmada)
// Nota: en el plan gratuito de Render el servidor "duerme"; los recordatorios se
// envían cuando está despierto (cualquier visita o un monitor externo lo despierta).
// ============================================================================
async function sendDueReminders() {
  if (mongoose.connection.readyState !== 1) return;
  try {
    const st = await getSettings();
    if (st.remindersEnabled === false) return;
    const windowMs = (st.reminderHoursBefore || 24) * 60 * 60 * 1000;
    const today = todayInStudio();
    const candidates = await Appointment.find({
      status: 'Confirmada',
      reminderSentAt: { $exists: false },
      date: { $gte: today, $lte: addDays(today, 3) }
    }).lean();
    const now = Date.now();
    for (const a of candidates) {
      const diff = appointmentTimestamp(a.date, a.time) - now;
      if (diff <= 0 || diff > windowMs) continue;
      await Appointment.updateOne({ id: a.id }, { $set: { reminderSentAt: new Date() } });
      const L = st.language || 'es';
      const vars = { treatment: a.treatmentName, when: whenText(L, a), specialist: a.specialistName, business: st.businessName };
      notify.notifyClient(a.patientId, {
        title: clientMessage(L, 'pushReminderTitle', vars),
        body: clientMessage(L, 'pushReminderBody', vars),
        tag: `recordatorio-${a.id}`
      });
    }
  } catch (err) {
    console.warn('Error enviando recordatorios:', err.message);
  }
}
setInterval(sendDueReminders, 10 * 60 * 1000);

app.listen(PORT, () => {
  console.log(`🚀 Servidor Niskin Beauty Studio ejecutándose en el puerto ${PORT}`);
});
