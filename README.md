# Niskin Beauty Studio — Arquitectura Full-Stack (Render + MongoDB + Hostinger)

Aplicación web integral de gestión cosmetológica y portal de clientes para **Niskin Beauty Studio**, configurada con servidor **Node.js + Express** para **Render** y base de datos **MongoDB Atlas (Mongoose)**.

## Estructura del Proyecto

- `server.js`: Servidor Express para **Render** que expone la API REST (`/api/state`, `/api/health`) con soporte de hasta 25 MB por petición para subir fotografías clínicas de "Antes y Después", además de servir la aplicación web.
- `models/StudioData.js`: Esquemas y modelos de **Mongoose (MongoDB)** para las 6 colecciones del estudio: `patients` (incluyendo sesiones, métricas y fotos Antes/Después), `appointments`, `inventory`, `finances`, `treatments` y `specialists`.
- `package.json`: Configuración de dependencias (`express`, `mongoose`, `cors`, `dotenv`) y script `npm start` listo para Render.
- `render.yaml`: Archivo Blueprint de Render para desplegar el servicio web automáticamente.
- `.env.example`: Plantilla para configurar la variable `MONGODB_URI` con tu cluster de MongoDB Atlas.
- `index.html`, `styles.css`, `app.js`, `data.js`, `assets/logo.svg`: Interfaz administrativa y portal móvil de clientes sincronizados con `/api/state`.

## Paso 1: Crear la Base de Datos en MongoDB Atlas

1. Entra a **MongoDB Atlas** (`https://cloud.mongodb.com`) y crea un cluster gratuito (**M0**).
2. En **Database Access**, crea un usuario con contraseña.
3. En **Network Access**, agrega la IP `0.0.0.0/0` (necesario para permitir la conexión desde los servidores dinámicos de Render).
4. Haz clic en **Connect → Drivers** y copia tu cadena de conexión (`mongodb+srv://usuario:password@cluster0.xxxx.mongodb.net/niskin_beauty_studio?retryWrites=true&w=majority`).

## Paso 2: Desplegar el Servidor en Render

1. Sube esta carpeta `Niskin` a un repositorio en tu cuenta de **GitHub**.
2. Entra a **Render** (`https://dashboard.render.com`), haz clic en **New + → Web Service** y conecta tu repositorio de GitHub.
3. Verifica la configuración:
   - **Runtime:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
4. En la sección **Environment Variables** de Render, agrega:
   - `MONGODB_URI` = *(pega tu cadena de conexión de MongoDB Atlas)*
5. Al iniciar por primera vez, la aplicación poblará automáticamente tus colecciones en MongoDB con el catálogo inicial de tratamientos, especialistas e inventario de **Niskin Beauty Studio**.

## Paso 3: Conectar tu Dominio de Hostinger

Tienes dos formas de usar tu dominio o alojamiento de **Hostinger** con **Render**:

- **Opción A (Dominio personalizado directo en Render):** En tu panel de Render ve a **Settings → Custom Domains**, agrega tu dominio de Hostinger (ej. `app.niskinbeautystudio.com`) y apunta el registro `CNAME` en la zona DNS de tu **hPanel de Hostinger** hacia tu URL `.onrender.com`.
- **Opción B (Frontend en Hostinger + Backend en Render):** Si subes los archivos estáticos (`index.html`, `styles.css`, `app.js`, `data.js`, `assets/`) al `public_html` de Hostinger, solo coloca la URL de tu servidor de Render en la constante `RENDER_BACKEND_URL` en la línea 9 de `app.js` (ej. `'https://niskin-beauty-studio.onrender.com'`).
