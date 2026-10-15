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
  ClientAccount
} = require('./models/StudioData');

const {
  createToken,
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

// Horarios que se ofrecen a las clientas en la reserva online
const STUDIO_SLOTS = ['09:00 AM', '10:00 AM', '11:30 AM', '02:30 PM', '04:00 PM', '05:30 PM'];
const CLOSED_WEEKDAYS = [0]; // Domingo
const MAX_BOOKING_DAYS_AHEAD = 90;
const MAX_ACTIVE_CLIENT_BOOKINGS = 3;
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

// Límite ampliado a 25MB para permitir subida de fotografías clínicas Antes/Después en alta resolución
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Servir solo los archivos públicos del frontend (nunca server.js, modelos ni configuración)
const PUBLIC_FILES = ['index.html', 'clientes.html', 'styles.css', 'clientes.css', 'app.js', 'clientes.js', 'data.js', 'config.js'];
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
  return (name || 'NB')
    .split(' ')
    .filter(Boolean)
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

// Un horario es reservable si la fecha es futura, o si es hoy y faltan al menos 2 horas
function isSlotInFuture(dateStr, slot) {
  const today = todayInStudio();
  if (dateStr > today) return true;
  if (dateStr < today) return false;
  return slotToMinutes(slot) - nowMinutesInStudio() >= 120;
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
    beforePhoto: patient.beforePhoto,
    afterPhoto: patient.afterPhoto,
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
app.post('/api/admin/login', rateLimit({ windowMs: 15 * 60 * 1000, max: 10 }), (req, res) => {
  if (!ADMIN_PASSWORD) {
    return res.status(503).json({
      status: 'error',
      message: 'Falta configurar ADMIN_PASSWORD en las variables de entorno de Render.'
    });
  }
  const { password } = req.body || {};
  if (!password || !safeEqualStrings(password, ADMIN_PASSWORD)) {
    return res.status(401).json({ status: 'error', message: 'Contraseña incorrecta.' });
  }
  return res.json({ status: 'ok', token: createToken('admin', 'admin') });
});

// Obtener todo el estado del estudio (solo administradora)
app.get('/api/state', requireRole('admin'), requireMongo, async (req, res) => {
  try {
    const [patients, appointments, inventory, finances, treatments, specialists] = await Promise.all([
      Patient.find({}).sort({ createdAt: -1 }).lean(),
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

    return res.json({
      status: 'ok',
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

// Sincronizar y guardar cambios del panel en MongoDB (solo administradora)
app.post('/api/state', requireRole('admin'), requireMongo, async (req, res) => {
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
    const ops = collections
      .filter(([key]) => Array.isArray(state[key]) && state[key].length > 0)
      .map(([key, Model]) =>
        Model.bulkWrite(
          state[key]
            .filter(item => item && item.id)
            .map(item => {
              const { _id, __v, createdAt, updatedAt, ...fields } = item;
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

    return res.json({
      status: 'ok',
      savedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error guardando en MongoDB:', error);
    return res.status(500).json({ status: 'error', message: 'No se pudieron guardar los cambios.' });
  }
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

  if (name.length < 3) {
    return res.status(400).json({ status: 'error', message: 'Escribe tu nombre completo.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return res.status(400).json({ status: 'error', message: 'Escribe un correo electrónico válido.' });
  }
  if (phone.replace(/\D/g, '').length < 10) {
    return res.status(400).json({ status: 'error', message: 'Escribe un teléfono válido de al menos 10 dígitos.' });
  }
  if (password.length < 8 || password.length > 128) {
    return res.status(400).json({ status: 'error', message: 'La contraseña debe tener al menos 8 caracteres.' });
  }
  if (!body.acceptPrivacy) {
    return res.status(400).json({ status: 'error', message: 'Debes aceptar el aviso de privacidad para continuar.' });
  }

  try {
    const existing = await ClientAccount.findOne({ email }).lean();
    if (existing) {
      return res.status(409).json({ status: 'error', message: 'Ya existe una cuenta con este correo. Inicia sesión.' });
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
      beforePhoto: '',
      afterPhoto: '',
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
        return res.status(409).json({ status: 'error', message: 'Ya existe una cuenta con este correo. Inicia sesión.' });
      }
      throw err;
    }

    return res.status(201).json({
      status: 'ok',
      token: createToken('client', patient.id)
    });
  } catch (error) {
    console.error('Error registrando clienta:', error);
    return res.status(500).json({ status: 'error', message: 'No pudimos crear tu cuenta. Inténtalo de nuevo.' });
  }
});

app.post('/api/client/login', authLimiter, requireMongo, async (req, res) => {
  const email = cleanText((req.body || {}).email, 120).toLowerCase();
  const password = String((req.body || {}).password || '');

  try {
    const account = await ClientAccount.findOne({ email });
    if (!account || !verifyPassword(password, account.passwordHash, account.passwordSalt)) {
      return res.status(401).json({ status: 'error', message: 'Correo o contraseña incorrectos.' });
    }
    account.lastLoginAt = new Date();
    await account.save();
    return res.json({ status: 'ok', token: createToken('client', account.patientId) });
  } catch (error) {
    console.error('Error en login de clienta:', error);
    return res.status(500).json({ status: 'error', message: 'No pudimos iniciar sesión. Inténtalo de nuevo.' });
  }
});

// Perfil, citas propias y catálogo público
app.get('/api/client/me', requireRole('client'), requireMongo, async (req, res) => {
  try {
    const patient = await Patient.findOne({ id: req.auth.sub }).lean();
    if (!patient) {
      return res.status(401).json({ status: 'unauthorized', message: 'Tu cuenta ya no está disponible.' });
    }
    const [appointments, treatments, specialists] = await Promise.all([
      Appointment.find({ patientId: patient.id }).sort({ date: -1, time: -1 }).lean(),
      Treatment.find({}).select(PUBLIC_TREATMENT_FIELDS).lean(),
      Specialist.find({}).select(PUBLIC_SPECIALIST_FIELDS).lean()
    ]);

    return res.json({
      status: 'ok',
      profile: toClientProfile(patient),
      appointments: appointments.map(toClientAppointment),
      treatments,
      specialists,
      booking: {
        slots: STUDIO_SLOTS,
        closedWeekdays: CLOSED_WEEKDAYS,
        minDate: todayInStudio(),
        maxDate: addDays(todayInStudio(), MAX_BOOKING_DAYS_AHEAD)
      }
    });
  } catch (error) {
    console.error('Error cargando perfil de clienta:', error);
    return res.status(500).json({ status: 'error', message: 'No pudimos cargar tu información.' });
  }
});

// Horarios disponibles (solo devuelve horas, nunca datos de otras clientas)
app.get('/api/client/availability', requireRole('client'), requireMongo, async (req, res) => {
  const { date, specialistId } = req.query;
  if (!isValidDateString(date) || !specialistId) {
    return res.status(400).json({ status: 'error', message: 'Fecha o especialista no válidos.' });
  }
  if (CLOSED_WEEKDAYS.includes(weekdayOf(date))) {
    return res.json({ status: 'ok', closed: true, available: [] });
  }
  try {
    const taken = await Appointment.find({
      date,
      specialistId: String(specialistId),
      status: { $in: ACTIVE_STATUSES }
    }).select('time -_id').lean();
    const takenTimes = new Set(taken.map(a => a.time));
    const available = STUDIO_SLOTS.filter(slot => !takenTimes.has(slot) && isSlotInFuture(date, slot));
    return res.json({ status: 'ok', closed: false, available });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: 'No pudimos consultar la disponibilidad.' });
  }
});

app.post('/api/client/appointments', requireRole('client'), requireMongo, async (req, res) => {
  const { treatmentId, specialistId, date, time } = req.body || {};

  if (!isValidDateString(date)) {
    return res.status(400).json({ status: 'error', message: 'Selecciona una fecha válida.' });
  }
  const today = todayInStudio();
  if (date < today || date > addDays(today, MAX_BOOKING_DAYS_AHEAD)) {
    return res.status(400).json({ status: 'error', message: `Puedes reservar desde hoy y hasta ${MAX_BOOKING_DAYS_AHEAD} días después.` });
  }
  if (CLOSED_WEEKDAYS.includes(weekdayOf(date))) {
    return res.status(400).json({ status: 'error', message: 'El estudio no abre ese día. Elige otra fecha.' });
  }
  if (!STUDIO_SLOTS.includes(time) || !isSlotInFuture(date, time)) {
    return res.status(400).json({ status: 'error', message: 'Ese horario ya no está disponible.' });
  }

  try {
    const [patient, treatment, specialist] = await Promise.all([
      Patient.findOne({ id: req.auth.sub }).lean(),
      Treatment.findOne({ id: String(treatmentId) }).lean(),
      Specialist.findOne({ id: String(specialistId) }).lean()
    ]);
    if (!patient) {
      return res.status(401).json({ status: 'unauthorized', message: 'Tu cuenta ya no está disponible.' });
    }
    if (!treatment || !specialist) {
      return res.status(400).json({ status: 'error', message: 'Selecciona un tratamiento y una especialista válidos.' });
    }

    const activeCount = await Appointment.countDocuments({
      patientId: patient.id,
      status: { $in: ACTIVE_STATUSES },
      date: { $gte: today }
    });
    if (activeCount >= MAX_ACTIVE_CLIENT_BOOKINGS) {
      return res.status(400).json({
        status: 'error',
        message: `Ya tienes ${activeCount} citas activas. Escríbenos si necesitas agendar más.`
      });
    }

    const clash = await Appointment.exists({
      date,
      time,
      specialistId: specialist.id,
      status: { $in: ACTIVE_STATUSES }
    });
    if (clash) {
      return res.status(409).json({ status: 'error', message: 'Alguien acaba de reservar ese horario. Elige otro.' });
    }

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
      status: 'Pendiente Depósito'
    });

    return res.status(201).json({
      status: 'ok',
      appointment: toClientAppointment(appointment.toObject()),
      depositRequired: treatment.depositRequired
    });
  } catch (error) {
    console.error('Error creando cita de clienta:', error);
    return res.status(500).json({ status: 'error', message: 'No pudimos agendar tu cita. Inténtalo de nuevo.' });
  }
});

app.post('/api/client/appointments/:id/cancel', requireRole('client'), requireMongo, async (req, res) => {
  try {
    const appointment = await Appointment.findOne({ id: req.params.id, patientId: req.auth.sub });
    if (!appointment) {
      return res.status(404).json({ status: 'error', message: 'No encontramos esa cita.' });
    }
    if (!ACTIVE_STATUSES.includes(appointment.status) || appointment.date < todayInStudio()) {
      return res.status(400).json({ status: 'error', message: 'Esta cita ya no se puede cancelar en línea.' });
    }
    appointment.status = 'Cancelada';
    await appointment.save();
    return res.json({ status: 'ok', appointment: toClientAppointment(appointment.toObject()) });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: 'No pudimos cancelar la cita.' });
  }
});

// Rutas de API desconocidas
app.use('/api', (req, res) => {
  res.status(404).json({ status: 'error', message: 'Ruta no encontrada.' });
});

// Página de clientas y fallback del panel
app.get(['/clientes', '/registro'], (req, res) => {
  res.sendFile(path.join(__dirname, 'clientes.html'));
});
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor Niskin Beauty Studio ejecutándose en el puerto ${PORT}`);
});
