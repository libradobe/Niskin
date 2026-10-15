# Niskin Beauty Studio — Opción B: Frontend en Hostinger + Backend en Render (MongoDB)

Arquitectura desacoplada donde la interfaz web (**Frontend**) se aloja en el `public_html` de tu dominio en **Hostinger** y se comunica vía API REST (`CORS`) con tu servidor **Node.js + Express** en **Render** conectado a **MongoDB Atlas**.

La app tiene dos partes:

| Página | Para quién | Acceso |
| --- | --- | --- |
| `index.html` (Panel del Estudio) | Equipo de Niskin | Cuenta propia (correo + contraseña) o contraseña maestra (`ADMIN_PASSWORD`) |
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
   - `ADMIN_PASSWORD`: **obligatoria**. Contraseña maestra del panel (se entra dejando el correo vacío). Úsala para crear las cuentas del equipo y guárdala como respaldo.
   - `AUTH_SECRET`: cadena aleatoria larga para firmar las sesiones (Render la genera sola si usas `render.yaml`). Sin ella, las sesiones se cierran cada vez que el servidor reinicia.
   - `ALLOWED_ORIGINS` (opcional): dominios que pueden usar la API, separados por coma. Ej. `https://dodgerblue-gaur-604591.hostingersite.com`.
   - `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` (opcionales): claves de notificaciones push. Si no las defines, el servidor las genera una vez y las guarda en MongoDB.
3. **Copia tu URL de Render** (por ejemplo `https://niskin.onrender.com`).

> El plan gratuito de Render "duerme" el servidor cuando no se usa. La primera visita puede tardar hasta un minuto; la app lo avisa en pantalla.

## 2. Subir el Frontend a Hostinger (`public_html`)

El paquete **`Niskin-Frontend-Hostinger.zip`** contiene solo los archivos estáticos: `index.html`, `clientes.html`, estilos, scripts (`app.js`, `clientes.js`, `notificaciones.js`, `theme-guard.js`, `config.js`, `data.js`), el service worker `sw.js`, los manifiestos `.webmanifest`, la carpeta `assets/` (logo e íconos) y `.htaccess`.

> `.htaccess` es un archivo oculto. En el Administrador de archivos activa "Mostrar archivos ocultos" y confirma que se reemplazó; si no, la URL corta `/clientes` y el control de caché no funcionan.

1. Entra a tu **hPanel de Hostinger → Sitios Web → Administrar → Archivos → Administrador de archivos** y abre **`public_html`**.
2. Sube **`Niskin-Frontend-Hostinger.zip`**, haz clic derecho y selecciona **Extraer (Extract)** en `.` (reemplaza los archivos existentes).
3. **Conecta el Frontend con tu URL de Render** editando `config.js`:
   ```javascript
   window.NISKIN_RENDER_URL = 'https://tu-servicio.onrender.com';
   ```
   o desde **Configurar servidor** en la pantalla de acceso del panel.
4. Si cambias archivos CSS/JS, sube el número `?v=...` en `index.html` y `clientes.html` para que los teléfonos descarguen la versión nueva.

## 3. Cuentas del equipo (administradoras y cosmetólogas)

1. Entra al panel con la contraseña maestra (correo vacío).
2. Abre **Equipo y Accesos → Nueva cuenta**. Elige el rol:
   - **Administradora**: usa todo el panel y gestiona el equipo.
   - **Cosmetóloga**: usa todo el panel, pero no ve ni gestiona el equipo.
3. Elige su **perfil en la agenda**: crear uno nuevo (aparece en las reservas online de clientas), vincular uno existente (ej. Lic. Valeria Niskin) o ninguno.
4. Al crearla, la app muestra el correo y una contraseña temporal para enviárselos. Ella puede cambiarla en **Mi cuenta** (toca su nombre en el menú).
5. **Desactivar** una cuenta le quita el acceso al instante. **Contraseña** genera una nueva temporal.

**Permisos por rol**

| Acción | Administradora | Cosmetóloga |
| --- | --- | --- |
| Usar agenda, expedientes, inventario, finanzas | ✅ | ✅ |
| Eliminar citas | ✅ | ✅ |
| Eliminar clientas y tratamientos | ✅ | — |
| Configuración del negocio, Equipo, conexión del servidor | ✅ | — |

## 4. Configuración del negocio

En **Configuración** (solo administradoras) se definen: nombre, frase, ciudad, dirección, Instagram, mensaje de bienvenida de la página de clientas, **WhatsApp del estudio**, **datos para el depósito**, política de cancelación, días y horarios que se ofrecen, anticipación mínima, hasta cuántos días se puede reservar, máximo de citas activas por clienta y recordatorios.

## 5. WhatsApp (wa.me)

- **Panel:** cada cita tiene un botón de WhatsApp que abre un mensaje listo para la clienta según su estado (pedir depósito, confirmar/recordar, cancelación o seguimiento). En el expediente hay un botón para escribirle.
- **Clientas:** después de reservar pueden **enviar el comprobante del depósito** por WhatsApp al número del estudio, y escribir si olvidaron la contraseña.
- Los números dominicanos (809/829/849) se convierten solos al formato internacional.

## 6. Notificaciones push

- **Equipo:** aviso cuando una clienta reserva, cancela o se registra, y cuando un insumo baja del stock mínimo. Las administradoras reciben todo; cada cosmetóloga recibe las citas de su perfil de agenda. Se activan en el aviso del Panel o en **Mi cuenta**.
- **Clientas:** aviso cuando su cita se confirma, cancela, cambia de horario o se completa, y un **recordatorio** antes de la cita (configurable). Se activan desde la página de clientas.
- **iPhone:** iOS solo permite notificaciones si la página se **añade a la pantalla de inicio** (Compartir → Añadir a inicio) y se abre desde ahí. La app lo explica en pantalla.
- **Render gratuito:** el servidor se duerme tras unos minutos sin uso. Los avisos de reservas y cambios llegan igual (las acciones lo despiertan), pero los **recordatorios** solo se envían mientras está despierto. Para que sean puntuales, usa un monitor gratuito (por ejemplo UptimeRobot) que visite `https://TU-SERVICIO.onrender.com/api/health` cada 10 minutos, o un plan de pago de Render.
- Al cerrar sesión, el dispositivo deja de recibir notificaciones de esa cuenta.

## 7. Modo oscuro en Samsung Internet

Chrome y Safari respetan el tema claro de la app. Samsung Internet, en cambio, oscurece cualquier página cuando su **Modo oscuro** está activo, y no permite que los sitios lo desactiven. Por eso la app muestra un aviso con dos soluciones para la usuaria:

- Menú **⋮** → apagar **Modo oscuro**, o
- **⋮ → Configuración → Labs → Usar tema oscuro del sitio web** (mantiene el modo oscuro en otras páginas y Niskin se ve con sus colores).

## 8. Enlaces para compartir

- **Clientas:** `https://TU-DOMINIO/clientes` (también `/registro` o `/citas`). Ahí se registran, agendan, ven y cancelan sus citas.
- **Equipo:** `https://TU-DOMINIO/` → pide la contraseña del panel.

Las citas reservadas por clientas llegan al panel como **Pendiente Depósito**. Confírmalas con el botón 💳 en la Agenda o en el Panel Principal cuando recibas el depósito.

Reglas de la reserva online (en `server.js`): horarios `09:00 AM, 10:00 AM, 11:30 AM, 02:30 PM, 04:00 PM, 05:30 PM`; domingos cerrado; hasta 90 días de anticipación; mínimo 2 horas antes; máximo 3 citas activas por clienta; no se puede reservar un horario ocupado de la misma especialista.
