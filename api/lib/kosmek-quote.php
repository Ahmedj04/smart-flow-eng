<?php
declare(strict_types=1);

namespace SmartFlow\Quote;

/** Validate fields independently of the mail transport. */
function validate(array $input, array $catalog): array
{
    $errors = [];
    $quote = [];
    $limits = [
        'range' => 80, 'component' => 120, 'model' => 160,
        'fullName' => 120, 'company' => 160, 'email' => 254,
        'phone' => 60, 'message' => 5000, 'source' => 40,
    ];
    foreach ($limits as $field => $limit) {
        $value = $input[$field] ?? '';
        if (!is_string($value)) {
            $errors[$field] = 'Please check this field.';
            $quote[$field] = '';
            continue;
        }
        $value = trim($value);
        $singleLine = $field !== 'message';
        if (preg_match('/^.{0,' . $limit . '}$/us', $value) !== 1 ||
            preg_match('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', $value) ||
            ($singleLine && preg_match('/[\r\n]/', $value))) {
            $errors[$field] = 'Please shorten or correct this field.';
        }
        $quote[$field] = $value;
    }

    if (!isset($catalog[$quote['range']])) {
        $errors['range'] = 'Select a product range.';
    } elseif (!isset($catalog[$quote['range']]['components'][$quote['component']])) {
        $errors['component'] = 'Select a component from the chosen product range.';
    }
    if ($quote['fullName'] === '') $errors['fullName'] = 'Enter your full name.';
    if (!filter_var($quote['email'], FILTER_VALIDATE_EMAIL)) {
        $errors['email'] = 'Enter a valid email address.';
    }
    $quantity = $input['quantity'] ?? '';
    if ((!is_string($quantity) && !is_int($quantity)) ||
        filter_var($quantity, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 999999]]) === false) {
        $errors['quantity'] = 'Enter a whole-number quantity between 1 and 999999.';
    }
    $quote['quantity'] = (is_string($quantity) || is_int($quantity)) ? (int) $quantity : 0;
    $sources = [
        'homepage-partnership' => 'Homepage KOSMEK partnership section',
        'product-showcase' => 'KOSMEK product showcase',
        'component-spotlight' => 'KOSMEK component spotlight',
    ];
    $quote['sourceLabel'] = $sources[$quote['source']] ?? $sources['product-showcase'];
    return ['quote' => $quote, 'errors' => $errors];
}

/** Build an email with a fixed destination and a validated reply address. */
function buildMail(array $quote, array $catalog, string $reference): array
{
    $range = $catalog[$quote['range']];
    $lines = [
        'KOSMEK quote request - Smart Flow Engineering',
        'Reference: ' . $reference,
        'Received (UTC): ' . gmdate('Y-m-d H:i:s'),
        '',
        'Product range: ' . $range['label'],
        'Component: ' . $range['components'][$quote['component']],
        'Model / part number: ' . ($quote['model'] ?: 'Not specified'),
        'Quantity: ' . $quote['quantity'],
        '',
        'Full name: ' . $quote['fullName'],
        'Company: ' . ($quote['company'] ?: 'Not specified'),
        'Email: ' . $quote['email'],
        'Phone: ' . ($quote['phone'] ?: 'Not specified'),
        '',
        'Application / requirements:',
        $quote['message'] ?: 'Not specified',
        '',
        'Enquiry source: Smart Flow Engineering website - ' . $quote['sourceLabel'],
        'Product page: https://smartfloweng.com/kosmek-products.html#' . $quote['range'],
    ];
    return [
        'to' => 'sales@smartfloweng.com',
        'subject' => 'KOSMEK quote - ' . $range['label'] . ' - ' . $reference,
        'body' => quoted_printable_encode(implode("\r\n", $lines)),
        'headers' => [
            'From' => 'Smart Flow Engineering <sales@smartfloweng.com>',
            'Reply-To' => $quote['email'],
            'MIME-Version' => '1.0',
            'Content-Type' => 'text/plain; charset=UTF-8',
            'Content-Transfer-Encoding' => 'quoted-printable',
        ],
    ];
}

/** A successful response is returned only after the transport accepts the email. */
function process(array $input, array $catalog, string $token, int $lastSent, callable $sendMail, ?int $now = null): array
{
    $csrf = $input['csrf'] ?? null;
    if (!is_string($csrf) || $token === '' || !hash_equals($token, $csrf)) {
        return ['status' => 403, 'body' => ['success' => false, 'message' => 'Please try submitting the form again.']];
    }
    if (!empty($input['website'])) {
        return ['status' => 422, 'body' => ['success' => false, 'message' => 'We couldn’t submit this request. Please check the form and try again.']];
    }
    $validated = validate($input, $catalog);
    if ($validated['errors']) {
        return ['status' => 422, 'body' => [
            'success' => false,
            'message' => (string) reset($validated['errors']),
            'errors' => $validated['errors'],
        ]];
    }
    $now = $now ?? time();
    if ($lastSent > 0 && $now - $lastSent < 60) {
        return ['status' => 429, 'body' => ['success' => false, 'message' => 'Please wait a minute before sending another quote request.']];
    }
    $reference = 'SFE-' . strtoupper(bin2hex(random_bytes(6)));
    $mail = buildMail($validated['quote'], $catalog, $reference);
    try {
        $accepted = $sendMail($mail) === true;
    } catch (\Throwable $exception) {
        $accepted = false;
    }
    if (!$accepted) {
        return ['status' => 503, 'body' => ['success' => false, 'message' => 'We couldn’t send your request. Your details are still in the form. Please try again or call +44 1234 440 530.']];
    }
    return ['status' => 200, 'body' => ['success' => true, 'reference' => $reference]];
}
