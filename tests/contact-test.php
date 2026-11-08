<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__ . '/../api/lib/contact.php';

use function SmartFlow\Contact\process;
use function SmartFlow\Contact\services;

$token = str_repeat('b', 64);
$base = [
    'csrf' => $token, 'fullName' => 'Test Engineer', 'companyName' => 'Example Ltd',
    'email' => 'test@example.test', 'phone' => '+44 1234 000000', 'service' => 'automation',
    'message' => "Please discuss this project.\nSecond line.", 'newsletter' => true, 'website' => '',
];
$checks = 0;
function check(bool $condition, string $message): void
{
    global $checks;
    if (!$condition) throw new RuntimeException($message);
    ++$checks;
}
$captured = null;
$accept = static function (array $mail) use (&$captured): bool { $captured = $mail; return true; };
foreach (services() as $value => $label) {
    $result = process(array_replace($base, ['service' => $value]), $token, 0, $accept, 1000);
    check($result['status'] === 200 && $result['body']['success'] === true, 'Valid service rejected');
    check(strpos(quoted_printable_decode($captured['body']), 'Service: ' . $label) !== false, 'Service missing in email');
}
check($captured['to'] === 'sales@smartfloweng.com', 'Wrong recipient');
check($captured['headers']['Reply-To'] === 'test@example.test', 'Wrong reply address');
check($captured['headers']['From'] === 'Smart Flow Engineering <sales@smartfloweng.com>', 'Sender must use the business domain');
$body = quoted_printable_decode($captured['body']);
check(strpos($body, 'Industry updates requested: Yes') !== false, 'Updates preference missing');
check(strpos($body, 'Smart Flow Engineering website - Contact Us') !== false, 'Source missing');
check(strpos($body, 'Second line.') !== false, 'Multiline message missing');
check(preg_match('/^SFE-CONTACT-[A-F0-9]{12}$/', $result['body']['reference']) === 1, 'Missing reference');

$invalid = [
    ['csrf' => 'wrong'], ['csrf' => []], ['website' => 'bot.example'],
    ['fullName' => ''], ['fullName' => '   '], ['fullName' => []],
    ['fullName' => "Name\r\nBcc: other@example.test"],
    ['email' => 'invalid'], ['email' => []], ['email' => "a@example.test\r\nBcc: other@example.test"],
    ['message' => ''], ['message' => []], ['message' => str_repeat('x', 5001)],
    ['service' => 'unlisted'], ['service' => []], ['companyName' => str_repeat('x', 161)],
    ['phone' => "123\n456"], ['newsletter' => 'true'], ['newsletter' => []],
];
foreach ($invalid as $change) {
    $calls = 0;
    $result = process(array_replace($base, $change), $token, 0,
        static function (array $mail) use (&$calls): bool { ++$calls; return true; }, 1000);
    check($result['status'] >= 400 && $result['body']['success'] === false && $calls === 0, 'Invalid input reached mail transport: ' . json_encode($change));
}
$result = process($base, $token, 990, $accept, 1000);
check($result['status'] === 429, 'Rate limit missing');
$result = process($base, $token, 940, $accept, 1000);
check($result['status'] === 200, 'Rate limit boundary rejected');
$result = process($base, $token, 0, static function (): bool { return false; });
check($result['status'] === 503 && !$result['body']['success'], 'Mail failure must not report success');
$result = process($base, $token, 0, static function (): bool { throw new RuntimeException('failed'); });
check($result['status'] === 503 && !$result['body']['success'], 'Mail exception must not report success');
$result = process(array_replace($base, ['fullName' => 'José Engineer', 'newsletter' => false, 'to' => 'other@example.test']), $token, 0, $accept);
$body = quoted_printable_decode($captured['body']);
check($result['status'] === 200 && $captured['to'] === 'sales@smartfloweng.com', 'User must not change destination');
check(strpos($body, 'José Engineer') !== false && strpos($body, 'Industry updates requested: No') !== false, 'Unicode or unchecked updates preference lost');
echo "PASS: {$checks} Contact Us PHP checks; all mail transports mocked, no real emails sent.\n";
