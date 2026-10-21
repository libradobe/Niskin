// ============================================================================
// NOTIFICACIONES PUSH (Web Push / VAPID)
// Las claves VAPID se leen de VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY. Si no existen,
// se generan una sola vez y se guardan en MongoDB para que las suscripciones
// sigan funcionando después de cada reinicio de Render.
// ============================================================================
const webpush = require('web-push');
const { PushSubscription, AppSecret, StaffAccount } = require('./models/StudioData');

let publicKey = null;

async function initPush() {
  let pub = process.env.VAPID_PUBLIC_KEY;
  let priv = process.env.VAPID_PRIVATE_KEY;

  if (!pub || !priv) {
    const stored = await AppSecret.findOne({ id: 'vapid' }).lean();
    if (stored) {
      pub = stored.value.publicKey;
      priv = stored.value.privateKey;
    } else {
      const keys = webpush.generateVAPIDKeys();
      await AppSecret.create({ id: 'vapid', value: keys });
      pub = keys.publicKey;
      priv = keys.privateKey;
      console.log('🔑 Claves VAPID generadas y guardadas en MongoDB.');
    }
  }

  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:notificaciones@niskinbeauty.studio', pub, priv);
  publicKey = pub;
  console.log('🔔 Notificaciones push listas.');
}

function getPublicKey() {
  return publicKey;
}

function isValidSubscription(sub) {
  return Boolean(
    sub &&
    typeof sub.endpoint === 'string' &&
    /^https:\/\//.test(sub.endpoint) &&
    sub.endpoint.length < 1000 &&
    sub.keys &&
    typeof sub.keys.p256dh === 'string' &&
    typeof sub.keys.auth === 'string'
  );
}

async function saveSubscription(ownerType, ownerId, sub) {
  await PushSubscription.findOneAndUpdate(
    { endpoint: sub.endpoint },
    { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth }, ownerType, ownerId },
    { upsert: true }
  );
}

async function removeSubscription(endpoint) {
  await PushSubscription.deleteOne({ endpoint });
}

async function removeSubscriptionsOf(ownerType, ownerId) {
  await PushSubscription.deleteMany({ ownerType, ownerId });
}

async function sendToOwners(ownerType, ownerIds, payload) {
  if (!publicKey || !ownerIds.length) return;
  const subs = await PushSubscription.find({ ownerType, ownerId: { $in: ownerIds } }).lean();
  const body = JSON.stringify(payload);
  await Promise.all(subs.map(async sub => {
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, body, { TTL: 24 * 60 * 60 });
    } catch (err) {
      // 404/410: la suscripción ya no existe (la usuaria desinstaló o revocó el permiso)
      if (err.statusCode === 404 || err.statusCode === 410) {
        await PushSubscription.deleteOne({ endpoint: sub.endpoint });
      } else {
        console.warn('No se pudo enviar push:', err.statusCode || err.message);
      }
    }
  }));
}

// Equipo: administradoras + la cosmetóloga asignada a la cita (si aplica)
async function notifyStaff(payload, { specialistId } = {}) {
  try {
    const filter = specialistId
      ? { active: true, $or: [{ role: 'administradora' }, { specialistId }] }
      : { active: true, role: 'administradora' };
    const staff = await StaffAccount.find(filter).select('id').lean();
    await sendToOwners('staff', ['owner', ...staff.map(s => s.id)], { url: './panel.html', ...payload });
  } catch (err) {
    console.warn('Error notificando al equipo:', err.message);
  }
}

async function notifyClient(patientId, payload) {
  try {
    await sendToOwners('client', [patientId], { url: './clientes.html', ...payload });
  } catch (err) {
    console.warn('Error notificando a la clienta:', err.message);
  }
}

module.exports = {
  initPush,
  getPublicKey,
  isValidSubscription,
  saveSubscription,
  removeSubscription,
  removeSubscriptionsOf,
  notifyStaff,
  notifyClient
};
