const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const script = fs.readFileSync(path.join(__dirname, '../js/contact.js'), 'utf8');
const flush = () => new Promise(resolve => setImmediate(resolve));

function harness(settings = {}) {
    let focused;
    class Element {
        constructor(value = '') { this.value = value; this.checked = false; this.handlers = {}; this.attrs = {}; this.dataset = {}; this.disabled = false; this.hidden = true; this.innerHTML = 'Send Message'; this.textContent = ''; }
        addEventListener(type, handler) { this.handlers[type] = handler; }
        setAttribute(name, value) { this.attrs[name] = value; }
        getAttribute(name) { return this.attrs[name]; }
        removeAttribute(name) { delete this.attrs[name]; }
        focus() { focused = this; }
    }
    const fields = Object.fromEntries(['fullName', 'companyName', 'email', 'phone', 'service', 'message', 'newsletter', 'website'].map(name => [name, new Element()]));
    fields.fullName.value = 'Test Engineer'; fields.email.value = 'test@example.test'; fields.message.value = 'Please contact us.';
    const button = new Element(), status = new Element(), form = new Element();
    form.attrs.action = 'api/contact.php'; form.valid = true; form.resetCount = 0;
    form.elements = { namedItem: name => fields[name] };
    form.querySelector = () => button;
    form.reportValidity = () => form.valid;
    form.reset = () => { ++form.resetCount; Object.values(fields).forEach(field => { field.value = ''; field.checked = false; }); };
    const calls = [];
    const state = { ok: true, result: { success: true, reference: 'SFE-CONTACT-123456ABCDEF' }, tokenFailure: false, invalidJSON: false };
    vm.runInNewContext(script, {
        AbortController, setTimeout, clearTimeout, URLSearchParams,
        window: { location: { search: settings.search || '' } },
        document: { getElementById: id => id === 'contactForm' ? form : status },
        FormData: class {
            constructor() { this.entries = Object.entries(fields).filter(([name, field]) => name !== 'newsletter' || field.checked).map(([name, field]) => [name, field.value]); }
            [Symbol.iterator]() { return this.entries[Symbol.iterator](); }
        },
        fetch: async (url, options = {}) => {
            calls.push({ url, options });
            if (options.method !== 'POST') {
                if (state.tokenFailure) throw new Error('Unavailable');
                return { ok: true, json: async () => ({ token: 'b'.repeat(64) }) };
            }
            if (settings.delay) await settings.delay;
            return { ok: state.ok, json: async () => { if (state.invalidJSON) throw new Error('Not PHP'); return state.result; } };
        }
    });
    return { fields, button, status, form, state, calls, submit: () => form.handlers.submit({ preventDefault() {} }), get focused() { return focused; } };
}

test('posts form details to the local endpoint, and resets only after server confirmation', async () => {
    const h = harness(); h.fields.newsletter.checked = true; await h.submit();
    assert.equal(h.calls.length, 2); assert(h.calls.every(call => call.url === 'api/contact.php'));
    const payload = JSON.parse(h.calls[1].options.body);
    assert.equal(payload.email, 'test@example.test'); assert.equal(payload.newsletter, true); assert.equal(payload.csrf.length, 64);
    assert.equal(h.form.resetCount, 1); assert.equal(h.status.dataset.kind, 'success');
    assert.equal(h.status.textContent, 'Thank you. Your message has been submitted to Smart Flow Engineering.'); assert(!h.button.disabled);
});
test('unchecked newsletter preference is sent explicitly as false', async () => {
    const h = harness(); await h.submit();
    assert.equal(JSON.parse(h.calls[1].options.body).newsletter, false);
});
test('buyer links preselect supported enquiry types and preserve the choice in submissions', async () => {
    for (const [route, expected] of Object.entries({ project: 'project', support: 'engineering-support', upgrade: 'upgrade', maintenance: 'maintenance', capability: 'capability', supplier: 'supplier' })) {
        const h = harness({ search: '?enquiry=' + route });
        assert.equal(h.fields.service.value, expected);
        await h.submit();
        assert.equal(JSON.parse(h.calls[1].options.body).service, expected);
    }
});
test('unknown enquiry routes cannot set arbitrary form values', () => {
    for (const route of ['unknown', 'constructor', '__proto__']) {
        assert.equal(harness({ search: '?enquiry=' + route }).fields.service.value, '');
    }
});
test('invalid required fields make no requests', async () => {
    const h = harness(); h.form.valid = false; await h.submit();
    assert.equal(h.calls.length, 0); assert.equal(h.form.resetCount, 0);
});
test('mail rejection preserves entries and shows an error', async () => {
    const h = harness(); h.state.ok = false; h.state.result = { success: false, message: 'Could not send.' }; await h.submit();
    assert.equal(h.form.resetCount, 0); assert.equal(h.fields.message.value, 'Please contact us.');
    assert.equal(h.status.dataset.kind, 'error'); assert(!h.button.disabled);
});
test('server field validation focuses the failed input', async () => {
    const h = harness(); h.state.ok = false; h.state.result = { success: false, message: 'Invalid email', errors: { email: 'Invalid' } }; await h.submit();
    assert.equal(h.focused, h.fields.email); assert.equal(h.form.resetCount, 0);
});
test('unavailable PHP, malformed responses and missing confirmations never clear the form', async () => {
    for (const mode of ['tokenFailure', 'invalidJSON', 'missingReference']) {
        const h = harness();
        if (mode === 'missingReference') h.state.result = { success: true };
        else h.state[mode] = true;
        await h.submit(); assert.equal(h.form.resetCount, 0); assert.equal(h.status.dataset.kind, 'error'); assert(!h.button.disabled);
    }
});
test('duplicate clicks cannot send concurrent requests', async () => {
    let finish; const delay = new Promise(resolve => { finish = resolve; });
    const h = harness({ delay }); const first = h.submit(); await flush(); await h.submit();
    assert.equal(h.calls.filter(call => call.options.method === 'POST').length, 1);
    finish(); await first;
});
