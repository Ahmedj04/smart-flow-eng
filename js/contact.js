/* Contact Us form: submit to our server, preserving details on failure. */
(() => {
    'use strict';
    const form = document.getElementById('contactForm');
    if (!form) return;
    const submit = form.querySelector('button[type="submit"]');
    const status = document.getElementById('contact-form-status');
    const endpoint = form.getAttribute('action');
    const originalLabel = submit.innerHTML;
    let sending = false;

    // Buyer-specific links select a supported route in the existing enquiry field.
    if (typeof window !== 'undefined' && window.location) {
        const routes = {
            project: 'project', support: 'engineering-support', upgrade: 'upgrade',
            maintenance: 'maintenance', capability: 'capability', supplier: 'supplier'
        };
        const route = new URLSearchParams(window.location.search).get('enquiry');
        if (Object.prototype.hasOwnProperty.call(routes, route)) {
            form.elements.namedItem('service').value = routes[route];
        }
    }

    function showStatus(message, kind) {
        status.textContent = message;
        status.dataset.kind = kind;
        status.hidden = false;
    }

    form.addEventListener('submit', async event => {
        event.preventDefault();
        if (sending || !form.reportValidity()) return;
        const payload = Object.fromEntries(new FormData(form));
        payload.newsletter = form.elements.namedItem('newsletter').checked;
        sending = true;
        submit.disabled = true;
        submit.textContent = 'Sending your message…';
        form.setAttribute('aria-busy', 'true');
        showStatus('Sending your message to Smart Flow Engineering…', 'info');
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20000);
        try {
            const tokenResponse = await fetch(endpoint, {
                credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
                headers: { 'Accept': 'application/json' }
            });
            if (!tokenResponse.ok) throw new Error('unavailable');
            const tokenData = await tokenResponse.json();
            if (typeof tokenData.token !== 'string') throw new Error('unavailable');
            payload.csrf = tokenData.token;

            const response = await fetch(endpoint, {
                method: 'POST', credentials: 'same-origin', signal: controller.signal,
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            if (!response.ok || result.success !== true || typeof result.reference !== 'string') {
                showStatus(typeof result.message === 'string' ? result.message : 'We couldn’t send your message. Please try again or call +44 1234 440 530.', 'error');
                const fields = result.errors && typeof result.errors === 'object' ? Object.keys(result.errors) : [];
                if (fields.length) form.elements.namedItem(fields[0])?.focus();
                else status.focus();
                return;
            }
            form.reset();
            showStatus('Thank you. Your message has been submitted to Smart Flow Engineering.', 'success');
            status.focus();
        } catch (_) {
            showStatus('We couldn’t confirm that your message was sent. Your details are still here. Please try again or call +44 1234 440 530.', 'error');
            status.focus();
        } finally {
            clearTimeout(timeout);
            sending = false;
            submit.disabled = false;
            submit.innerHTML = originalLabel;
            form.removeAttribute('aria-busy');
        }
    });
})();
