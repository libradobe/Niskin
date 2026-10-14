require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const {
  Patient,
  Appointment,
  Inventory,
  Finance,
  Treatment,
  Specialist
} = require('./models/StudioData');

const app = express();
const PORT = process.env.PORT || 10000;
const MONGODB_URI = process.env.MONGODB_URI || '';

// Habilitar CORS (permite conectar el frontend en Hostinger o el dominio propio con Render)
app.use(cors());

// Límite ampliado a 25MB para permitir subida de fotografías clínicas Antes/Después en alta resolución
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Servir archivos estáticos del frontend
app.use(express.static(path.join(__dirname)));

let isMongoConnected = false;

async function connectMongoDB() {
  if (!MONGODB_URI) {
    console.warn('⚠️ MONGODB_URI no está definida aún. Define MONGODB_URI en las variables de entorno de Render.');
    return;
  }
  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 8000
    });
    isMongoConnected = true;
    console.log('✅ Conectado exitosamente a MongoDB Atlas (Niskin Beauty Studio)');
  } catch (err) {
    isMongoConnected = false;
    console.error('❌ Error conectando a MongoDB:', err.message);
  }
}

connectMongoDB();

// Endpoint de salud para Render Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Niskin Beauty Studio API (Render + MongoDB)',
    mongoConnected: mongoose.connection.readyState === 1,
    timestamp: new Date().toISOString()
  });
});

// Obtener todo el estado sincronizado desde las colecciones de MongoDB
app.get('/api/state', async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      status: 'offline',
      message: 'MongoDB aún no está conectado. Verifica MONGODB_URI en Render.'
    });
  }

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
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

// Sincronizar y guardar cambios en las colecciones de MongoDB
app.post('/api/state', async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      status: 'offline',
      message: 'MongoDB no conectado.'
    });
  }

  const { state } = req.body;
  if (!state) {
    return res.status(400).json({ status: 'error', message: 'Falta el objeto state en el cuerpo de la petición.' });
  }

  try {
    const ops = [];

    if (Array.isArray(state.patients)) {
      ops.push(
        Patient.bulkWrite(
          state.patients.map(item => ({
            updateOne: {
              filter: { id: item.id },
              update: { $set: item },
              upsert: true
            }
          }))
        )
      );
    }

    if (Array.isArray(state.appointments)) {
      ops.push(
        Appointment.bulkWrite(
          state.appointments.map(item => ({
            updateOne: {
              filter: { id: item.id },
              update: { $set: item },
              upsert: true
            }
          }))
        )
      );
    }

    if (Array.isArray(state.inventory)) {
      ops.push(
        Inventory.bulkWrite(
          state.inventory.map(item => ({
            updateOne: {
              filter: { id: item.id },
              update: { $set: item },
              upsert: true
            }
          }))
        )
      );
    }

    if (Array.isArray(state.finances)) {
      ops.push(
        Finance.bulkWrite(
          state.finances.map(item => ({
            updateOne: {
              filter: { id: item.id },
              update: { $set: item },
              upsert: true
            }
          }))
        )
      );
    }

    if (Array.isArray(state.treatments)) {
      ops.push(
        Treatment.bulkWrite(
          state.treatments.map(item => ({
            updateOne: {
              filter: { id: item.id },
              update: { $set: item },
              upsert: true
            }
          }))
        )
      );
    }

    if (Array.isArray(state.specialists)) {
      ops.push(
        Specialist.bulkWrite(
          state.specialists.map(item => ({
            updateOne: {
              filter: { id: item.id },
              update: { $set: item },
              upsert: true
            }
          }))
        )
      );
    }

    await Promise.all(ops);

    return res.json({
      status: 'ok',
      savedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error guardando en MongoDB:', error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

// Cualquier otra ruta devuelve index.html (SPA fallback)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor Niskin Beauty Studio ejecutándose en el puerto ${PORT}`);
});
