<?php
declare(strict_types=1);

namespace SmartFlow\Contact;

function services(): array
{
    return [
        '' => 'General enquiry',
        'project' => 'Discuss a Project',
        'engineering-support' => 'Request Engineering Support',
        'upgrade' => 'Discuss an Upgrade',
        'maintenance' => 'Maintenance & Shutdown Support',
        'capability' => 'Request Capability Statement',
        'supplier' => 'Supplier / Subcontract Enquiry',
        'automation' => 'Automation & Control Systems',
        'electrical' => 'Electrical & MEICA Installation',
        'drives' => 'Drives & Motion Control',
        'commissioning' => 'Testing & Commissioning',
        'support' => 'Technical Support & Maintenance',
        'other' => 'Other / General Enquiry',
    ];
}

function validate(array $input): array
{
    $errors = [];
    $contact = [];
    foreach (['fullName' => 120, 'companyName' => 160, 'email' => 254, 'phone' => 60, 'service' => 40, 'message' => 5000] as $field => $limit) {
        $value = $input[$field] ?? '';
        if (!is_string($value)) {
            $errors[$field] = 'Please check this field.';
            $contact[$field] = '';
            continue;
        }
        $value = trim($value);
        if (preg_match('/^.{0,' . $limit . '}$/us', $value) !== 1 ||
            preg_match('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', $value) ||
            ($field !== 'message' && preg_match('/[\r\n]/', $value))) {
            $errors[$field] = 'Please shorten or correct this field.';
        }
        $contact[$field] = $value;
    }
    if ($contact['fullName'] === '') $errors['fullName'] = 'Enter your full name.';
    if (!filter_var($contact['email'], FILTER_VALIDATE_EMAIL)) $errors['email'] = 'Enter a valid email address.';
    if ($contact['message'] === '') $errors['message'] = 'Enter your message.';
    if (!array_key_exists($contact['service'], services())) $errors['service'] = 'Select one of the listed services.';
    $newsletter = $input['newsletter'] ?? false;
    if (!is_bool($newsletter)) $errors['newsletter'] = 'Please check your updates preference.';
    $contact['newsletter'] = $newsletter === true;
    return ['contact' => $contact, 'errors' => $errors];
}

function buildMail(array $contact, string $reference): array
{
    $service = services()[$contact['service']];
    $lines = [
        'Contact Us enquiry - Smart Flow Engineering',
        'Reference: ' . $reference,
        'Received (UTC): ' . gmdate('Y-m-d H:i:s'),
        '',
        'Full name: ' . $contact['fullName'],
        'Company: ' . ($contact['companyName'] ?: 'Not specified'),
        'Email: ' . $contact['email'],
        'Phone: ' . ($contact['phone'] ?: 'Not specified'),
        'Service: ' . $service,
        'Industry updates requested: ' . ($contact['newsletter'] ? 'Yes' : 'No'),
        '',
        'Message:',
        $contact['message'],
        '',
        'Enquiry source: Smart Flow Engineering website - Contact Us',
        'Page: https://smartfloweng.com/contact.html',
    ];
    return [
        'to' => 'sales@smartfloweng.com',
        'subject' => 'Website enquiry - ' . $service . ' - ' . $reference,
        'body' => quoted_printable_encode(implode("\r\n", $lines)),
        'headers' => [
            'From' => 'Smart Flow Engineering <sales@smartfloweng.com>',
            'Reply-To' => $contact['email'],
            'MIME-Version' => '1.0',
            'Content-Type' => 'text/plain; charset=UTF-8',
            'Content-Transfer-Encoding' => 'quoted-printable',
        ],
    ];
}

function process(array $input, string $token, int $lastSent, callable $sendMail, ?int $now = null): array
{
    $csrf = $input['csrf'] ?? null;
    if (!is_string($csrf) || $token === '' || !hash_equals($token, $csrf)) {
        return ['status' => 403, 'body' => ['success' => false, 'message' => 'Please try submitting the form again.']];
    }
    if (!empty($input['website'])) {
        return ['status' => 422, 'body' => ['success' => false, 'message' => 'We couldn’t submit this enquiry. Please check the form and try again.']];
    }
    $validated = validate($input);
    if ($validated['errors']) {
        return ['status' => 422, 'body' => [
            'success' => false, 'message' => (string) reset($validated['errors']), 'errors' => $validated['errors'],
        ]];
    }
    $now = $now ?? time();
    if ($lastSent > 0 && $now - $lastSent < 60) {
        return ['status' => 429, 'body' => ['success' => false, 'message' => 'Please wait a minute before sending another enquiry.']];
    }
    $reference = 'SFE-CONTACT-' . strtoupper(bin2hex(random_bytes(6)));
    $mail = buildMail($validated['contact'], $reference);
    try {
        $accepted = $sendMail($mail) === true;
    } catch (\Throwable $exception) {
        $accepted = false;
    }
    if (!$accepted) {
        return ['status' => 503, 'body' => ['success' => false, 'message' => 'We couldn’t send your message. Your details are still in the form. Please try again or call +44 1234 440 530.']];
    }
    return ['status' => 200, 'body' => ['success' => true, 'reference' => $reference]];
}
