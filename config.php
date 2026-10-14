<?php
/**
 * Configuración de Niskin Beauty Studio para Hostinger (hPanel)
 *
 * MODO 1 (Por defecto - Cero Configuración):
 * Guarda todos los datos y fotografías directamente en el servidor de Hostinger
 * dentro de la carpeta protegida /storage sin necesidad de configurar MySQL.
 *
 * MODO 2 (Opcional - Base de Datos MySQL de Hostinger):
 * Si creaste una base de datos MySQL en hPanel -> Bases de datos -> Gestión,
 * cambia 'USE_MYSQL' a true y coloca los datos de tu base de datos de Hostinger.
 */

define('USE_MYSQL', false);

// Credenciales MySQL de Hostinger (hPanel -> Bases de datos)
define('DB_HOST', 'localhost');
define('DB_NAME', 'u123456789_niskin');
define('DB_USER', 'u123456789_admin');
define('DB_PASS', 'TuContrasenaSeguraAqui');

// PIN de acceso rápido para el Panel Administrativo (opcional)
define('ADMIN_PIN', '2026');

// Zona horaria de República Dominicana
date_default_timezone_set('America/Santo_Domingo');
