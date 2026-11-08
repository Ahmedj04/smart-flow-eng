<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__ . '/../api/lib/kosmek-quote.php';

use function SmartFlow\Quote\process;

$catalog = json_decode(file_get_contents(__DIR__ . '/../assets/data/kosmek-quote-options.json'), true);
$token = str_repeat('a', 64);
$base = [
    'csrf' => $token, 'range' => 'factory-automation', 'component' => 'robotic-hand-changers',
    'model' => 'SWR0070', 'quantity' => '2', 'fullName' => 'Test Engineer',
    'email' => 'test@example.test', 'company' => 'Example Ltd', 'phone' => '+44 1234 000000',
    'message' => 'Please quote for a robot cell.', 'source' => 'homepage-partnership', 'website' => '',
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
foreach ($catalog as $rangeId => $entry) {
    foreach ($entry['components'] as $componentId => $label) {
        $input = array_replace($base, ['range' => $rangeId, 'component' => $componentId]);
        $result = process($input, $catalog, $token, 0, $accept, 1000);
        check($result['status'] === 200 && $result['body']['success'] === true, 'Valid range/component failed: ' . $componentId);
        check(strpos(quoted_printable_decode($captured['body']), 'Component: ' . $label) !== false, 'Wrong component in mail');
    }
}
check($captured['to'] === 'sales@smartfloweng.com', 'Destination must be fixed');
check($captured['headers']['Reply-To'] === 'test@example.test', 'Reply-To must be the validated customer email');
check(strpos(quoted_printable_decode($captured['body']), 'Homepage KOSMEK partnership section') !== false, 'Missing source attribution');
check(preg_match('/^SFE-[A-F0-9]{12}$/', $result['body']['reference']) === 1, 'Missing reference');

$badInputs = [
    ['csrf' => 'wrong'], ['csrf' => []], ['website' => 'bot.example'],
    ['range' => 'unknown'], ['range' => []], ['component' => 'magnetic-clamps'],
    ['component' => []], ['fullName' => ''], ['fullName' => "Name\r\nBcc: other@example.test"],
    ['email' => 'invalid'], ['email' => "test@example.test\r\nBcc: other@example.test"],
    ['email' => []], ['quantity' => '0'], ['quantity' => '-1'], ['quantity' => '1.5'],
    ['quantity' => '1000000'], ['quantity' => []], ['model' => str_repeat('x', 161)],
    ['message' => str_repeat('x', 5001)], ['company' => ['bad']],
];
foreach ($badInputs as $change) {
    $calls = 0;
    $result = process(array_replace($base, $change), $catalog, $token, 0,
        static function (array $mail) use (&$calls): bool { ++$calls; return true; }, 1000);
    check($result['status'] >= 400 && $result['body']['success'] === false && $calls === 0, 'Invalid input reached transport: ' . json_encode($change));
}
$result = process($base, $catalog, $token, 990, $accept, 1000);
check($result['status'] === 429, 'Rate limit not enforced');
$result = process($base, $catalog, $token, 940, $accept, 1000);
check($result['status'] === 200, 'Valid request at rate limit boundary rejected');
$result = process($base, $catalog, $token, 0, static function (): bool { return false; });
check($result['status'] === 503 && $result['body']['success'] === false, 'Rejected mail must not report success');
$result = process($base, $catalog, $token, 0, static function (): bool { throw new RuntimeException('Transport failed'); });
check($result['status'] === 503 && $result['body']['success'] === false, 'Transport exception must not report success');
$result = process(array_replace($base, [
    'to' => 'other@example.test', 'fullName' => 'José Engineer', 'message' => "Line one\nLine two", 'source' => 'unknown',
]), $catalog, $token, 0, $accept);
$body = quoted_printable_decode($captured['body']);
check($result['status'] === 200 && $captured['to'] === 'sales@smartfloweng.com', 'Client must not change recipient');
check(strpos($body, 'José Engineer') !== false && strpos($body, 'Line two') !== false, 'Unicode or multiline message lost');
check(strpos($body, 'Smart Flow Engineering website - KOSMEK product showcase') !== false, 'Unknown source must fall back to our website');
echo "PASS: {$checks} PHP quote checks; all mail transports mocked, no real emails sent.\n";
