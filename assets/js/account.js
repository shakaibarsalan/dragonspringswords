/**
 * DRAGON SPRING SWORDS, customer accounts (optional: guests order and chat as before).
 *
 * Signing in: email, then the 6-digit code we email (no password). The same small window does sign-in and
 * sign-up, from the header's account icon, the account page, the checkout and the chat.
 * One login with the chat: every change is announced as a "ds:account" event (support.js listens), and the
 * chat's own email code signs the store in too (support.js calls DSAccount.refresh()).
 * The account page (/account) is drawn here from /api/account/*: orders, conversations, addresses, details.
 *
 * window.DSAccount = { ready, me, shop, refresh(), signIn({email}) -> Promise<me|null>, signOut(all) }
 */
(function () {
  'use strict';

  const esc = (s) =>
    String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const CART_KEY = 'dragonspring:cart';
  const usd = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(n) || 0);
  const day = (ts) => {
    try { return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(ts * 1000)); }
    catch (_) { return new Date(ts * 1000).toDateString(); }
  };
  const SVG = (d, w = 18) => `<svg viewBox="0 0 24 24" width="${w}" height="${w}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const ICON = {
    x: SVG('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>', 20),
    back: SVG('<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>', 16),
    check: SVG('<path d="M20 6 9 17l-5-5"/>', 16),
    box: SVG('<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5"/><path d="M12 13v8"/>'),
    chat: SVG('<path d="M4 5h16v11H9l-5 4z"/>'),
    pin: SVG('<path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/>'),
    user: SVG('<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'),
    copy: SVG('<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>', 15),
  };

  async function api(url, data) {
    try {
      const res = await fetch(url, data
        ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data), credentials: 'same-origin' }
        : { headers: { Accept: 'application/json' }, credentials: 'same-origin', cache: 'no-store' });
      const out = await res.json().catch(() => ({}));
      out.status = res.status;
      return out;
    } catch (_) {
      return { ok: false, status: 0, error: 'No connection. Please try again.' };
    }
  }

  /* ------------------------------------------------------------------ state */
  const state = { me: { signedIn: false }, shop: null };
  let resolveReady;
  const ready = new Promise((r) => { resolveReady = r; });
  const emit = () => document.dispatchEvent(new CustomEvent('ds:account', { detail: state.me }));

  async function refresh() {
    const out = await api('/api/account/me');
    if (out && out.ok) {
      state.me = out.me || { signedIn: false };
      state.shop = out.shop || null;
    }
    paintHeader();
    emit();
    resolveReady(state);
    return state.me;
  }

  function paintHeader() {
    const me = state.me;
    $$('[data-account-link]').forEach((a) => {
      a.classList.toggle('is-signed-in', !!me.signedIn);
      a.setAttribute('aria-label', me.signedIn ? `Your account (${me.first || me.email})` : 'Sign in or create an account');
      let dot = a.querySelector('.account-initial');
      if (!a.classList.contains('account-link')) return; // the menu's text link has no badge
      if (me.signedIn) {
        if (!dot) { dot = document.createElement('span'); dot.className = 'account-initial'; dot.setAttribute('aria-hidden', 'true'); a.appendChild(dot); }
        dot.textContent = (me.first || me.email || '?').charAt(0).toUpperCase();
      } else if (dot) dot.remove();
    });
  }

  /* ------------------------------------------------------------------ toast */
  let toastEl, toastTimer;
  function toast(text) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'ds-toast';
      toastEl.setAttribute('role', 'status');
      toastEl.setAttribute('aria-live', 'polite');
      document.body.appendChild(toastEl);
    }
    toastEl.innerHTML = `${ICON.check}<span>${esc(text)}</span>`;
    toastEl.classList.remove('is-on');
    void toastEl.offsetWidth;
    toastEl.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('is-on'), 3200);
  }

  /* ------------------------------------------------------------------ the sign-in form (window or page) */
  function readCart() {
    try { const c = JSON.parse(localStorage.getItem(CART_KEY) || '{}'); return Array.isArray(c.items) ? c.items : []; }
    catch (_) { return []; }
  }

  function signInForm({ email = '', inline = false, onDone, onClose } = {}) {
    const el = document.createElement('div');
    el.className = 'signin' + (inline ? ' is-inline' : '');
    el.innerHTML = `
      ${inline ? '' : `<button type="button" class="signin-close" aria-label="Close">${ICON.x}</button>`}
      <form class="signin-step" data-step="email" novalidate>
        <p class="eyebrow">Your account</p>
        <h2 class="signin-title">Sign in or create an account</h2>
        <p class="signin-lede">No password needed. We email you a 6-digit code.</p>
        <label class="signin-field"><span>Email</span><input type="email" name="email" autocomplete="email" inputmode="email" maxlength="120" required value="${esc(email)}" /></label>
        <label class="hp" aria-hidden="true">Website <input name="website" tabindex="-1" autocomplete="off" /></label>
        <p class="signin-error" role="alert" hidden></p>
        <button type="submit" class="btn btn-dark btn-block">Email me a code</button>
        <ul class="signin-perks">
          <li>${ICON.box}<span>Follow your orders, payment and delivery</span></li>
          <li>${ICON.chat}<span>Your conversations with us, in one place</span></li>
          <li>${ICON.pin}<span>Saved addresses and a faster checkout</span></li>
        </ul>
      </form>
      <form class="signin-step" data-step="code" novalidate hidden>
        <button type="button" class="signin-back" data-back>${ICON.back}<span>Use a different email</span></button>
        <h2 class="signin-title">Check your email</h2>
        <p class="signin-lede">We sent a 6-digit code to <strong data-hint></strong>. It works for 15 minutes.</p>
        <label class="signin-field"><span>Code</span><input name="code" class="signin-code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" required /></label>
        <p class="signin-error" role="alert" hidden></p>
        <button type="submit" class="btn btn-dark btn-block">Sign in</button>
        <p class="signin-fine">Nothing there? Check spam, or <button type="button" class="signin-link" data-resend>send a new code</button>.</p>
      </form>
      <form class="signin-step" data-step="name" novalidate hidden>
        <h2 class="signin-title">Welcome! What should we call you?</h2>
        <p class="signin-lede">So we can greet you, and fill it in when you order.</p>
        <label class="signin-field"><span>Your name</span><input name="name" autocomplete="name" maxlength="80" /></label>
        <p class="signin-error" role="alert" hidden></p>
        <button type="submit" class="btn btn-dark btn-block">Continue</button>
        <p class="signin-fine"><button type="button" class="signin-link" data-skip>Skip for now</button></p>
      </form>`;
    let handle = '';
    let cooldown = 0;
    let cdTimer = 0;
    const step = (name) => {
      $$('.signin-step', el).forEach((f) => { f.hidden = f.dataset.step !== name; });
      const f = $(`[data-step="${name}"]`, el);
      const input = f && $('input:not([name=website])', f);
      if (input) setTimeout(() => input.focus({ preventScroll: inline }), 40);
    };
    const err = (form, text, field) => {
      const p = $('.signin-error', form);
      p.textContent = text || '';
      p.hidden = !text;
      $$('input', form).forEach((i) => i.removeAttribute('aria-invalid'));
      if (field) { const i = $(`[name=${field}]`, form); if (i) { i.setAttribute('aria-invalid', 'true'); i.focus(); } }
    };
    const busy = (form, on) => {
      const b = $('button[type=submit]', form);
      b.disabled = on;
      b.classList.toggle('is-busy', on);
    };
    const tick = () => {
      const b = $('[data-resend]', el);
      if (cooldown > 0) { b.disabled = true; b.textContent = `send a new code in ${cooldown}s`; cooldown -= 1; cdTimer = setTimeout(tick, 1000); }
      else { b.disabled = false; b.textContent = 'send a new code'; }
    };
    const startCooldown = () => { clearTimeout(cdTimer); cooldown = 30; tick(); };

    $('[data-step="email"]', el).addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.currentTarget;
      const value = f.email.value.trim();
      if (!EMAIL.test(value)) return err(f, 'Please check your email address.', 'email');
      err(f, '');
      busy(f, true);
      const out = await api('/api/account/code', { email: value, website: f.website.value });
      busy(f, false);
      if (!out.ok) return err(f, out.error || 'Couldn’t send the code. Please try again.', out.fields && out.fields[0]);
      handle = out.handle;
      $('[data-hint]', el).textContent = out.hint || value;
      const codeForm = $('[data-step="code"]', el);
      codeForm.code.value = '';
      err(codeForm, out.note || '');
      if (out.note) $('.signin-error', codeForm).classList.add('is-note');
      step('code');
      startCooldown();
    });
    const codeForm = $('[data-step="code"]', el);
    codeForm.code.addEventListener('input', () => {
      codeForm.code.value = codeForm.code.value.replace(/\D/g, '').slice(0, 6);
      $('.signin-error', codeForm).classList.remove('is-note');
      if (codeForm.code.value.length === 6) codeForm.requestSubmit();
    });
    codeForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (codeForm.code.value.length !== 6) return err(codeForm, 'Enter the 6 digits from the email.', 'code');
      err(codeForm, '');
      busy(codeForm, true);
      const out = await api('/api/account/verify', { handle, code: codeForm.code.value, cart: readCart() });
      busy(codeForm, false);
      if (!out.ok) {
        if (out.restart) { step('email'); return err($('[data-step="email"]', el), out.error); }
        codeForm.code.value = '';
        return err(codeForm, out.error || 'Couldn’t check the code. Please try again.', 'code');
      }
      state.me = out.me;
      if (window.DSCart && out.cart) window.DSCart.adopt(out.cart);
      paintHeader();
      emit();
      if (!out.me.name) return step('name');
      finish();
    });
    $('[data-back]', el).addEventListener('click', () => step('email'));
    $('[data-resend]', el).addEventListener('click', async () => {
      const out = await api('/api/account/resend', { handle });
      if (out.ok) { err(codeForm, 'A new code is on its way.'); $('.signin-error', codeForm).classList.add('is-note'); startCooldown(); }
      else if (out.restart) step('email');
      else err(codeForm, out.error);
    });
    const nameForm = $('[data-step="name"]', el);
    nameForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = nameForm.elements.name.value.trim();
      if (!name) return finish();
      busy(nameForm, true);
      const out = await api('/api/account/profile', { name, phone: state.me.phone || '' });
      busy(nameForm, false);
      if (!out.ok) return err(nameForm, out.error);
      state.me = out.me;
      paintHeader();
      emit();
      finish();
    });
    $('[data-skip]', el).addEventListener('click', finish);
    if (!inline) $('.signin-close', el).addEventListener('click', () => onClose && onClose());
    function finish() {
      clearTimeout(cdTimer);
      toast(state.me.first ? `Signed in. Welcome, ${state.me.first}.` : 'You’re signed in.');
      if (onDone) onDone(state.me);
    }
    el.focusFirst = () => step('email');
    return el;
  }

  /* The sign-in window: resolves with the signed-in customer, or null if closed. */
  let dialog = null;
  function signIn(opts = {}) {
    if (state.me.signedIn) return Promise.resolve(state.me);
    if (dialog) { dialog.remove(); dialog = null; }
    return new Promise((resolve) => {
      dialog = document.createElement('dialog');
      dialog.className = 'signin-dialog';
      dialog.setAttribute('aria-label', 'Sign in or create an account');
      let result = null;
      const form = signInForm({
        email: opts.email || '',
        onDone: (me) => { result = me; dialog.close(); },
        onClose: () => dialog.close(),
      });
      dialog.appendChild(form);
      document.body.appendChild(dialog);
      dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); }); // the dimmed area around it
      dialog.addEventListener('close', () => { const d = dialog; dialog = null; setTimeout(() => d && d.remove(), 300); resolve(result); });
      dialog.showModal();
      form.focusFirst();
    });
  }

  async function signOut(all) {
    await api('/api/account/signout', { all: !!all });
    state.me = { signedIn: false };
    paintHeader();
    emit();
    toast(all ? 'Signed out on all your devices.' : 'Signed out.');
  }

  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-account-link]');
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    if (state.me.signedIn || document.body.dataset.page === 'account') return; // the page itself, or its sign-in card
    e.preventDefault();
    signIn().then((me) => { if (me && /^\/account/.test(location.pathname)) location.reload(); });
  });

  window.DSAccount = {
    ready,
    get me() { return state.me; },
    get shop() { return state.shop; },
    refresh, signIn, signOut, toast, api,
  };

  /* ------------------------------------------------------------------ the account page */
  const root = document.getElementById('account');
  const TABS = [['orders', 'Orders'], ['messages', 'Messages'], ['addresses', 'Addresses'], ['details', 'Details']];
  let countries = null;

  function renderSignedOut() {
    root.innerHTML = `
      <div class="shell account-out">
        <div class="account-out-card"></div>
      </div>`;
    const card = $('.account-out-card', root);
    card.appendChild(signInForm({ inline: true, onDone: () => renderAccount() }));
    $('input[name=email]', card).focus({ preventScroll: true });
  }

  function tabFromHash() {
    const h = location.hash.replace('#', '');
    return TABS.some(([k]) => k === h) ? h : 'orders';
  }

  let pageSignedIn = null;
  function renderAccount() {
    const me = state.me;
    pageSignedIn = !!me.signedIn;
    if (!me.signedIn) return renderSignedOut();
    root.innerHTML = `
      <div class="shell account-shell">
        <header class="account-hero">
          <div class="account-hero-text">
            <span class="account-avatar" aria-hidden="true">${esc((me.first || me.email).charAt(0).toUpperCase())}</span>
            <div>
              <p class="eyebrow">Your account</p>
              <h1 class="display-md">${me.first ? `Hello, ${esc(me.first)}` : 'Hello'}</h1>
              <p class="account-email">${esc(me.email)}</p>
            </div>
          </div>
          <button type="button" class="btn btn-outline-dark account-signout" data-signout>Sign out</button>
        </header>
        <div class="account-tabs" role="tablist" aria-label="Your account">
          ${TABS.map(([k, label]) => `<button type="button" role="tab" id="tab-${k}" aria-controls="panel-${k}" data-tab="${k}">${label}<span class="account-count" data-count="${k}"></span></button>`).join('')}
        </div>
        ${TABS.map(([k]) => `<section class="account-panel" role="tabpanel" id="panel-${k}" aria-labelledby="tab-${k}" data-panel="${k}" hidden></section>`).join('')}
      </div>`;
    $('[data-signout]', root).addEventListener('click', async () => { await signOut(false); renderAccount(); });
    $$('[data-tab]', root).forEach((b) => b.addEventListener('click', () => {
      history.replaceState(null, '', '#' + b.dataset.tab);
      showTab(b.dataset.tab);
    }));
    $('.account-tabs', root).addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const tabs = $$('[data-tab]', root);
      const i = tabs.indexOf(document.activeElement);
      if (i < 0) return;
      const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      next.focus();
      next.click();
    });
    showTab(tabFromHash());
    loadOrders();
    loadThreads();
  }

  function showTab(key) {
    $$('[data-tab]', root).forEach((b) => {
      const on = b.dataset.tab === key;
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
    });
    $$('[data-panel]', root).forEach((p) => { p.hidden = p.dataset.panel !== key; });
    if (key === 'addresses') loadAddresses();
    if (key === 'details') renderDetails();
  }

  const count = (k, n) => { const el = $(`[data-count="${k}"]`, root); if (el) el.textContent = n ? String(n) : ''; };
  const loading = (panel) => { panel.innerHTML = '<div class="account-loading" aria-busy="true"><span></span><span></span><span></span></div>'; };
  const signedOutAgain = (out) => { if (out && out.signedOut) { state.me = { signedIn: false }; paintHeader(); emit(); renderAccount(); return true; } return false; };

  /* Orders */
  async function loadOrders() {
    const panel = $('[data-panel="orders"]', root);
    loading(panel);
    const out = await api('/api/account/orders');
    if (signedOutAgain(out)) return;
    if (!out.ok) { panel.innerHTML = `<p class="account-empty">${esc(out.error || 'Couldn’t load your orders.')}</p>`; return; }
    count('orders', out.orders.length);
    if (!out.orders.length) {
      panel.innerHTML = `<div class="account-empty">${ICON.box}<h2>No orders yet</h2><p>When you order, it shows up here with its payment, delivery and tracking.</p><a class="btn btn-dark" href="/shop">Browse the shop</a></div>`;
      return;
    }
    panel.innerHTML = `<div class="acct-orders">${out.orders.map(orderCard).join('')}</div>`;
    const want = new URLSearchParams(location.search).get('order');
    const open = want && $(`[data-order="${CSS.escape(want)}"]`, panel);
    if (open) { open.open = true; open.scrollIntoView({ block: 'start' }); }
    panel.addEventListener('click', (e) => {
      const copy = e.target.closest('[data-copy]');
      if (copy) {
        navigator.clipboard.writeText(copy.dataset.copy).then(() => toast('Copied'), () => {});
        return;
      }
      const ask = e.target.closest('[data-ask]');
      if (ask && window.DSSupport) window.DSSupport.ask(`About my order ${ask.dataset.ask}: `);
    });
  }

  const STEPS = [['placed', 'Ordered'], ['paid', 'Paid'], ['shipped', 'Shipped'], ['delivered', 'Delivered']];
  function orderCard(o) {
    const n = o.items.reduce((s, i) => s + i.qty, 0);
    const thumbs = o.items.slice(0, 3).map((i) => (i.image ? `<img src="${esc(i.image)}" alt="" loading="lazy" />` : '<span></span>')).join('');
    const reached = { placed: o.placed, paid: o.paid, shipped: o.shipped, delivered: o.delivered };
    const timeline = o.state === 'cancelled'
      ? '<p class="acct-cancelled">This order was cancelled.</p>'
      : `<ol class="acct-steps">${STEPS.map(([k, label]) => `<li class="${reached[k] ? 'is-done' : ''}"><span class="acct-dot" aria-hidden="true">${reached[k] ? ICON.check : ''}</span><span>${label}</span>${reached[k] ? `<small>${day(reached[k])}</small>` : ''}</li>`).join('')}</ol>`;
    let pay = '';
    if (o.state === 'checking') {
      pay = '<div class="acct-box is-note"><strong>Please don’t pay yet.</strong><p>We’re checking the import rules for your country and will email you before asking for payment.</p></div>';
    } else if (o.payment && o.payment.method === 'bank') {
      pay = `<div class="acct-box"><strong>Pay ${usd(o.total)} by bank transfer by ${day(o.payment.due)}</strong>
        <p>Use <b>${esc(o.payment.reference)}</b> as the payment reference. We ship once the payment has cleared.</p>
        ${o.payment.details ? `<pre class="acct-bank">${esc(o.payment.details)}</pre><button type="button" class="acct-copy" data-copy="${esc(o.payment.details)}">${ICON.copy}<span>Copy bank details</span></button>` : ''}</div>`;
    } else if (o.payment && o.payment.method === 'card') {
      pay = o.payment.link
        ? `<div class="acct-box"><strong>Pay ${usd(o.total)} by card by ${day(o.payment.due)}</strong><p>Your secure Payoneer payment request is ready.</p><a class="btn btn-dark" href="${esc(o.payment.link)}" target="_blank" rel="noopener">Pay by card</a></div>`
        : `<div class="acct-box"><strong>Your card payment request is on its way</strong><p>We’ll email you a secure Payoneer payment request for ${usd(o.total)} shortly.</p></div>`;
    }
    const track = o.tracking
      ? `<div class="acct-box"><strong>On its way${o.carrier ? ` with ${esc(o.carrier)}` : ''}</strong><p>Tracking number <b>${esc(o.tracking)}</b> <button type="button" class="acct-copy is-inline" data-copy="${esc(o.tracking)}">${ICON.copy}<span>Copy</span></button></p></div>`
      : '';
    return `
      <details class="acct-order" data-order="${esc(o.number)}">
        <summary>
          <span class="acct-thumbs">${thumbs}</span>
          <span class="acct-order-main"><strong>${esc(o.number)}</strong><small>${day(o.placed)} · ${n} ${n === 1 ? 'piece' : 'pieces'}</small></span>
          <span class="acct-status is-${esc(o.state)}">${esc(o.status)}</span>
          <span class="acct-total">${usd(o.total)}</span>
        </summary>
        <div class="acct-order-body">
          ${timeline}
          ${pay}${track}
          ${o.notes.length ? `<div class="acct-box is-note">${o.notes.map((t) => `<p>${esc(t)}</p>`).join('')}</div>` : ''}
          <ul class="acct-items">${o.items.map((i) => `
            <li>${i.image ? `<img src="${esc(i.image)}" alt="" loading="lazy" />` : '<span class="acct-noimg"></span>'}
              <span class="acct-item-name">${i.link ? `<a href="${esc(i.link)}">${esc(i.name)}</a>` : esc(i.name)}${i.option ? `<small>${esc(i.option)}</small>` : ''}</span>
              <span class="acct-item-qty">${i.qty} × ${usd(i.unit)}</span></li>`).join('')}</ul>
          <dl class="acct-sums"><div><dt>Subtotal</dt><dd>${usd(o.subtotal)}</dd></div><div><dt>Shipping</dt><dd>${o.shipping ? usd(o.shipping) : 'Free'}</dd></div><div class="is-total"><dt>Total</dt><dd>${usd(o.total)}</dd></div></dl>
          <div class="acct-order-foot">
            <div><p class="acct-label">Delivery address</p><p class="acct-address">${o.address.map(esc).join('<br />')}</p></div>
            <button type="button" class="btn btn-outline-dark" data-ask="${esc(o.number)}">Ask about this order</button>
          </div>
        </div>
      </details>`;
  }

  /* Conversations */
  async function loadThreads() {
    const panel = $('[data-panel="messages"]', root);
    loading(panel);
    const out = await api('/api/account/threads');
    if (signedOutAgain(out)) return;
    if (!out.ok) { panel.innerHTML = `<p class="account-empty">${esc(out.error || 'Couldn’t load your conversations.')}</p>`; return; }
    count('messages', out.threads.length);
    if (!out.threads.length) {
      panel.innerHTML = `<div class="account-empty">${ICON.chat}<h2>No conversations yet</h2><p>Questions about a blade, shipping or an order? A real person from our team replies.</p><button type="button" class="btn btn-dark" data-chat>Start a chat</button></div>`;
    } else {
      panel.innerHTML = `<ul class="acct-threads">${out.threads.map((t) => `
        <li><button type="button" data-thread="${esc(t.token)}">
          <span class="acct-thread-icon">${ICON.chat}</span>
          <span class="acct-thread-main"><strong>Conversation ${esc(t.number)}</strong><small>${esc(t.last || 'No messages yet')}</small></span>
          <span class="acct-thread-date">${day(t.updated)}</span>
        </button></li>`).join('')}</ul>
        <p class="account-hint">Replies also reach you by email, and you can answer from there.</p>`;
    }
    panel.addEventListener('click', (e) => {
      const b = e.target.closest('[data-thread]');
      if (b && window.DSSupport) window.DSSupport.openThread(b.dataset.thread);
      if (e.target.closest('[data-chat]') && window.DSSupport) window.DSSupport.open();
    });
  }

  /* Addresses */
  let addresses = [];
  async function loadAddresses() {
    const panel = $('[data-panel="addresses"]', root);
    if (!panel.dataset.loaded) loading(panel);
    const [out, cfg] = await Promise.all([api('/api/account/addresses'), countries ? null : api('/api/checkout-config')]);
    if (cfg && cfg.countries) countries = cfg;
    if (signedOutAgain(out)) return;
    if (!out.ok) { panel.innerHTML = `<p class="account-empty">${esc(out.error || 'Couldn’t load your addresses.')}</p>`; return; }
    panel.dataset.loaded = '1';
    addresses = out.addresses;
    drawAddresses();
  }

  function drawAddresses() {
    const panel = $('[data-panel="addresses"]', root);
    count('addresses', addresses.length);
    panel.innerHTML = `
      <div class="acct-addresses">
        ${addresses.map((a) => `
          <article class="acct-address-card${a.default ? ' is-default' : ''}">
            ${a.default ? '<span class="acct-default">Default</span>' : ''}
            <p class="acct-address"><strong>${esc(a.name)}</strong><br />${[a.address1, a.address2, [a.city, a.region, a.postcode].filter(Boolean).join(' '), a.country].filter(Boolean).map(esc).join('<br />')}${a.phone ? `<br /><span class="acct-phone">${esc(a.phone)}</span>` : ''}</p>
            <div class="acct-address-actions">
              <button type="button" class="signin-link" data-edit="${a.id}">Edit</button>
              ${a.default ? '' : `<button type="button" class="signin-link" data-default="${a.id}">Make default</button>`}
              <button type="button" class="signin-link is-danger" data-delete="${a.id}">Delete</button>
            </div>
          </article>`).join('')}
        <button type="button" class="acct-address-add" data-add>${ICON.pin}<span>Add an address</span></button>
      </div>
      ${addresses.length ? '' : '<p class="account-hint">Save an address and checkout fills it in for you.</p>'}`;
    panel.onclick = async (e) => {
      const t = e.target;
      if (t.closest('[data-add]')) return addressForm(null);
      const ed = t.closest('[data-edit]');
      if (ed) return addressForm(addresses.find((a) => String(a.id) === ed.dataset.edit));
      const df = t.closest('[data-default]');
      if (df) {
        const a = addresses.find((x) => String(x.id) === df.dataset.default);
        const out = await api(`/api/account/addresses/${a.id}`, { ...a, default: true });
        if (out.ok) { addresses = out.addresses; drawAddresses(); toast('Default address changed'); }
        return;
      }
      const del = t.closest('[data-delete]');
      if (del) {
        if (del.dataset.sure !== '1') { del.dataset.sure = '1'; del.textContent = 'Tap again to delete'; setTimeout(() => { if (del.isConnected) { del.dataset.sure = ''; del.textContent = 'Delete'; } }, 4000); return; }
        const out = await api(`/api/account/addresses/${del.dataset.delete}/delete`, {});
        if (out.ok) { addresses = out.addresses; drawAddresses(); toast('Address deleted'); }
      }
    };
  }

  function countryOptions(selected) {
    if (!countries) return `<option value="${esc(selected || '')}">${esc(selected || 'Choose…')}</option>`;
    const main = countries.mainCountries || [];
    const rest = (countries.countries || []).filter((c) => !main.includes(c));
    const opt = (c) => `<option${c === selected ? ' selected' : ''}>${esc(c)}</option>`;
    return `<option value="">Choose your country</option><optgroup label="Most orders">${main.map(opt).join('')}</optgroup><optgroup label="All countries">${rest.map(opt).join('')}</optgroup>`;
  }

  function addressForm(a) {
    const panel = $('[data-panel="addresses"]', root);
    const v = a || { name: state.me.name || '', phone: state.me.phone || '', country: '', region: '' };
    panel.innerHTML = `
      <form class="acct-form" novalidate>
        <h2 class="acct-form-title">${a ? 'Edit address' : 'Add an address'}</h2>
        <div class="acct-grid">
          <label class="acct-field"><span>Full name</span><input name="name" autocomplete="name" maxlength="80" value="${esc(v.name)}" /></label>
          <label class="acct-field"><span>Phone <small>for the courier</small></span><input name="phone" type="tel" autocomplete="tel" maxlength="40" value="${esc(v.phone || '')}" /></label>
          <label class="acct-field is-wide"><span>Country</span><select name="country" autocomplete="country-name">${countryOptions(v.country)}</select></label>
          <label class="acct-field is-wide"><span>Address</span><input name="address1" autocomplete="address-line1" maxlength="120" value="${esc(v.address1 || '')}" /></label>
          <label class="acct-field is-wide"><span>Apartment, suite <small>optional</small></span><input name="address2" autocomplete="address-line2" maxlength="120" value="${esc(v.address2 || '')}" /></label>
          <label class="acct-field"><span>City</span><input name="city" autocomplete="address-level2" maxlength="80" value="${esc(v.city || '')}" /></label>
          <label class="acct-field" data-region><span>State / region <small>optional</small></span><input name="region" autocomplete="address-level1" maxlength="80" value="${esc(v.region || '')}" /></label>
          <label class="acct-field"><span>Postcode</span><input name="postcode" autocomplete="postal-code" maxlength="20" value="${esc(v.postcode || '')}" /></label>
        </div>
        <label class="acct-check"><input type="checkbox" name="default"${(a && a.default) || !addresses.length ? ' checked' : ''} /> <span>Use as my default address</span></label>
        <p class="signin-error" role="alert" hidden></p>
        <div class="acct-form-actions"><button type="submit" class="btn btn-dark">${a ? 'Save changes' : 'Save address'}</button><button type="button" class="btn btn-outline-dark" data-cancel>Cancel</button></div>
      </form>`;
    const f = $('form', panel);
    const regionBox = $('[data-region]', f);
    const setRegion = () => {
      const au = f.country.value === 'Australia' && countries && countries.auStates;
      const cur = (f.region && f.region.value) || v.region || '';
      regionBox.innerHTML = au
        ? `<span>State or territory</span><select name="region"><option value="">Choose…</option>${countries.auStates.map((s) => `<option${s === cur ? ' selected' : ''}>${esc(s)}</option>`).join('')}</select>`
        : `<span>State / region <small>optional</small></span><input name="region" autocomplete="address-level1" maxlength="80" value="${esc(cur)}" />`;
    };
    setRegion();
    f.country.addEventListener('change', setRegion);
    $('[data-cancel]', f).addEventListener('click', drawAddresses);
    f.elements.name.focus();
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(f));
      data.default = f.elements.default.checked;
      const b = $('button[type=submit]', f);
      b.disabled = true;
      const out = await api(a ? `/api/account/addresses/${a.id}` : '/api/account/addresses', data);
      b.disabled = false;
      const p = $('.signin-error', f);
      $$('[aria-invalid]', f).forEach((i) => i.removeAttribute('aria-invalid'));
      if (!out.ok) {
        p.textContent = out.error || 'Couldn’t save it. Please try again.';
        p.hidden = false;
        (out.fields || []).forEach((k) => { const i = f.elements[k]; if (i) i.setAttribute('aria-invalid', 'true'); });
        const first = out.fields && f.elements[out.fields[0]];
        if (first) first.focus();
        return;
      }
      addresses = out.addresses;
      drawAddresses();
      toast(a ? 'Address saved' : 'Address added');
    });
  }

  /* Details */
  function renderDetails() {
    const panel = $('[data-panel="details"]', root);
    const me = state.me;
    panel.innerHTML = `
      <form class="acct-form acct-details" novalidate>
        <h2 class="acct-form-title">Your details</h2>
        <div class="acct-grid">
          <label class="acct-field"><span>Name</span><input name="name" autocomplete="name" maxlength="80" value="${esc(me.name || '')}" /></label>
          <label class="acct-field"><span>Phone <small>optional</small></span><input name="phone" type="tel" autocomplete="tel" maxlength="40" value="${esc(me.phone || '')}" /></label>
          <label class="acct-field is-wide"><span>Email</span><input value="${esc(me.email)}" disabled /><small class="acct-help">You sign in with this email. To use another one, sign out and sign in with it.</small></label>
        </div>
        <p class="signin-error" role="alert" hidden></p>
        <div class="acct-form-actions"><button type="submit" class="btn btn-dark">Save</button></div>
      </form>
      <div class="acct-form acct-security">
        <h2 class="acct-form-title">Signing in</h2>
        <p class="account-hint">You stay signed in on this device for 180 days, until you sign out. There is no password: each time, we email you a code.</p>
        <div class="acct-form-actions">
          <button type="button" class="btn btn-outline-dark" data-out="this">Sign out on this device</button>
          <button type="button" class="btn btn-outline-dark" data-out="all">Sign out of all devices</button>
        </div>
      </div>`;
    const f = $('.acct-details', panel);
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const out = await api('/api/account/profile', { name: f.elements.name.value, phone: f.elements.phone.value });
      const p = $('.signin-error', f);
      if (!out.ok) { p.textContent = out.error; p.hidden = false; return; }
      p.hidden = true;
      state.me = out.me;
      paintHeader();
      emit();
      $('.display-md', root).textContent = state.me.first ? `Hello, ${state.me.first}` : 'Hello';
      toast('Saved');
    });
    $$('[data-out]', panel).forEach((b) => b.addEventListener('click', async () => {
      if (b.dataset.out === 'all' && b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = 'Tap again to sign out everywhere'; return; }
      await signOut(b.dataset.out === 'all');
      renderAccount();
    }));
  }

  window.addEventListener('hashchange', () => { if (root && state.me.signedIn) showTab(tabFromHash()); });
  // Signed in or out somewhere else (the chat, another tab's window): the page follows
  document.addEventListener('ds:account', (e) => {
    if (!root || pageSignedIn === null) return;
    const now = !!(e.detail && e.detail.signedIn);
    if (now === pageSignedIn) return;
    if (now && root.querySelector('.signin.is-inline')) return; // the page's own sign-in finishes and redraws itself
    renderAccount();
  });

  /* ------------------------------------------------------------------ start */
  refresh().then(() => { if (root) renderAccount(); });
})();
