const mongoose = require('mongoose');

// Sub-esquema para las sesiones clínicas de cada paciente
const SessionSchema = new mongoose.Schema({
  id: { type: String, required: true },
  date: { type: String, required: true },
  treatmentName: { type: String, required: true },
  specialistName: { type: String, required: true },
  activesApplied: { type: String, default: '' },
  notes: { type: String, default: '' },
  improvementScore: { type: String, default: '85%' }
}, { _id: false });

// 1. Esquema de Pacientes (Expediente Clínico + Fotos Antes y Después + Rutina AM/PM)
const PatientSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  phone: { type: String, default: '' },
  email: { type: String, default: '' },
  age: { type: Number, default: 28 },
  pastelClass: { type: String, default: 'pastel-rose' },
  initials: { type: String, default: 'NB' },
  skinBiotype: { type: String, default: 'Piel Mixta' },
  fitzpatrick: { type: String, default: 'Fototipo III' },
  mainConcern: { type: String, default: '' },
  allergies: { type: String, default: 'Ninguna conocida' },
  homeRoutineAM: { type: String, default: '' },
  homeRoutinePM: { type: String, default: '' },
  metrics: {
    hydration: {
      before: { type: Number, default: 45 },
      current: { type: Number, default: 85 }
    },
    toneUniformity: {
      before: { type: Number, default: 50 },
      current: { type: Number, default: 85 }
    },
    texturePores: {
      before: { type: Number, default: 50 },
      current: { type: Number, default: 85 }
    },
    blemishControl: {
      before: { type: Number, default: 50 },
      current: { type: Number, default: 90 }
    }
  },
  beforePhoto: { type: String, default: '' },
  afterPhoto: { type: String, default: '' },
  sessions: { type: [SessionSchema], default: [] },
  source: { type: String, default: 'Estudio' }
}, { timestamps: true });

// 2. Esquema de Citas (Agenda Administrativa y Reservas desde el Portal de Clientes)
const AppointmentSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  patientId: { type: String, required: true },
  patientName: { type: String, required: true },
  pastelClass: { type: String, default: 'pastel-rose' },
  initials: { type: String, default: 'NB' },
  treatmentId: { type: String, required: true },
  treatmentName: { type: String, required: true },
  specialistId: { type: String, required: true },
  specialistName: { type: String, required: true },
  date: { type: String, required: true },
  time: { type: String, required: true },
  price: { type: Number, required: true },
  depositPaid: { type: Number, default: 0 },
  status: { type: String, default: 'Confirmada' },
  reminderSentAt: { type: Date }
}, { timestamps: true });

// 3. Esquema de Inventario (Cabina y Venta Retail)
const InventorySchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  category: { type: String, required: true },
  sku: { type: String, default: '' },
  stock: { type: Number, default: 0 },
  minStock: { type: Number, default: 4 },
  unit: { type: String, default: 'Unidades' },
  unitCost: { type: Number, default: 0 },
  salePrice: { type: Number, default: 0 }
}, { timestamps: true });

// 4. Esquema de Finanzas (Ingresos, Depósitos y Gastos Operativos)
const FinanceSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  date: { type: String, required: true },
  concept: { type: String, required: true },
  category: { type: String, required: true },
  type: { type: String, enum: ['Ingreso', 'Gasto'], required: true },
  method: { type: String, default: 'Transferencia Bancaria' },
  amount: { type: Number, required: true }
}, { timestamps: true });

// 5. Esquema de Tratamientos / Protocolos
const TreatmentSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  category: { type: String, default: 'Protocolo Facial' },
  durationMin: { type: Number, default: 60 },
  price: { type: Number, required: true },
  depositRequired: { type: Number, default: 1000 },
  description: { type: String, default: '' },
  suppliesUsed: {
    type: [{ inventoryId: String, qty: Number }],
    default: []
  }
}, { timestamps: true });

// 6. Esquema de Especialistas
const SpecialistSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  role: { type: String, default: '' },
  specialty: { type: String, default: '' },
  avatarBg: { type: String, default: '#DECBB1' },
  initials: { type: String, default: 'VN' }
}, { timestamps: true });

// 7. Cuentas de acceso de clientas (portal web). Colección separada del expediente:
//    nunca se envía al panel admin ni a otras clientas.
const ClientAccountSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  patientId: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  passwordSalt: { type: String, required: true },
  lastLoginAt: { type: Date }
}, { timestamps: true });

// 8. Cuentas del equipo (administradoras y cosmetólogas) para entrar al panel
const StaffAccountSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  role: { type: String, enum: ['administradora', 'cosmetologa'], default: 'cosmetologa' },
  specialistId: { type: String, default: '' },
  active: { type: Boolean, default: true },
  passwordHash: { type: String, required: true },
  passwordSalt: { type: String, required: true },
  lastLoginAt: { type: Date }
}, { timestamps: true });

// 9. Configuración del negocio (un solo documento con id 'studio')
const StudioSettingsSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, default: 'studio' },
  businessName: { type: String, default: 'Niskin Beauty Studio' },
  tagline: { type: String, default: 'Cosmetología clínica y cuidado facial' },
  city: { type: String, default: 'La Romana, República Dominicana' },
  address: { type: String, default: '' },
  whatsapp: { type: String, default: '' },
  instagram: { type: String, default: '' },
  welcomeMessage: { type: String, default: '' },
  depositInstructions: { type: String, default: '' },
  cancellationPolicy: { type: String, default: '' },
  bookingEnabled: { type: Boolean, default: true },
  slots: { type: [String], default: ['09:00 AM', '10:00 AM', '11:30 AM', '02:30 PM', '04:00 PM', '05:30 PM'] },
  closedWeekdays: { type: [Number], default: [0] },
  minHoursNotice: { type: Number, default: 2 },
  maxDaysAhead: { type: Number, default: 90 },
  maxActiveBookings: { type: Number, default: 3 },
  remindersEnabled: { type: Boolean, default: true },
  reminderHoursBefore: { type: Number, default: 24 }
}, { timestamps: true });

// 10. Registros eliminados: evita que una sincronización vieja del panel los vuelva a crear
const DeletedRecordSchema = new mongoose.Schema({
  collectionName: { type: String, required: true },
  recordId: { type: String, required: true },
  deletedBy: { type: String, default: '' }
}, { timestamps: true });
DeletedRecordSchema.index({ collectionName: 1, recordId: 1 }, { unique: true });

// 11. Suscripciones a notificaciones push (equipo y clientas)
const PushSubscriptionSchema = new mongoose.Schema({
  endpoint: { type: String, required: true, unique: true },
  keys: {
    p256dh: { type: String, required: true },
    auth: { type: String, required: true }
  },
  ownerType: { type: String, enum: ['staff', 'client'], required: true },
  ownerId: { type: String, required: true }
}, { timestamps: true });
PushSubscriptionSchema.index({ ownerType: 1, ownerId: 1 });

// 12. Secretos generados por el servidor (p. ej. claves VAPID si no vienen por variables de entorno)
const AppSecretSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  value: { type: mongoose.Schema.Types.Mixed, required: true }
}, { timestamps: true });

module.exports = {
  Patient: mongoose.model('Patient', PatientSchema),
  Appointment: mongoose.model('Appointment', AppointmentSchema),
  Inventory: mongoose.model('Inventory', InventorySchema),
  Finance: mongoose.model('Finance', FinanceSchema),
  Treatment: mongoose.model('Treatment', TreatmentSchema),
  Specialist: mongoose.model('Specialist', SpecialistSchema),
  ClientAccount: mongoose.model('ClientAccount', ClientAccountSchema),
  StaffAccount: mongoose.model('StaffAccount', StaffAccountSchema),
  StudioSettings: mongoose.model('StudioSettings', StudioSettingsSchema),
  DeletedRecord: mongoose.model('DeletedRecord', DeletedRecordSchema),
  PushSubscription: mongoose.model('PushSubscription', PushSubscriptionSchema),
  AppSecret: mongoose.model('AppSecret', AppSecretSchema)
};
