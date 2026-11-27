/**
 * DRAGON SPRING SWORDS, chat with a person.
 *
 * Opens from HaloChime's "Talk to a person" button (main.js registers it with Halochime.setSwitch),
 * from any [data-support-open] link, or from the link in our emails (?chat=<token>). Messages go to
 * the admin's Support inbox. Replies appear here while the visitor is on the site, and are emailed
 * otherwise; the visitor can answer by email or here. It all stays one conversation.
 */
(function () {
  'use strict';

  const C = window.DRAGONSPRING || {};
  const S = C.settings || {};
  const KEY = 'dragonspring:support';
  const SEEN = 'dragonspring:support-seen';
  const esc = (s) =>
    String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (_) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (_) {} },
    del(k) { try { localStorage.removeItem(k); } catch (_) {} },
  };
  const hasHalo = !!(S.chat_ai === '1' && S.chat_key && /^https:\/\//.test(S.chat_src || ''));

  let token = store.get(KEY);
  let openOnLoad = false;
  const params = new URLSearchParams(location.search);
  if (params.get('chat')) {
    token = params.get('chat').slice(0, 64);
    store.set(KEY, token);
    params.delete('chat');
    const q = params.toString();
    history.replaceState(null, '', location.pathname + (q ? '?' + q : '') + location.hash);
    openOnLoad = true;
  }

  let panel, body, compose, launcher, timer, checkTimer, closeTimer;
  let isOpen = false;
  let stick = true; // keep the conversation on its latest message (until the visitor scrolls up to read)
  let shown = -1;
  let teamCount = 0;
  let lastMsgs = []; // the conversation as last drawn: which pieces are already tagged in it
  // Signed in to the store (account.js): the chat knows who they are, so no name/email card and no code
  const account = () => (window.DSAccount && window.DSAccount.me) || { signedIn: false };
  let mineAsked = false;
  let tagOff = ''; // a piece (slug|option) not to tag again on this page: untagged with the cross, or just sent

  const fmt = (ts) => {
    const d = new Date(ts * 1000);
    const today = new Date().toDateString() === d.toDateString();
    try {
      return new Intl.DateTimeFormat(undefined, today ? { hour: '2-digit', minute: '2-digit' } : { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(d);
    } catch (_) {
      return d.toLocaleString();
    }
  };

  const LOGO = '/assets/img/brand/logo-mark.webp';
  const avatar = (cls = 'support-avatar') => `<img class="${cls}" src="${LOGO}" alt="" width="36" height="36" decoding="async" />`;
  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const phone = () => window.matchMedia('(max-width: 599px), (max-height: 540px)').matches;
  const ICON = {
    close: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>',
    send: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    chat: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z"/></svg>',
    // speech bubble with "typing" dots: what people recognise as a chat button
    bubble: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" aria-hidden="true"><path d="M12 4c-4.7 0-8.5 3.1-8.5 7 0 2 1 3.8 2.6 5.1L5.4 20l4.3-1.8c.7.2 1.5.3 2.3.3 4.7 0 8.5-3.1 8.5-7s-3.8-7-8.5-7z"/><circle cx="8.5" cy="11" r="1.05" fill="currentColor" stroke="none"/><circle cx="12" cy="11" r="1.05" fill="currentColor" stroke="none"/><circle cx="15.5" cy="11" r="1.05" fill="currentColor" stroke="none"/></svg>',
    clip: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5l-8.6 8.6a5 5 0 0 1-7.1-7.1l8.6-8.6a3.3 3.3 0 0 1 4.7 4.7l-8.6 8.6a1.7 1.7 0 0 1-2.4-2.4l7.9-7.9"/></svg>',
    doc: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8l-5-5z"/><path d="M14 3v5h5"/></svg>',
    clock: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
    x: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    // one tick under the visitor's own messages: sent (they never see whether we've read it)
    tick: '<svg viewBox="0 0 16 12" width="14" height="11" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 6.5l3.6 3.6L14 1.8"/></svg>',
  };
  // Phones: no automatic focus, so the keyboard doesn't cover the panel the moment it opens.
  const focusSoon = (el) => {
    if (el && window.matchMedia('(pointer: fine)').matches) setTimeout(() => el.focus({ preventScroll: true }), 60);
  };
  // Message boxes grow with the text, up to a limit.
  const autoGrow = (ta, max = 128) => {
    const fit = () => {
      ta.style.height = '';
      if (!ta.value || !ta.scrollHeight) return; // empty or hidden: keep the size from the stylesheet
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight + 2, max) + 'px'; // + the 1px borders
    };
    ta.addEventListener('input', fit);
  };

  /* The piece on screen. On a product page the chat tags it (with the option chosen) on the next message,
     shown above the message box with a cross to untag it. Sent, it becomes a card in the conversation. */
  function pieceNow() {
    const m = location.pathname.match(/^\/product\/([a-z0-9-]+)/);
    if (!m) return null;
    let p = null;
    try { p = window.DSProductNow ? window.DSProductNow() : null; } catch (_) { p = null; }
    if (p && p.slug === m[1]) return { slug: p.slug, name: p.name || '', image: p.image || '', option: p.option || '' };
    const h = document.querySelector('#product h1');
    const img = document.querySelector('#gallery-main img');
    return h ? { slug: m[1], name: h.textContent.trim(), image: img ? img.currentSrc || img.src : '', option: '' } : null;
  }
  const pieceKey = (p) => p.slug + '|' + (p.option || '');
  function pieceToTag() {
    const p = pieceNow();
    if (!p || !p.name || tagOff === pieceKey(p)) return null;
    const said = lastMsgs.some((m) => m.product && m.product.link === '/product/' + p.slug && (m.product.option || '') === p.option);
    return said ? null : p; // already in this conversation: no need to tag it again
  }
  function updateTag() {
    if (!compose) return;
    const el = compose.querySelector('.support-tag');
    const p = compose.hidden ? null : pieceToTag();
    compose.classList.toggle('has-tag', !!p);
    el.hidden = !p;
    if (!p || el.dataset.key === pieceKey(p)) return;
    el.dataset.key = pieceKey(p);
    el.innerHTML = `${p.image ? `<img src="${esc(p.image)}" alt="" />` : ''}<span class="support-tag-text"><small>Asking about</small><strong>${esc(p.name)}${p.option ? ` · ${esc(p.option)}` : ''}</strong></span><button type="button" class="support-tag-x" aria-label="Don’t tag this piece">${ICON.x}</button>`;
  }
  // what goes with the next message: the tagged piece, if it's still tagged
  const tagData = () => {
    const p = compose && !compose.querySelector('.support-tag').hidden ? pieceToTag() : null;
    return p ? { product: p.slug, option: p.option } : {};
  };
  const tagSent = (tag) => { if (tag.product) { tagOff = tag.product + '|' + (tag.option || ''); updateTag(); } };

  function build() {
    if (panel) return;
    panel = document.createElement('div');
    panel.className = 'support';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Chat with our team');
    panel.hidden = true;
    panel.innerHTML = `
      <div class="support-panel">
        <div class="support-head">
          ${avatar('support-head-avatar')}
          <div class="support-head-text">
            <p class="support-title">Dragon Spring Swords</p>
            <p class="support-sub">A real person replies, here and by email</p>
          </div>
          <button type="button" class="support-close" aria-label="Close chat">${ICON.close}</button>
        </div>
        <div class="support-body" aria-live="polite"></div>
      </div>
      <form class="support-compose" hidden>
        <div class="support-tag" hidden></div>
        <label class="sr-only" for="support-text">Message</label>
        <textarea id="support-text" rows="1" maxlength="2000" placeholder="Write a message" required></textarea>
        <label class="support-attach" title="Send a photo or file">${ICON.clip}<span class="sr-only">Send a photo or file</span><input type="file" accept="image/*,.heic,.heif,.pdf,.doc,.docx,.xls,.xlsx,.odt,.ods,.rtf,.txt,.csv" hidden /></label>
        <button type="submit" class="support-send" aria-label="Send">${ICON.send}</button>
      </form>`;
    document.body.appendChild(panel);
    body = panel.querySelector('.support-body');
    compose = panel.querySelector('.support-compose');
    body.addEventListener('scroll', () => { stick = body.scrollHeight - body.scrollTop - body.clientHeight < 48; }, { passive: true });
    body.addEventListener('load', () => { if (stick) toLatest(); }, true); // a photo arrived and pushed the latest down
    body.addEventListener('click', (e) => {
      const a = e.target.closest('.support-photo');
      if (!a || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // modified clicks: a new tab as before
      e.preventDefault();
      const img = a.querySelector('img');
      openPhoto(a.href, img ? img.alt : '');
    });
    panel.querySelector('.support-close').addEventListener('click', close);
    panel.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
    const ta = compose.querySelector('textarea');
    autoGrow(ta);
    const sendBtn = compose.querySelector('.support-send');
    ['mousedown', 'pointerdown', 'touchstart'].forEach((ev) =>
      sendBtn.addEventListener(ev, (e) => { if (document.activeElement === ta) e.preventDefault(); }, { passive: false }));
    sendBtn.addEventListener('touchend', (e) => {
      // touchstart's preventDefault also stops the click, so send from here on touch screens
      if (document.activeElement === ta) { e.preventDefault(); compose.requestSubmit(); }
    });
    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); compose.requestSubmit(); }
    });
    compose.querySelector('.support-tag').addEventListener('click', (e) => {
      if (!e.target.closest('.support-tag-x')) return;
      const p = pieceNow();
      tagOff = p ? pieceKey(p) : '';
      updateTag();
      ta.focus({ preventScroll: true });
    });
    // a different option chosen on the product page while the chat is open: the tag follows it
    document.addEventListener('change', (e) => { if (e.target.matches && e.target.matches('[data-option-radio]')) updateTag(); });
    const fileInput = compose.querySelector('.support-attach input');
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file || !token) return;
      if (file.size > 10 * 1024 * 1024) { fileInput.value = ''; return note('That file is over 10 MB. Please send a smaller one.'); }
      const fd = new FormData();
      fd.append('token', token);
      fd.append('file', file);
      fd.append('caption', ta.value.trim());
      note('Sending ' + file.name + '…', true);
      stick = true;
      toLatest();
      try {
        const res = await fetch('/api/support/upload', { method: 'POST', body: fd });
        const out = await res.json().catch(() => ({}));
        if (!res.ok || !out.ok) note(out.error || 'Couldn’t send that file. Please try again.');
        else { ta.value = ''; ta.style.height = ''; note(''); refresh(); }
      } catch (_) {
        note('No connection. The file wasn’t sent.');
      }
      fileInput.value = '';
    });
    compose.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = ta.value.trim();
      if (!text) return;
      if (!token) return startChat(text);
      stick = true; // sending takes you down to the newest message, even if you'd scrolled up to read
      toLatest();
      const kept = document.activeElement === ta;
      const tag = tagData();
      ta.value = '';
      ta.style.height = '';
      if (kept) ta.focus({ preventScroll: true }); // keyboard stays up for the next message
      const out = await api('/api/support/message', { token, message: text, ...tag });
      if (out && out.ok) { tagSent(tag); refresh(); }
      else {
        ta.value = text;
        note((out && out.error) || 'Couldn’t send just now. Please try again.');
      }
    });
  }

  async function api(url, data) {
    try {
      const res = await fetch(url, data
        ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }
        : { headers: { Accept: 'application/json' } });
      const out = await res.json().catch(() => ({}));
      out.status = res.status;
      return out;
    } catch (_) {
      return null;
    }
  }

  function note(text) {
    let el = panel.querySelector(':scope > .support-error'); // the one above the message box, not a form's own
    if (!el) {
      el = document.createElement('p');
      el.className = 'support-error';
      el.setAttribute('role', 'alert');
      compose.before(el);
    }
    el.textContent = text;
    setTimeout(() => el.remove(), 6000);
  }

  // Words the topic buttons put in the message box: on their own they are not a message yet.
  const STARTERS = ['I have a question about', 'Can you ship to', 'About my order:'];
  const onlyStarter = (text) => STARTERS.some((s) => text.replace(/\s+$/, '') === s);

  // Starting: the name and email from the card above. From its Start chat button (fromCard) that's all it takes, and
  // anything already typed below stays in the box to send; from the send button the message goes with it.
  async function startChat(text, fromCard) {
    const me = account();
    const f = body.querySelector('.support-details');
    if (!f && !me.signedIn) return;
    const field = (n) => f.querySelector(`[name=${n}]`);
    const err = f && f.querySelector('.support-error');
    const fail = (m, name) => {
      if (!f) return note(m);
      err.textContent = m;
      err.hidden = false;
      if (name) {
        field(name).classList.add('is-bad');
        field(name).focus({ preventScroll: true });
      }
      f.scrollIntoView({ block: 'nearest', behavior: reduced() ? 'auto' : 'smooth' });
    };
    const d = f
      ? { name: field('name').value.trim(), email: field('email').value.trim(), website: field('website').value, message: fromCard ? '' : text }
      : { name: me.name || '', email: me.email, website: '', message: text }; // signed in: the account speaks
    if (!fromCard && onlyStarter(text)) {
      const ta = compose.querySelector('textarea');
      ta.focus({ preventScroll: true });
      ta.setSelectionRange(ta.value.length, ta.value.length);
      return note('Please finish your message after “' + text.replace(/\s+$/, '') + '”, then send it.');
    }
    if (f) {
      if (!d.name) return fail('Please add your name, so we know who we’re talking to.', 'name');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email)) return fail('Please add your email, so we can reply even if you leave.', 'email');
      err.hidden = true;
    }
    const tag = d.message ? tagData() : {};
    const btn = f && f.querySelector('.support-submit');
    compose.classList.add('is-busy');
    if (btn) btn.disabled = true;
    const out = await api('/api/support/start', { ...d, ...tag, page: location.href, device: store.get(KEY) || '' });
    compose.classList.remove('is-busy');
    if (btn) btn.disabled = false;
    if (!out || !out.ok) return fail((out && out.error) || 'Couldn’t reach us just now. Please try again.');
    const ta = compose.querySelector('textarea');
    if (d.message) {
      ta.value = '';
      ta.style.height = '';
      tagSent(tag);
    }
    if (out.needsCode) return renderCode(out, { ...d, ...tag });
    token = out.token;
    store.set(KEY, token);
    renderThread(out);
    updateLauncher();
    if (fromCard) focusSoon(ta);
  }

  const welcome = (name) => `
      <div class="support-msg is-team is-first is-last is-new support-welcome">
        <p class="support-who">${avatar('support-who-avatar')}Dragon Spring team</p>
        <div class="support-bubble">${name ? `Hi ${esc(name.split(' ')[0])}! ` : 'Hello! '}Ask us anything about a blade, an order or delivery. A real person from our team replies here, and by email if you’ve left.</div>
      </div>
      <div class="support-topics" role="group" aria-label="Start with a topic">
        <button type="button" style="--i:0" data-topic="I have a question about ">A question about a blade</button>
        <button type="button" style="--i:1" data-topic="Can you ship to ">Shipping to my country</button>
        <button type="button" style="--i:2" data-topic="About my order: ">My order</button>
      </div>`;
  // a topic button puts its opening words in the message box (never over the visitor's own words)
  function wireTopics() {
    const ta = compose.querySelector('textarea');
    body.querySelectorAll('[data-topic]').forEach((b) => b.addEventListener('click', () => {
      body.querySelectorAll('[data-topic]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      const starters = [...body.querySelectorAll('[data-topic]')].map((x) => x.dataset.topic);
      if (!ta.value.trim() || starters.includes(ta.value)) ta.value = b.dataset.topic;
      ta.dispatchEvent(new Event('input'));
      ta.focus({ preventScroll: true });
      ta.setSelectionRange(ta.value.length, ta.value.length);
    }));
  }

  function renderStart() {
    compose.hidden = false;
    compose.querySelector('.support-attach').hidden = true;
    const ta = compose.querySelector('textarea');
    ta.placeholder = 'Write your message';
    shown = -1;
    if (account().signedIn) { // signed in: straight to writing, greeted by name
      body.innerHTML = welcome(account().name || '');
      wireTopics();
      updateTag();
      focusSoon(ta);
      return;
    }
    body.innerHTML = `${welcome('')}
      <form class="support-details" novalidate>
        <p class="support-details-title">Your name and email, so we can reply</p>
        <div class="support-fields">
          <label><span class="sr-only">Your name</span><input name="name" autocomplete="name" maxlength="80" placeholder="Your name" required /></label>
          <label><span class="sr-only">Email</span><input name="email" type="email" autocomplete="email" inputmode="email" maxlength="120" placeholder="Email" required /></label>
        </div>
        <label class="hp" aria-hidden="true">Website <input name="website" tabindex="-1" autocomplete="off" /></label>
        <p class="support-error" role="alert" hidden></p>
        <button type="submit" class="support-submit"><span>Start chat</span>${ICON.arrow}</button>
        <p class="support-fine">Or write your message below and send it. Have an account? <button type="button" class="support-link" data-signin>Sign in</button> · <a href="/page/privacy" target="_blank">Privacy</a></p>
      </form>`;
    const f = body.querySelector('.support-details');
    f.querySelector('[data-signin]').addEventListener('click', () => { if (window.DSAccount) window.DSAccount.signIn(); });
    f.querySelectorAll('input').forEach((i) => i.addEventListener('input', () => i.classList.remove('is-bad')));
    // Start chat (or Enter in the email box) opens the conversation with the name and email alone; whatever is in the
    // message box stays there to send. Enter in the name box moves on to the email.
    f.addEventListener('submit', (e) => { e.preventDefault(); startChat(ta.value.trim(), true); });
    f.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' || e.isComposing || e.target.name !== 'name') return;
      e.preventDefault();
      f.querySelector('input[name=email]').focus({ preventScroll: true });
    });
    wireTopics();
    updateTag();
    focusSoon(f.querySelector('input[name=name]'));
  }

  /* Returning visitor on another device: their email already has a conversation. We email a code;
     entering it opens that conversation (their new message is added to it). */
  function renderCode(info, form) {
    compose.hidden = true;
    updateTag();
    shown = -1;
    body.innerHTML = `
      <div class="support-intro">
        <p><strong>Welcome back${form.name ? ', ' + esc(form.name.split(' ')[0]) : ''}.</strong> We found your earlier conversation.</p>
        <p>To keep it private, we’ve emailed a 6-digit code to <strong>${esc(info.hint)}</strong>. Enter it to carry on where you left off.</p>
        ${info.note ? `<p>${esc(info.note)}</p>` : ''}
      </div>
      ${form.message ? `<div class="support-pending">
        <span>Sent as soon as the code is checked</span>
        <p>${esc(form.message)}</p>
        <button type="button" class="support-link" data-act="edit">Change my message</button>
      </div>` : ''}
      <form class="support-start support-card support-code" novalidate>
        <label>Code from the email <input name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" required /></label>
        <p class="support-error" role="alert" hidden></p>
        <button type="submit" class="support-submit"><span>${form.message ? 'Check the code and send' : 'Continue my conversation'}</span>${ICON.arrow}</button>
        <p class="support-fine">
          <button type="button" class="support-link" data-act="resend">Send a new code</button> ·
          <button type="button" class="support-link" data-act="new">Start a new conversation instead</button>
        </p>
      </form>`;
    const f = body.querySelector('.support-code');
    const err = f.querySelector('.support-error');
    const say = (m, ok) => { err.textContent = m; err.hidden = false; err.classList.toggle('is-ok', !!ok); };
    const input = f.querySelector('input[name=code]');
    input.addEventListener('input', () => { input.value = input.value.replace(/\D/g, '').slice(0, 6); err.hidden = true; });
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (input.value.length !== 6) return say('Enter the 6 digits from the email.');
      const btn = f.querySelector('button[type=submit]');
      btn.disabled = true;
      const out = await api('/api/support/verify', { handle: info.handle, code: input.value });
      btn.disabled = false;
      if (!out || !out.ok) return say((out && out.error) || 'Couldn’t check the code just now. Please try again.');
      token = out.token;
      store.set(KEY, token);
      renderThread(out);
      updateLauncher();
      if (window.DSAccount) window.DSAccount.refresh(); // the code proved the email: the store is signed in too
    });
    const edit = body.querySelector('[data-act=edit]');
    if (edit) edit.addEventListener('click', () => {
      // back to the start, everything filled in as they left it; sending again updates the waiting message
      renderStart();
      const card = body.querySelector('.support-details');
      card.querySelector('[name=name]').value = form.name || '';
      card.querySelector('[name=email]').value = form.email || '';
      const ta = compose.querySelector('textarea');
      ta.value = form.message || '';
      ta.dispatchEvent(new Event('input'));
      ta.focus({ preventScroll: true });
      ta.setSelectionRange(ta.value.length, ta.value.length);
    });
    f.querySelector('[data-act=resend]').addEventListener('click', async () => {
      const out = await api('/api/support/resend', { handle: info.handle });
      if (out && out.ok) { input.value = ''; say('A new code is on its way to ' + out.hint + '.', true); }
      else say((out && out.error) || 'Couldn’t send a new code just now.');
    });
    f.querySelector('[data-act=new]').addEventListener('click', async () => {
      const out = await api('/api/support/start', { ...form, page: location.href, new: true });
      if (!out || !out.ok) return say((out && out.error) || 'Couldn’t start a new conversation just now.');
      token = out.token;
      store.set(KEY, token);
      renderThread(out);
      updateLauncher();
    });
    focusSoon(input);
  }

  function renderThread(d) {
    compose.hidden = false;
    compose.querySelector('.support-attach').hidden = false;
    compose.querySelector('textarea').placeholder = 'Write a message';
    const msgs = d.messages || [];
    lastMsgs = msgs;
    updateTag();
    teamCount = msgs.filter((m) => m.from === 'team').length;
    store.set(SEEN, String(teamCount));
    if (msgs.length === shown) return;
    const before = shown;
    shown = msgs.length;
    if (!msgs.length) { // opened with name and email only: nothing said yet
      body.innerHTML = welcome(d.name || '');
      wireTopics();
      return;
    }
    const near = body.scrollHeight - body.scrollTop - body.clientHeight < 80;
    body.innerHTML = msgs.map((m, i) => {
      const prev = msgs[i - 1];
      const next = msgs[i + 1];
      const first = !prev || prev.from !== m.from; // who is speaking: above the first of a run
      const last = !next || next.from !== m.from; // the time: under the last of a run
      const fresh = before > 0 && i >= before; // new since the last look: slides in
      const who = m.from === 'team' ? 'Dragon Spring team' : 'Dragon Spring · automatic message';
      return `
        <div class="support-msg is-${esc(m.from)}${first ? ' is-first' : ''}${last ? ' is-last' : ''}${fresh ? ' is-new' : ''}">
          ${first && m.from !== 'you' ? `<p class="support-who">${avatar('support-who-avatar')}${who}</p>` : ''}
          ${m.file ? (m.file.kind === 'image'
            ? `<a class="support-photo" href="${esc(m.file.url)}?token=${encodeURIComponent(token)}" target="_blank" rel="noopener"><img src="${esc(m.file.url)}?token=${encodeURIComponent(token)}" alt="${esc(m.file.name)}" loading="lazy" /></a>`
            : `<a class="support-file" href="${esc(m.file.url)}?token=${encodeURIComponent(token)}">${ICON.doc}<span><strong>${esc(m.file.name)}</strong><small>${esc(m.file.size)} · download</small></span></a>`) : ''}
          ${m.offer ? `<a class="support-offer" href="${esc(m.offer.link)}">${m.offer.image ? `<img src="${esc(m.offer.image)}" alt="" loading="lazy" />` : '<span class="support-offer-img"></span>'}<span class="support-offer-text"><strong>${esc(m.offer.product)}</strong><small>${esc(m.offer.status)}</small></span><span class="support-offer-go">See your offer</span></a>` : ''}
          ${m.product ? `<a class="support-offer support-product" href="${esc(m.product.link)}">${m.product.image ? `<img src="${esc(m.product.image)}" alt="" loading="lazy" />` : '<span class="support-offer-img"></span>'}<span class="support-offer-text"><strong>${esc(m.product.name)}</strong><small>${esc(m.product.option || 'About this piece')}</small></span></a>` : ''}
          ${m.text ? `<div class="support-bubble">${esc(m.text)}</div>` : ''}
          ${last ? `<p class="support-meta">${m.from === 'you' ? 'You · ' : ''}${fmt(m.at)}${m.from === 'you' ? `<span class="support-tick" title="Sent">${ICON.tick}<span class="sr-only">Sent</span></span>` : ''}</p>` : ''}
        </div>`;
    }).join('') +
      (msgs.some((m) => m.from === 'team' || m.from === 'assistant') ? '' : `<p class="support-wait">${ICON.clock}<span>Thanks, someone from the team will reply soon. You can close this; we’ll email you too.</span></p>`);
    if (near || stick || shown <= 2) toLatest();
  }

  /* A photo in the chat opens in a card over everything (not a new tab): the cross, a tap or click beside the card,
     or Escape closes it. It lives inside the chat element, so tapping beside it doesn't also close the chat. */
  let viewer = null;
  let viewerFrom = null;
  let viewerTimer = 0;
  function openPhoto(href, name) {
    if (!viewer) {
      viewer = document.createElement('div');
      viewer.className = 'support-viewer';
      viewer.hidden = true;
      viewer.setAttribute('role', 'dialog');
      viewer.setAttribute('aria-modal', 'true');
      viewer.setAttribute('aria-label', 'Photo');
      viewer.innerHTML = `<figure class="support-viewer-card">
          <button type="button" class="support-viewer-close" aria-label="Close photo">${ICON.x}</button>
          <img alt="" />
          <figcaption><span></span><a download>Download</a></figcaption>
        </figure>`;
      viewer.addEventListener('click', (e) => {
        if (!e.target.closest('.support-viewer-card') || e.target.closest('.support-viewer-close')) closePhoto();
      });
      panel.appendChild(viewer);
    }
    clearTimeout(viewerTimer);
    viewerFrom = document.activeElement;
    const img = viewer.querySelector('img');
    img.src = href;
    img.alt = name || 'Photo';
    viewer.querySelector('figcaption span').textContent = name || '';
    const dl = viewer.querySelector('figcaption a');
    dl.href = href;
    dl.setAttribute('download', name || 'photo');
    viewer.hidden = false;
    requestAnimationFrame(() => viewer.classList.add('is-open'));
    viewer.querySelector('.support-viewer-close').focus({ preventScroll: true });
  }
  function closePhoto() {
    if (!viewer || viewer.hidden) return;
    viewer.classList.remove('is-open');
    viewerTimer = setTimeout(() => { viewer.hidden = true; viewer.querySelector('img').removeAttribute('src'); }, reduced() ? 0 : 180);
    if (viewerFrom && viewerFrom.focus) viewerFrom.focus({ preventScroll: true });
  }
  // Escape closes the photo first (and only the photo), before the chat's own Escape
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && viewer && !viewer.hidden) { e.preventDefault(); e.stopPropagation(); closePhoto(); }
  }, true);

  /* The conversation always opens on its latest message. A hidden panel forgets where it was scrolled (it came
     back at the oldest message), and photos load after the first paint and make it taller, so this goes to the
     end on opening and a few times while it settles, and stops as soon as the visitor scrolls up. */
  function toLatest() {
    if (body) body.scrollTop = body.scrollHeight;
  }
  function settleLatest() {
    stick = true;
    toLatest();
    [60, 250, 700, 1500].forEach((t) => setTimeout(() => { if (stick && isOpen) toLatest(); }, t));
  }

  async function refresh(first) {
    // Before a conversation exists there is nothing to poll: draw the start form once, never again
    // (redrawing it every few seconds wiped what the visitor was typing).
    if (!token) {
      if (account().signedIn && !mineAsked) { // signed in on this browser: open on their latest conversation
        mineAsked = true;
        if (await adoptMine(false)) return refresh(first);
      }
      if (!body.querySelector('.support-details, .support-start, .support-welcome')) renderStart(); // reopening keeps what they typed
      return;
    }
    const out = await api('/api/support/thread?token=' + encodeURIComponent(token) + '&visible=' + (document.visibilityState === 'visible' ? 1 : 0));
    if (out && out.status === 404) {
      token = null;
      store.del(KEY);
      updateLauncher();
      return renderStart();
    }
    if (out && out.ok) {
      renderThread(out);
      setTyping(!!out.typing);
      if (first && stick) toLatest();
    }
  }

  /* While someone in our team is writing a reply: their name and three moving dots, like any messenger. */
  function setTyping(on) {
    let el = body.querySelector('.support-typing');
    if (!on) {
      if (el) el.remove();
      return;
    }
    if (el) return;
    const near = body.scrollHeight - body.scrollTop - body.clientHeight < 140;
    el = document.createElement('div');
    el.className = 'support-typing';
    el.setAttribute('role', 'status');
    el.innerHTML = `<p class="support-who">${avatar('support-who-avatar')}Dragon Spring team is typing</p>` +
      '<span class="support-typing-dots" aria-hidden="true"><i></i><i></i><i></i></span>';
    const after = body.querySelector('.support-wait, .support-ref');
    if (after) after.before(el);
    else body.appendChild(el);
    if (near) body.scrollTop = body.scrollHeight;
  }

  /* Phones: the chat fills the visible screen, so the message box stays just above the keyboard. */
  const vv = window.visualViewport;
  function fitScreen() {
    if (!panel || panel.hidden) return;
    if (vv && phone()) {
      panel.style.height = vv.height + 'px';
      panel.style.top = vv.offsetTop + 'px';
    } else {
      panel.style.height = '';
      panel.style.top = '';
    }
  }
  if (vv) {
    vv.addEventListener('resize', fitScreen);
    vv.addEventListener('scroll', fitScreen);
  }

  /* Opening grows the chat out of the launcher (or the bottom corner when a link opened it); closing shrinks it
     back into the launcher, which then simply reappears there. A clip-path that runs from the launcher's shape to
     the full chat: nothing is stretched, the text stays sharp. Off for "reduce motion". */
  function cornerRect() {
    if (launcher) {
      const was = launcher.hidden;
      launcher.style.visibility = 'hidden';
      launcher.hidden = false;
      const r = launcher.getBoundingClientRect();
      launcher.hidden = was;
      launcher.style.visibility = '';
      if (r.width) return r;
    }
    const size = 56;
    const m = phone() ? 16 : 20;
    return { left: innerWidth - m - size, top: innerHeight - m - size, right: innerWidth - m, bottom: innerHeight - m, height: size };
  }
  const canMorph = () => !reduced() && typeof panel.animate === 'function' && CSS.supports && CSS.supports('clip-path', 'inset(0 round 1px)');
  function morph(from, opening) {
    const box = panel.getBoundingClientRect();
    const reach = phone() ? 0 : 48; // the open end reaches past the edges, so the panel's shadow isn't cut off
    const small = `inset(${from.top - box.top}px ${box.right - from.right}px ${box.bottom - from.bottom}px ${from.left - box.left}px round ${from.height / 2}px)`;
    const big = `inset(${-reach}px ${-reach}px ${-reach}px ${-reach}px round ${phone() ? 0 : 28 + reach}px)`;
    return panel.animate(opening ? [{ clipPath: small }, { clipPath: big }] : [{ clipPath: big }, { clipPath: small }],
      opening ? { duration: phone() ? 480 : 560, easing: 'cubic-bezier(0.2, 0.9, 0.22, 1)', fill: 'both' }
        : { duration: phone() ? 300 : 340, easing: 'cubic-bezier(0.55, 0, 0.75, 0.1)', fill: 'both' });
  }

  function open() {
    build();
    if (hasHalo && window.Halochime && typeof window.Halochime.hide === 'function') window.Halochime.hide();
    const from = launcher && !launcher.hidden ? launcher.getBoundingClientRect() : cornerRect();
    const grow = !isOpen && canMorph();
    clearTimeout(closeTimer);
    if (panel.getAnimations) panel.getAnimations().forEach((a) => { if (a.effect && a.effect.target === panel) a.cancel(); });
    panel.classList.remove('is-closing');
    panel.classList.toggle('is-morph', grow);
    panel.hidden = false;
    isOpen = true;
    fitScreen();
    settleLatest();
    document.documentElement.classList.add('support-open');
    if (launcher) launcher.hidden = true;
    if (grow) {
      const a = morph(from, true);
      a.onfinish = () => a.cancel(); // done growing: no clip left on the open chat
    }
    refresh(true);
    clearInterval(timer);
    timer = setInterval(() => { if (token && document.visibilityState === 'visible') refresh(); }, 2500);
    if (token) focusSoon(compose.querySelector('textarea'));
  }

  // Tapping or clicking anywhere outside the open chat closes it; Escape does too.
  document.addEventListener('pointerdown', (e) => {
    if (!isOpen || !panel) return;
    const t = e.target;
    if (panel.contains(t) || (launcher && launcher.contains(t)) || (t.closest && t.closest('[data-support-open]'))) return;
    close();
  }, true);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isOpen) close(); });

  function close() {
    if (!panel || !isOpen) return;
    closePhoto();
    isOpen = false;
    document.documentElement.classList.remove('support-open');
    clearInterval(timer);
    const shrink = panel.classList.contains('is-morph') && canMorph();
    const done = () => {
      panel.hidden = true;
      panel.classList.remove('is-closing', 'is-morph');
      if (hasHalo && window.Halochime && typeof window.Halochime.show === 'function') window.Halochime.show();
      if (launcher && shrink) launcher.classList.add('no-pop'); // the chat just shrank into its place: no second entrance
      updateLauncher();
    };
    if (reduced()) return done();
    panel.classList.add('is-closing');
    if (shrink) {
      const a = morph(cornerRect(), false);
      a.onfinish = () => { done(); a.cancel(); };
      return;
    }
    closeTimer = setTimeout(done, 230); // no clip-path animation here: sinks and fades, then the launcher comes back
  }

  /* Launcher: our own bubble when HaloChime is off; a "Your conversation" pill once a chat exists. */
  function updateLauncher() {
    const want = !isOpen && (!hasHalo || token);
    if (!want) { if (launcher) launcher.hidden = true; return; }
    if (!launcher) {
      launcher = document.createElement('button');
      launcher.type = 'button';
      launcher.className = 'support-launcher' + (hasHalo ? ' is-pill' : '');
      launcher.addEventListener('click', open);
      document.body.appendChild(launcher);
    }
    launcher.classList.toggle('has-thread', !!token);
    launcher.setAttribute('aria-label', token ? 'Open your conversation with us' : 'Chat with us');
    launcher.innerHTML = token
      ? `<span class="sl-long">Your conversation</span><span class="sl-short">Your chat</span><span class="support-dot" hidden></span><span class="sl-go">${ICON.bubble}</span>`
      : `<span class="sl-long">Ask about a blade, shipping or an order</span><span class="sl-short">Chat with us</span><span class="sl-go"><span class="sl-ico sl-ico-send">${ICON.send}</span><span class="sl-ico sl-ico-chat">${ICON.bubble}</span></span>`;
    launcher.hidden = false;
    fold();
    checkUnread();
  }

  async function checkUnread() {
    if (!token || isOpen) return;
    const out = await api('/api/support/thread?token=' + encodeURIComponent(token) + '&visible=0');
    if (!out || !out.ok) return;
    const team = (out.messages || []).filter((m) => m.from === 'team').length;
    const dot = launcher && launcher.querySelector('.support-dot');
    if (dot) dot.hidden = !(team > Number(store.get(SEEN) || 0));
  }

  // Scrolling folds the launcher to its round button; back near the top it opens out again (hover does too, in CSS)
  const fold = () => { if (launcher) launcher.classList.toggle('is-compact', window.scrollY > 60); };
  window.addEventListener('scroll', fold, { passive: true });

  // The offer form joined this browser to a conversation: the launcher now shows it
  function setToken(t) {
    if (!t || t === token) return;
    token = t;
    store.set(KEY, token);
    shown = -1;
    if (panel && !panel.hidden) refresh(true);
    updateLauncher();
  }

  /* One login with the store: the signed-in customer's chat is their latest conversation (or none yet), never
     someone else's left on this browser; signing out forgets the conversation here. */
  async function adoptMine(force) {
    const m = await api('/api/support/mine');
    if (!m || !m.signedIn) return false;
    const t = m.token || null;
    if (!force && !t) return false;
    if (t !== token) {
      token = t;
      if (t) store.set(KEY, t); else store.del(KEY);
      shown = -1;
      lastMsgs = [];
      updateLauncher();
    }
    return !!t;
  }
  let wasSignedIn = null;
  document.addEventListener('ds:account', async (e) => {
    const now = !!(e.detail && e.detail.signedIn);
    if (wasSignedIn === now) return;
    const onLoad = wasSignedIn === null;
    wasSignedIn = now;
    mineAsked = false;
    if (now) {
      await adoptMine(true);
      if (panel && isOpen) { if (token) refresh(true); else renderStart(); }
    } else if (!onLoad) {
      token = null;
      store.del(KEY);
      store.del(SEEN);
      shown = -1;
      lastMsgs = [];
      if (panel && isOpen) renderStart();
      updateLauncher();
    }
  });

  // From the account page: open one of their conversations, or the chat with words ready to finish
  function openThread(t) {
    if (t && t !== token) { token = t; store.set(KEY, t); shown = -1; }
    open();
  }
  function ask(text) {
    open();
    const ta = compose.querySelector('textarea');
    if (!ta.value.trim()) { ta.value = text; ta.dispatchEvent(new Event('input')); }
    ta.focus({ preventScroll: true });
    ta.setSelectionRange(ta.value.length, ta.value.length);
  }

  window.DSSupport = { open, close, setToken, openThread, ask };
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-support-open]');
    if (a) { e.preventDefault(); open(); }
  });
  updateLauncher();
  clearInterval(checkTimer);
  checkTimer = setInterval(() => { if (token && !isOpen && document.visibilityState === 'visible') checkUnread(); }, 60000);
  if (openOnLoad) open();
})();
