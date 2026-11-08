const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'assets/data/kosmek-quote-options.json'), 'utf8'));
const script = fs.readFileSync(path.join(root, 'js/kosmek-quote.js'), 'utf8');
const flush = () => new Promise(resolve => setImmediate(resolve));

function harness(settings = {}) {
    const events = new Map();
    const calls = [];
    let activeElement;
    class Element {
        constructor(value = '') {
            this.value = value; this.defaultValue = value; this.handlers = {}; this.dataset = {};
            this.textContent = ''; this.disabled = false; this.hidden = false; this.options = [];
            this.attrs = {};
        }
        addEventListener(type, handler) { this.handlers[type] = handler; }
        dispatch(type, event = {}) { return this.handlers[type]?.(event); }
        focus() { activeElement = this; }
        setAttribute(name, value) { this.attrs[name] = value; }
        removeAttribute(name) { delete this.attrs[name]; }
        getAttribute(name) { return this.attrs[name]; }
        replaceChildren(...options) { this.options = options; this.value = options[0]?.value || ''; }
        add(option) { this.options.push(option); }
    }
    const fields = Object.fromEntries(['range', 'component', 'model', 'quantity', 'fullName', 'company', 'email', 'phone', 'message', 'website', 'source'].map(name => [name, new Element(name === 'quantity' ? '1' : '')]));
    const form = new Element();
    form.elements = { namedItem: name => fields[name] };
    form.attrs.action = 'api/kosmek-quote.php';
    form.valid = true;
    form.reportValidity = () => form.valid;
    form.reset = () => Object.values(fields).forEach(field => { field.value = field.defaultValue; });
    const dialog = new Element();
    dialog.open = false;
    dialog.showModal = () => { dialog.open = true; };
    dialog.close = () => { dialog.open = false; dialog.dispatch('close'); };
    dialog.getBoundingClientRect = () => ({ left: 10, right: 100, top: 10, bottom: 100 });
    const status = new Element(), submit = new Element(), close = new Element();
    const classes = new Set();
    const elements = { 'kosmek-quote-dialog': dialog, 'kosmek-quote-form': form, 'kosmek-quote-submit': submit, 'kosmek-quote-status': status, 'kosmek-quote-close': close };
    const response = (data, ok = true) => ({ ok, json: async () => data });
    const state = { post: { success: true, reference: 'SFE-123456ABCDEF' }, postOK: true, catalogFailure: false, tokenFailure: false };
    const context = {
        console, AbortController, setTimeout, clearTimeout,
        Option: class { constructor(label, value) { this.label = label; this.value = value; } },
        FormData: class {
            constructor() { this.values = Object.entries(fields).filter(([, field]) => !field.disabled).map(([name, field]) => [name, field.value]); }
            [Symbol.iterator]() { return this.values[Symbol.iterator](); }
        },
        document: {
            getElementById: id => elements[id],
            addEventListener: (type, handler) => events.set(type, handler),
            body: { classList: { add: name => classes.add(name), remove: name => classes.delete(name) } }
        },
        fetch: async (url, options = {}) => {
            calls.push({ url, options });
            if (url.includes('options.json')) {
                if (state.catalogFailure) throw new Error('offline');
                return response(catalog);
            }
            if (options.method === 'POST') {
                if (settings.postDelay) await settings.postDelay;
                return response(state.post, state.postOK);
            }
            if (state.tokenFailure) throw new Error('PHP unavailable');
            return response({ token: 'a'.repeat(64) });
        }
    };
    vm.runInNewContext(script, context);
    const open = async (range = '', component = '', source = 'product-showcase') => {
        const trigger = new Element();
        trigger.dataset = { quoteRange: range, quoteComponent: component, quoteSource: source };
        events.get('click')({ target: { closest: () => trigger }, preventDefault() {}, stopPropagation() {} });
        await flush();
        return trigger;
    };
    const send = () => form.dispatch('submit', { preventDefault() {} });
    return { open, send, fields, form, dialog, status, submit, close, calls, classes, state, get activeElement() { return activeElement; } };
}

test('every range opens the dialog with matching component options', async () => {
    const h = harness();
    for (const [id, range] of Object.entries(catalog)) {
        await h.open(id);
        assert(h.dialog.open);
        assert.equal(h.fields.range.value, id);
        assert.deepEqual(h.fields.component.options.slice(1).map(option => option.label), Object.values(range.components));
        assert.equal(h.fields.component.value, '');
        h.dialog.close();
    }
});

test('component cards preselect their component; range changes clear the old component', async () => {
    const h = harness();
    await h.open('factory-automation', 'robotic-hand-changers');
    assert.equal(h.fields.component.value, 'robotic-hand-changers');
    h.fields.range.value = 'work-clamping';
    h.fields.range.dispatch('change');
    assert.equal(h.fields.component.value, '');
    assert(!h.fields.component.options.some(option => option.value === 'robotic-hand-changers'));
    await h.open('work-clamping', 'work-supports-and-locating-units');
    assert.equal(h.fields.component.value, 'work-supports-and-locating-units');
});

test('general quote starts without a range; close restores focus and page scrolling', async () => {
    const h = harness();
    const opener = await h.open();
    assert.equal(h.fields.range.value, '');
    assert(h.fields.component.disabled);
    assert(h.classes.has('kosmek-quote-open'));
    h.close.dispatch('click');
    assert(!h.dialog.open);
    assert(!h.classes.has('kosmek-quote-open'));
    assert.equal(h.activeElement, opener);
});

test('submission posts selected component and contact details locally, then shows confirmation', async () => {
    const h = harness();
    await h.open('factory-automation', 'robotic-hand-changers', 'homepage-partnership');
    h.fields.fullName.value = 'Test Engineer'; h.fields.email.value = 'test@example.test';
    await h.send();
    const post = h.calls.find(call => call.options.method === 'POST');
    assert.equal(post.url, 'api/kosmek-quote.php');
    const data = JSON.parse(post.options.body);
    assert.equal(data.range, 'factory-automation'); assert.equal(data.component, 'robotic-hand-changers');
    assert.equal(data.email, 'test@example.test'); assert.equal(data.source, 'homepage-partnership');
    assert.equal(data.csrf.length, 64);
    assert.equal(h.status.dataset.kind, 'success');
    assert.equal(h.status.textContent, 'Thank you. Your quote request has been submitted to Smart Flow Engineering.');
    assert(h.submit.disabled);
});

test('invalid required fields do not submit', async () => {
    const h = harness(); await h.open('factory-automation'); h.form.valid = false;
    await h.send();
    assert.equal(h.calls.length, 1);
});

test('server validation preserves details, focuses the failed field and allows retry', async () => {
    const h = harness(); await h.open('factory-automation', 'robotic-hand-changers');
    h.fields.email.value = 'incorrect';
    h.state.post = { success: false, message: 'Enter a valid email address.', errors: { email: 'invalid' } };
    h.state.postOK = false;
    await h.send();
    assert.equal(h.fields.email.value, 'incorrect');
    assert.equal(h.activeElement, h.fields.email);
    assert.equal(h.status.dataset.kind, 'error'); assert(!h.submit.disabled);
});

test('unavailable hosting or mail transport never shows a false success', async () => {
    for (const tokenFailure of [true, false]) {
        const h = harness(); await h.open('factory-automation', 'robotic-hand-changers');
        h.fields.fullName.value = 'Retain this name'; h.state.tokenFailure = tokenFailure;
        h.state.postOK = false; h.state.post = { success: false, message: 'Mail unavailable' };
        await h.send();
        assert.equal(h.status.dataset.kind, 'error'); assert(!h.submit.disabled);
        assert.equal(h.fields.fullName.value, 'Retain this name');
    }
});

test('product option loading can be retried after a network failure', async () => {
    const h = harness(); h.state.catalogFailure = true; await h.open();
    assert.equal(h.status.dataset.kind, 'error'); assert(h.submit.disabled);
    h.dialog.close(); h.state.catalogFailure = false; await h.open('die-change');
    assert.equal(h.fields.range.value, 'die-change'); assert(!h.submit.disabled);
});

test('double-submit is blocked while a request is pending', async () => {
    let finish; const postDelay = new Promise(resolve => { finish = resolve; });
    const h = harness({ postDelay }); await h.open('factory-automation', 'robotic-hand-changers');
    const first = h.send(); await flush(); await h.send();
    assert.equal(h.calls.filter(call => call.options.method === 'POST').length, 1);
    finish(); await first;
});
