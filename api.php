<?php
/**
 * API Backend para Niskin Beauty Studio en Hostinger
 * Sincroniza citas de clientes, expedientes clínicos, fotos de Antes/Después,
 * inventario y finanzas entre todos los dispositivos (celular de clientes y PC del estudio).
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/config.php';

$storageDir = __DIR__ . '/storage';
if (!is_dir($storageDir)) {
    @mkdir($storageDir, 0755, true);
}

// Proteger el directorio storage con un .htaccess interno si no existe
$storageHtaccess = $storageDir . '/.htaccess';
if (!file_exists($storageHtaccess)) {
    @file_put_contents($storageHtaccess, "Options -Indexes\n<FilesMatch \"\\.(json|sqlite)$\">\n  Require all denied\n</FilesMatch>\n");
}

$stateFile = $storageDir . '/niskin_state.json';

function getServerState($stateFile) {
    if (USE_MYSQL) {
        try {
            $pdo = new PDO(
                'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
                DB_USER,
                DB_PASS,
                [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
            );
            $stmt = $pdo->query("SELECT state_json FROM niskin_app_state WHERE id = 1 LIMIT 1");
            $row = $stmt ? $stmt->fetch(PDO::FETCH_ASSOC) : false;
            if ($row && !empty($row['state_json'])) {
                return json_decode($row['state_json'], true);
            }
        } catch (Exception $e) {
            // Si MySQL aún no está configurado, usa el almacenamiento en archivo del servidor Hostinger
        }
    }

    if (file_exists($stateFile)) {
        $raw = file_get_contents($stateFile);
        $decoded = json_decode($raw, true);
        if (is_array($decoded)) {
            return $decoded;
        }
    }
    return null;
}

function saveServerState($stateFile, $stateData) {
    $jsonString = json_encode($stateData, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

    if (USE_MYSQL) {
        try {
            $pdo = new PDO(
                'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
                DB_USER,
                DB_PASS,
                [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
            );
            $pdo->exec("CREATE TABLE IF NOT EXISTS niskin_app_state (
                id INT PRIMARY KEY,
                state_json LONGTEXT NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

            $stmt = $pdo->prepare("INSERT INTO niskin_app_state (id, state_json) VALUES (1, :json)
                                   ON DUPLICATE KEY UPDATE state_json = :json");
            $stmt->execute([':json' => $jsonString]);
        } catch (Exception $e) {
            // Continúa guardando en archivo local del servidor como respaldo
        }
    }

    return @file_put_contents($stateFile, $jsonString) !== false;
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $data = getServerState($stateFile);
    echo json_encode([
        'status' => 'ok',
        'hasServerData' => $data !== null,
        'data' => $data,
        'serverTime' => date('Y-m-d H:i:s')
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($method === 'POST') {
    $rawInput = file_get_contents('php://input');
    $payload = json_decode($rawInput, true);

    if (!is_array($payload) || !isset($payload['state'])) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'Datos inválidos']);
        exit;
    }

    $ok = saveServerState($stateFile, $payload['state']);
    echo json_encode([
        'status' => $ok ? 'ok' : 'error',
        'savedAt' => date('Y-m-d H:i:s')
    ], JSON_UNESCAPED_UNICODE);
    exit;
}
