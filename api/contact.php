<?php
declare(strict_types=1);

require_once __DIR__ . '/lib/contact.php';

header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function contactResponse(int $status, array $body): void
{
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'] ?? '';
if ($method !== 'GET' && $method !== 'POST') {
    header('Allow: GET, POST');
    contactResponse(405, ['success' => false, 'message' => 'This request method is not supported.']);
}
session_set_cookie_params([
    'lifetime' => 0, 'path' => '/', 'httponly' => true, 'samesite' => 'Lax',
    'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
]);
if (!@session_start()) {
    contactResponse(503, ['success' => false, 'message' => 'The contact service is temporarily unavailable. Please call +44 1234 440 530.']);
}
if (empty($_SESSION['contact_token'])) $_SESSION['contact_token'] = bin2hex(random_bytes(32));
if ($method === 'GET') contactResponse(200, ['token' => $_SESSION['contact_token']]);

if ((int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > 40000) {
    contactResponse(413, ['success' => false, 'message' => 'Please shorten your message and try again.']);
}
$contentType = strtolower(trim(explode(';', $_SERVER['CONTENT_TYPE'] ?? '')[0]));
if ($contentType !== 'application/json') {
    contactResponse(415, ['success' => false, 'message' => 'Please submit your enquiry using the contact form.']);
}
$raw = file_get_contents('php://input', false, null, 0, 40001);
if ($raw === false || strlen($raw) > 40000) {
    contactResponse(413, ['success' => false, 'message' => 'Please shorten your message and try again.']);
}
$input = json_decode($raw, true);
if (!is_array($input) || json_last_error() !== JSON_ERROR_NONE) {
    contactResponse(400, ['success' => false, 'message' => 'The form request could not be read. Please try again.']);
}
$result = \SmartFlow\Contact\process(
    $input,
    (string) $_SESSION['contact_token'],
    (int) ($_SESSION['contact_last_sent'] ?? 0),
    static function (array $mail): bool {
        return @mail($mail['to'], $mail['subject'], $mail['body'], $mail['headers']);
    }
);
if ($result['body']['success'] === true) {
    $_SESSION['contact_last_sent'] = time();
    $_SESSION['contact_token'] = bin2hex(random_bytes(32));
}
if ($result['status'] === 429) header('Retry-After: 60');
contactResponse($result['status'], $result['body']);
