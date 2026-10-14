-- ============================================================================
-- Base de Datos MySQL para Niskin Beauty Studio (Hostinger phpMyAdmin)
-- ============================================================================

CREATE TABLE IF NOT EXISTS `niskin_app_state` (
  `id` INT NOT NULL PRIMARY KEY,
  `state_json` LONGTEXT NOT NULL,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tablas relacionales opcionales para reportes avanzados en MySQL:
CREATE TABLE IF NOT EXISTS `patients` (
  `id` VARCHAR(64) PRIMARY KEY,
  `name` VARCHAR(160) NOT NULL,
  `phone` VARCHAR(40),
  `email` VARCHAR(160),
  `age` INT,
  `skin_biotype` VARCHAR(100),
  `fitzpatrick` VARCHAR(50),
  `main_concern` TEXT,
  `allergies` TEXT,
  `home_routine_am` TEXT,
  `home_routine_pm` TEXT,
  `before_photo` LONGTEXT,
  `after_photo` LONGTEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `appointments` (
  `id` VARCHAR(64) PRIMARY KEY,
  `patient_id` VARCHAR(64) NOT NULL,
  `patient_name` VARCHAR(160) NOT NULL,
  `treatment_id` VARCHAR(64) NOT NULL,
  `treatment_name` VARCHAR(160) NOT NULL,
  `specialist_id` VARCHAR(64) NOT NULL,
  `specialist_name` VARCHAR(160) NOT NULL,
  `appointment_date` DATE NOT NULL,
  `appointment_time` VARCHAR(32) NOT NULL,
  `price` DECIMAL(10,2) DEFAULT 0,
  `deposit_paid` DECIMAL(10,2) DEFAULT 0,
  `status` VARCHAR(40) DEFAULT 'Confirmada',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `inventory` (
  `id` VARCHAR(64) PRIMARY KEY,
  `sku` VARCHAR(64),
  `name` VARCHAR(180) NOT NULL,
  `category` VARCHAR(80) NOT NULL,
  `stock` INT DEFAULT 0,
  `min_stock` INT DEFAULT 4,
  `unit` VARCHAR(40) DEFAULT 'Unidades',
  `unit_cost` DECIMAL(10,2) DEFAULT 0,
  `sale_price` DECIMAL(10,2) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `finances` (
  `id` VARCHAR(64) PRIMARY KEY,
  `movement_date` DATE NOT NULL,
  `concept` VARCHAR(255) NOT NULL,
  `category` VARCHAR(80) NOT NULL,
  `type` ENUM('Ingreso', 'Gasto') NOT NULL,
  `method` VARCHAR(80),
  `amount` DECIMAL(10,2) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
