/* Shared KOSMEK quote form for the homepage and product showcase. */
(() => {
    'use strict';

    const dialog = document.getElementById('kosmek-quote-dialog');
    const form = document.getElementById('kosmek-quote-form');
    if (!dialog || !form) return;

    const range = form.elements.namedItem('range');
    const component = form.elements.namedItem('component');
    const source = form.elements.namedItem('source');
    const submit = document.getElementById('kosmek-quote-submit');
    const status = document.getElementById('kosmek-quote-status');
    const endpoint = form.getAttribute('action');
    let catalog = null;
    let catalogRequest = null;
    let opener = null;
    let sending = false;
    let submitted = false;
    let openSequence = 0;

    function showStatus(message, kind = 'error') {
        status.textContent = message;
        status.dataset.kind = kind;
        status.hidden = !message;
    }

    function populateComponents(selected = '') {
        const options = catalog?.[range.value]?.components;
        component.replaceChildren(new Option(options ? 'Select a component' : 'Choose a product range first', ''));
        component.disabled = !options;
        if (!options) return;
        Object.entries(options).forEach(([value, label]) => component.add(new Option(label, value)));
        if (Object.hasOwn(options, selected)) component.value = selected;
    }

    async function loadCatalog() {
        if (catalog) return catalog;
        if (!catalogRequest) {
            catalogRequest = fetch('assets/data/kosmek-quote-options.json', { credentials: 'same-origin' })
                .then(response => {
                    if (!response.ok) throw new Error('catalog');
                    return response.json();
                })
                .then(data => {
                    if (!data || typeof data !== 'object' || !data['factory-automation']?.components) {
                        throw new Error('catalog');
                    }
                    catalog = data;
                    range.replaceChildren(new Option('Select a product range', ''));
                    Object.entries(catalog).forEach(([value, entry]) => range.add(new Option(entry.label, value)));
                    return catalog;
                })
                .catch(error => {
                    catalogRequest = null;
                    throw error;
                });
        }
        return catalogRequest;
    }

    async function openQuote(trigger) {
        opener = trigger;
        const sequence = ++openSequence;
        if (!dialog.open) dialog.showModal();
        document.body.classList.add('kosmek-quote-open');
        // Keep an in-flight submission tied to the original selections.
        if (sending) return;
        if (submitted) {
            form.reset();
            submitted = false;
        }
        submit.disabled = true;
        showStatus('Loading product options…', 'info');
        try {
            await loadCatalog();
            if (sequence !== openSequence || !dialog.open) return;
            range.value = Object.hasOwn(catalog, trigger.dataset.quoteRange || '') ? trigger.dataset.quoteRange : '';
            populateComponents(trigger.dataset.quoteComponent || '');
            source.value = trigger.dataset.quoteSource || 'product-showcase';
            showStatus('');
            submit.disabled = false;
            submit.textContent = 'Send quote request';
            (range.value ? form.elements.namedItem('fullName') : range).focus();
        } catch (_) {
            if (sequence !== openSequence || !dialog.open) return;
            showStatus('We couldn’t load the product options. Please close the form and try again, or call +44 1234 440 530.');
        }
    }

    // Capture quote links before the site's general anchor scrolling handler.
    document.addEventListener('click', event => {
        const trigger = event.target.closest('[data-kosmek-quote]');
        if (!trigger) return;
        event.preventDefault();
        event.stopPropagation();
        openQuote(trigger);
    }, true);

    range.addEventListener('change', () => populateComponents());
    document.getElementById('kosmek-quote-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => {
        if (event.target !== dialog) return;
        const bounds = dialog.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right ||
            event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
    });
    dialog.addEventListener('close', () => {
        ++openSequence;
        document.body.classList.remove('kosmek-quote-open');
        opener?.focus();
    });

    form.addEventListener('submit', async event => {
        event.preventDefault();
        if (sending || submitted || !catalog || !form.reportValidity()) return;
        sending = true;
        submit.disabled = true;
        submit.textContent = 'Sending your request…';
        form.setAttribute('aria-busy', 'true');
        showStatus('Sending your quote request to Smart Flow Engineering…', 'info');
        const payload = Object.fromEntries(new FormData(form));
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20000);
        try {
            const tokenResponse = await fetch(endpoint, {
                credentials: 'same-origin', cache: 'no-store', signal: controller.signal
            });
            if (!tokenResponse.ok) throw new Error('unavailable');
            const tokenData = await tokenResponse.json();
            if (typeof tokenData.token !== 'string') throw new Error('unavailable');
            payload.csrf = tokenData.token;

            const response = await fetch(endpoint, {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify(payload),
                signal: controller.signal
            });
            const result = await response.json();
            if (!response.ok || result.success !== true || typeof result.reference !== 'string') {
                const errors = result.errors && typeof result.errors === 'object' ? Object.keys(result.errors) : [];
                const firstField = errors.length ? form.elements.namedItem(errors[0]) : null;
                showStatus(typeof result.message === 'string' ? result.message : 'We couldn’t send your request. Please try again or call +44 1234 440 530.');
                firstField?.focus();
                return;
            }
            submitted = true;
            showStatus('Thank you. Your quote request has been submitted to Smart Flow Engineering.', 'success');
            status.focus();
        } catch (_) {
            showStatus('We couldn’t confirm that your request was sent. Your details are still here. Please try again or call +44 1234 440 530.');
        } finally {
            clearTimeout(timeout);
            sending = false;
            form.removeAttribute('aria-busy');
            submit.disabled = submitted;
            submit.textContent = submitted ? 'Request submitted' : 'Send quote request';
        }
    });
})();
