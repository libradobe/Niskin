# Niskin Beauty Studio — Opción B: Frontend en Hostinger + Backend en Render (MongoDB)

Arquitectura desacoplada donde la interfaz web (**Frontend**) se aloja en el `public_html` de tu dominio en **Hostinger** y se comunica vía API REST (`CORS`) con tu servidor **Node.js + Express** en **Render** conectado a **MongoDB Atlas**.

## 1. Desplegar el Backend en Render + MongoDB Atlas (Desde GitHub)

El repositorio Git local ya contiene el servidor (`server.js`), los modelos de MongoDB (`models/StudioData.js`), `package.json` y `render.yaml`:

1. **Sube los cambios a tu repositorio (`https://github.com/libradobe/Niskin.git`):**
   Ejecuta en tu Terminal:
   ```bash
   cd /Users/libradobe/Documents/Niskin && git push -u origin main
   ```
2. **Conecta el repositorio en Render (`https://dashboard.render.com`):**
   - Haz clic en **New + → Web Service** y selecciona tu repositorio `libradobe/Niskin`.
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - En **Environment Variables**, agrega `MONGODB_URI` con tu cadena de conexión de **MongoDB Atlas** (`mongodb+srv://...`).
3. **Copia tu URL de Render:**
   - Una vez desplegado, Render te dará una URL pública como `https://niskin.onrender.com`.

## 2. Subir el Frontend a Hostinger (`public_html`)

He generado el paquete exclusivo de Frontend llamado **`Niskin-Frontend-Hostinger.zip`** que contiene únicamente los archivos estáticos que van en Hostinger (`index.html`, `styles.css`, `config.js`, `data.js`, `app.js`, `assets/logo.svg` y `.htaccess`):

1. Entra a tu **hPanel de Hostinger → Sitios Web → Administrar → Archivos → Administrador de archivos** y abre la carpeta **`public_html`**.
2. Sube el archivo **`Niskin-Frontend-Hostinger.zip`**, haz clic derecho sobre él y selecciona **Extraer (Extract)** en `.`.
3. **Conecta tu Frontend de Hostinger con tu URL de Render:**
   - Puedes editar la línea 9 de **`config.js`** en el Administrador de archivos de Hostinger:
     ```javascript
     window.NISKIN_RENDER_URL = 'https://tu-servicio.onrender.com';
     ```
   - O bien, abre tu página web en el navegador, haz clic en el botón **`☁️ Render API`** de la barra superior, pega tu URL de Render y presiona **🔍 Probar Conexión** y **Guardar y Sincronizar**.
