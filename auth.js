const crypto = require('crypto');

// Secreto para firmar los tokens. En Render se genera automáticamente (render.yaml → AUTH_SECRET).
// Si falta, se usa uno aleatorio: funciona, pero las sesiones se cierran en cada reinicio.
const AUTH_SECRET = process.env.AUTH_SECRET || crypto.randomBytes(32).toString('hex');
if (!process.env.AUTH_SECRET) {
  console.warn('⚠️ AUTH_SECRET no está definida: las sesiones se invalidarán al reiniciar el servidor.');
}

const ADMIN_TOKEN_TTL_MS = 12 * 60 * 60 * 1000;      // 12 horas
const CLIENT_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 días

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

function sign(data) {
  return crypto.createHmac('sha256', AUTH_SECRET).update(data).digest('base64url');
}

function createToken(role, subject) {
  const ttl = role === 'admin' ? ADMIN_TOKEN_TTL_MS : CLIENT_TOKEN_TTL_MS;
  const payload = base64url(JSON.stringify({ role, sub: subject, exp: Date.now() + ttl }));
  return `${payload}.${sign(payload)}`;
}

function verifyToken(token) {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [payload, signature] = token.split('.');
  const expected = sign(payload);
  const a = Buffer.from(signature || '');
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data.exp || data.exp < Date.now()) return null;
    return data;
  } catch (e) {
    return null;
  }
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}

function verifyPassword(password, hash, salt) {
  const candidate = Buffer.from(hashPassword(password, salt).hash, 'hex');
  const stored = Buffer.from(hash, 'hex');
  return candidate.length === stored.length && crypto.timingSafeEqual(candidate, stored);
}

function safeEqualStrings(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function readBearer(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
}

function requireRole(role) {
  return (req, res, next) => {
    const data = verifyToken(readBearer(req));
    if (!data || data.role !== role) {
      return res.status(401).json({ status: 'unauthorized', message: 'Sesión no válida o expirada. Inicia sesión de nuevo.' });
    }
    req.auth = data;
    next();
  };
}

// Limitador simple en memoria para frenar intentos de fuerza bruta en login/registro
function rateLimit({ windowMs, max }) {
  const hits = new Map();
  return (req, res, next) => {
    const key = `${req.ip}:${req.path}`;
    const now = Date.now();
    const entry = hits.get(key);
    if (!entry || entry.resetAt < now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      if (hits.size > 5000) {
        for (const [k, v] of hits) if (v.resetAt < now) hits.delete(k);
      }
      return next();
    }
    entry.count += 1;
    if (entry.count > max) {
      return res.status(429).json({ status: 'error', message: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.' });
    }
    next();
  };
}

module.exports = {
  createToken,
  verifyToken,
  hashPassword,
  verifyPassword,
  safeEqualStrings,
  requireRole,
  rateLimit
};
