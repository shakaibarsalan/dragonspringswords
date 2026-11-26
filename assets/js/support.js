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

  let panel, body, compose, launcher, timer, checkTimer;
  let isOpen = false;
  let shown = -1;
  let teamCount = 0;

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
  const ICON = {
    close: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    send: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    chat: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z"/></svg>',
    clock: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
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

  function build() {
    if (panel) return;
    panel = document.createElement('div');
    panel.className = 'support';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Chat with our team');
    panel.hidden = true;
    panel.innerHTML = `
      <div class="support-head">
        ${avatar('support-head-avatar')}
        <div class="support-head-text">
          <p class="support-title">Dragon Spring Swords</p>
          <p class="support-sub">A real person replies, here and by email</p>
        </div>
        <button type="button" class="support-close" aria-label="Close chat">${ICON.close}</button>
      </div>
      <div class="support-body" aria-live="polite"></div>
      <form class="support-compose" hidden>
        <label class="sr-only" for="support-text">Message</label>
        <textarea id="support-text" rows="1" maxlength="2000" placeholder="Write a message" required></textarea>
        <button type="submit" class="support-send" aria-label="Send">${ICON.send}</button>
      </form>`;
    document.body.appendChild(panel);
    body = panel.querySelector('.support-body');
    compose = panel.querySelector('.support-compose');
    panel.querySelector('.support-close').addEventListener('click', close);
    panel.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
    const ta = compose.querySelector('textarea');
    autoGrow(ta);
    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); compose.requestSubmit(); }
    });
    compose.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = ta.value.trim();
      if (!text) return;
      ta.value = '';
      ta.style.height = '';
      const out = await api('/api/support/message', { token, message: text });
      if (out && out.ok) refresh();
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
    let el = panel.querySelector('.support-error');
    if (!el) {
      el = document.createElement('p');
      el.className = 'support-error';
      el.setAttribute('role', 'alert');
      compose.before(el);
    }
    el.textContent = text;
    setTimeout(() => el.remove(), 6000);
  }

  function renderStart() {
    compose.hidden = true;
    shown = -1;
    body.innerHTML = `
      <div class="support-msg is-team support-welcome">
        ${avatar('support-msg-avatar')}
        <div class="support-msg-col">
          <div class="support-bubble">Hello! Ask us anything about a blade, an order or delivery. Someone from our team will reply here, and by email if you’ve left.</div>
          <p class="support-meta">Dragon Spring team</p>
        </div>
      </div>
      <div class="support-topics" role="group" aria-label="Start with a topic">
        <button type="button" data-topic="I have a question about ">A blade</button>
        <button type="button" data-topic="Can you ship to ">Shipping to my country</button>
        <button type="button" data-topic="About my order: ">My order</button>
      </div>
      <form class="support-start support-card" novalidate>
        <label><span>Your name</span><input name="name" autocomplete="name" maxlength="80" placeholder="Name" required /></label>
        <label><span>Email</span><input name="email" type="email" autocomplete="email" maxlength="120" placeholder="you@example.com" required /><small>So we can reply if you leave the site.</small></label>
        <label><span>Message</span><textarea name="message" rows="3" maxlength="2000" placeholder="How can we help?" required></textarea></label>
        <label class="hp" aria-hidden="true">Website <input name="website" tabindex="-1" autocomplete="off" /></label>
        <p class="support-error" role="alert" hidden></p>
        <button type="submit" class="support-submit"><span>Start chat</span>${ICON.arrow}</button>
        <p class="support-fine">We keep this conversation so we can help you. <a href="/page/privacy" target="_blank">Privacy</a></p>
      </form>`;
    const f = body.querySelector('.support-start');
    const msg = f.querySelector('textarea[name=message]');
    autoGrow(msg, 160);
    body.querySelectorAll('[data-topic]').forEach((b) => b.addEventListener('click', () => {
      body.querySelectorAll('[data-topic]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      const starters = [...body.querySelectorAll('[data-topic]')].map((x) => x.dataset.topic);
      if (!msg.value.trim() || starters.includes(msg.value)) msg.value = b.dataset.topic; // never overwrite their own words
      msg.dispatchEvent(new Event('input'));
      msg.focus({ preventScroll: true });
      msg.setSelectionRange(msg.value.length, msg.value.length);
      f.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }));
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(f).entries());
      const err = f.querySelector('.support-error');
      const fail = (m) => { err.textContent = m; err.hidden = false; };
      if (!d.name.trim() || !d.message.trim()) return fail('Please add your name and a message.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email.trim())) return fail('Please give an email address so we can reply.');
      const btn = f.querySelector('button[type=submit]');
      const label = btn.querySelector('span');
      btn.disabled = true;
      label.textContent = 'Starting…';
      const out = await api('/api/support/start', { ...d, page: location.href });
      btn.disabled = false;
      label.textContent = 'Start chat';
      if (!out || !out.ok) return fail((out && out.error) || 'Couldn’t reach us just now. Please try again.');
      if (out.needsCode) return renderCode(out, d);
      token = out.token;
      store.set(KEY, token);
      renderThread(out);
      updateLauncher();
    });
    focusSoon(f.querySelector('input[name=name]'));
  }

  /* Returning visitor on another device: their email already has a conversation. We email a code;
     entering it opens that conversation (their new message is added to it). */
  function renderCode(info, form) {
    compose.hidden = true;
    shown = -1;
    body.innerHTML = `
      <div class="support-intro">
        <p><strong>Welcome back${form.name ? ', ' + esc(form.name.split(' ')[0]) : ''}.</strong> We found your earlier conversation (${esc(info.number)}).</p>
        <p>To keep it private, we’ve emailed a 6-digit code to <strong>${esc(info.hint)}</strong>. Enter it to carry on where you left off. Your new message will be added.</p>
        ${info.note ? `<p>${esc(info.note)}</p>` : ''}
      </div>
      <form class="support-start support-card support-code" novalidate>
        <label>Code from the email <input name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" required /></label>
        <p class="support-error" role="alert" hidden></p>
        <button type="submit" class="support-submit"><span>Continue my conversation</span>${ICON.arrow}</button>
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
    const msgs = d.messages || [];
    teamCount = msgs.filter((m) => m.from === 'team').length;
    store.set(SEEN, String(teamCount));
    if (msgs.length === shown) return;
    shown = msgs.length;
    const near = body.scrollHeight - body.scrollTop - body.clientHeight < 80;
    body.innerHTML = msgs.map((m, i) => {
      const next = msgs[i + 1];
      const last = !next || next.from !== m.from; // avatar and time only under the last of a run
      const who = m.from === 'you' ? 'You' : m.from === 'team' ? 'Dragon Spring team' : 'Dragon Spring (automatic message)';
      return `
        <div class="support-msg is-${esc(m.from)}${last ? ' is-last' : ''}">
          ${m.from === 'team' ? (last ? avatar('support-msg-avatar') : '<span class="support-msg-avatar" aria-hidden="true"></span>') : ''}
          <div class="support-msg-col">
            <div class="support-bubble">${esc(m.text)}</div>
            ${last ? `<p class="support-meta">${who}${m.via === 'email' ? ' · by email' : ''} · ${fmt(m.at)}</p>` : ''}
          </div>
        </div>`;
    }).join('') +
      (msgs.some((m) => m.from === 'team' || m.from === 'assistant') ? '' : `<p class="support-wait">${ICON.clock}<span>Thanks, someone from the team will reply soon. You can close this; we’ll email you too.</span></p>`) +
      `<p class="support-fine support-ref">Reference ${esc(d.number || '')}. You can also reply to our email; it all stays in this conversation.</p>`;
    if (near || shown <= 2) body.scrollTop = body.scrollHeight;
  }

  async function refresh(first) {
    // Before a conversation exists there is nothing to poll: draw the start form once, never again
    // (redrawing it every few seconds wiped what the visitor was typing).
    if (!token) {
      if (first || !body.querySelector('.support-start')) renderStart();
      return;
    }
    const out = await api('/api/support/thread?token=' + encodeURIComponent(token) + '&visible=' + (document.visibilityState === 'visible' ? 1 : 0));
    if (out && out.status === 404) {
      token = null;
      store.del(KEY);
      updateLauncher();
      return renderStart();
    }
    if (out && out.ok) renderThread(out);
  }

  function open() {
    build();
    if (hasHalo && window.Halochime && typeof window.Halochime.hide === 'function') window.Halochime.hide();
    panel.hidden = false;
    isOpen = true;
    document.documentElement.classList.add('support-open');
    if (launcher) launcher.hidden = true;
    refresh(true);
    clearInterval(timer);
    timer = setInterval(() => { if (token && document.visibilityState === 'visible') refresh(); }, 4000);
    if (token) focusSoon(compose.querySelector('textarea'));
  }

  function close() {
    if (!panel) return;
    panel.hidden = true;
    isOpen = false;
    document.documentElement.classList.remove('support-open');
    clearInterval(timer);
    if (hasHalo && window.Halochime && typeof window.Halochime.show === 'function') window.Halochime.show();
    updateLauncher();
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
    launcher.innerHTML = token ? `${ICON.chat}<span>Your conversation</span><span class="support-dot" hidden></span>` : `${ICON.chat}<span>Chat with us</span>`;
    launcher.hidden = false;
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

  window.DSSupport = { open, close };
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-support-open]');
    if (a) { e.preventDefault(); open(); }
  });
  updateLauncher();
  clearInterval(checkTimer);
  checkTimer = setInterval(() => { if (token && !isOpen && document.visibilityState === 'visible') checkUnread(); }, 60000);
  if (openOnLoad) open();
})();
