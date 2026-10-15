# Niskin Beauty Studio — Opción B: Frontend en Hostinger + Backend en Render (MongoDB)

Arquitectura desacoplada donde la interfaz web (**Frontend**) se aloja en el `public_html` de tu dominio en **Hostinger** y se comunica vía API REST (`CORS`) con tu servidor **Node.js + Express** en **Render** conectado a **MongoDB Atlas**.

La app tiene dos partes:

| Página | Para quién | Acceso |
| --- | --- | --- |
| `index.html` (Panel del Estudio) | Equipo de Niskin | Contraseña de administradora (`ADMIN_PASSWORD`) |
| `clientes.html` (Agenda tu cita) | Clientas | Cada clienta crea su cuenta con correo y contraseña |

**Privacidad:** la API ya no entrega datos sin sesión. El panel necesita la contraseña de administradora, y cada clienta solo recibe su propio perfil, sus citas y el catálogo de tratamientos. Las contraseñas de las clientas se guardan cifradas (scrypt) en una colección separada que nunca se envía al panel.

## 1. Desplegar el Backend en Render + MongoDB Atlas (Desde GitHub)

El repositorio contiene el servidor (`server.js`, `auth.js`), los modelos de MongoDB (`models/StudioData.js`), `package.json` y `render.yaml`:

1. **Sube los cambios a tu repositorio (`https://github.com/libradobe/Niskin.git`):**
   ```bash
   cd /Users/libradobe/Documents/Niskin && git push -u origin main
   ```
2. **Variables de entorno en Render** (Dashboard → tu servicio → **Environment**):
   - `MONGODB_URI`: tu cadena de conexión de **MongoDB Atlas** (`mongodb+srv://...`).
   - `ADMIN_PASSWORD`: **obligatoria**. Es la contraseña del panel del estudio. Usa una larga y única.
   - `AUTH_SECRET`: cadena aleatoria larga para firmar las sesiones (Render la genera sola si usas `render.yaml`). Sin ella, las sesiones se cierran cada vez que el servidor reinicia.
   - `ALLOWED_ORIGINS` (opcional): dominios que pueden usar la API, separados por coma. Ej. `https://dodgerblue-gaur-604591.hostingersite.com`.
3. **Copia tu URL de Render** (por ejemplo `https://niskin.onrender.com`).

> El plan gratuito de Render "duerme" el servidor cuando no se usa. La primera visita puede tardar hasta un minuto; la app lo avisa en pantalla.

## 2. Subir el Frontend a Hostinger (`public_html`)

El paquete **`Niskin-Frontend-Hostinger.zip`** contiene solo los archivos estáticos: `index.html`, `clientes.html`, `styles.css`, `clientes.css`, `config.js`, `data.js`, `app.js`, `clientes.js`, `assets/logo.svg` y `.htaccess`.

1. Entra a tu **hPanel de Hostinger → Sitios Web → Administrar → Archivos → Administrador de archivos** y abre **`public_html`**.
2. Sube **`Niskin-Frontend-Hostinger.zip`**, haz clic derecho y selecciona **Extraer (Extract)** en `.` (reemplaza los archivos existentes).
3. **Conecta el Frontend con tu URL de Render** editando `config.js`:
   ```javascript
   window.NISKIN_RENDER_URL = 'https://tu-servicio.onrender.com';
   ```
   o desde **Configurar servidor** en la pantalla de acceso del panel.
4. Si cambias archivos CSS/JS, sube el número `?v=...` en `index.html` y `clientes.html` para que los teléfonos descarguen la versión nueva.

## 3. Enlaces para compartir

- **Clientas:** `https://TU-DOMINIO/clientes` (también `/registro` o `/citas`). Ahí se registran, agendan, ven y cancelan sus citas.
- **Equipo:** `https://TU-DOMINIO/` → pide la contraseña del panel.

Las citas reservadas por clientas llegan al panel como **Pendiente Depósito**. Confírmalas con el botón 💳 en la Agenda o en el Panel Principal cuando recibas el depósito.

Reglas de la reserva online (en `server.js`): horarios `09:00 AM, 10:00 AM, 11:30 AM, 02:30 PM, 04:00 PM, 05:30 PM`; domingos cerrado; hasta 90 días de anticipación; mínimo 2 horas antes; máximo 3 citas activas por clienta; no se puede reservar un horario ocupado de la misma especialista.
