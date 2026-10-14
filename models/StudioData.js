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
  sessions: { type: [SessionSchema], default: [] }
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
  status: { type: String, default: 'Confirmada' }
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

module.exports = {
  Patient: mongoose.model('Patient', PatientSchema),
  Appointment: mongoose.model('Appointment', AppointmentSchema),
  Inventory: mongoose.model('Inventory', InventorySchema),
  Finance: mongoose.model('Finance', FinanceSchema),
  Treatment: mongoose.model('Treatment', TreatmentSchema),
  Specialist: mongoose.model('Specialist', SpecialistSchema)
};
