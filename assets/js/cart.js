/**
 * DRAGON SPRING SWORDS, the cart.
 *
 * Kept in this browser (localStorage "dragonspring:cart"). For a signed-in customer it is saved on their account
 * too, so it follows them to another device; signing in joins the two (the server merges, account.js hands the
 * result to adopt()). Names, prices and stock always come from the live catalogue here, and the server checks
 * them all again when the order is placed.
 *
 * Header: the bag icon ([data-cart-open]) with a count opens the cart drawer. Product pages: [data-add-cart].
 * window.DSCart = { lines(), count(), add(slug, v, qty), setQty(key, qty), remove(key), clear(), adopt(items), open() }
 */
(function () {
  'use strict';

  const KEY = 'dragonspring:cart';
  const C = window.DRAGONSPRING || {};
  const esc = (s) =>
    String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const span = (usd) => (window.DSMoney ? window.DSMoney.span(usd) : `$${Number(usd).toFixed(2)}`);
  const fmt = (usd) => (window.DSMoney ? window.DSMoney.format(usd) : `$${Number(usd).toFixed(2)}`);
  const keyOf = (i) => `${i.slug}|${i.v == null ? '' : i.v}`;
  const SVG = (d, w = 20) => `<svg viewBox="0 0 24 24" width="${w}" height="${w}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const ICON = {
    x: SVG('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'),
    bag: SVG('<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>', 30),
    truck: SVG('<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62L18.3 9.38a1 1 0 0 0-.78-.38H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>', 18),
    check: SVG('<path d="M20 6 9 17l-5-5"/>', 16),
  };

  function clean(list) {
    const out = [];
    const seen = new Set();
    (Array.isArray(list) ? list : []).forEach((i) => {
      if (!i || typeof i.slug !== 'string' || !/^[a-z0-9-]{1,120}$/.test(i.slug)) return;
      const v = Number.isInteger(i.v) && i.v >= 0 ? i.v : null;
      const qty = Math.max(1, Math.min(50, parseInt(i.qty, 10) || 1));
      const k = keyOf({ slug: i.slug, v });
      if (seen.has(k)) return;
      seen.add(k);
      out.push({ slug: i.slug, v, qty });
    });
    return out.slice(0, 30);
  }
  function read() {
    try { return clean((JSON.parse(localStorage.getItem(KEY) || '{}') || {}).items); } catch (_) { return []; }
  }
  let items = read();

  function save(sync = true) {
    try { localStorage.setItem(KEY, JSON.stringify({ items, at: Date.now() })); } catch (_) {}
    paint();
    if (dialog && dialog.open) draw();
    if (sync) push();
  }

  const product = (slug) => (C.products || []).find((p) => p.slug === slug) || null;
  const maxFor = (p) => (p && p.kind === 'knife' ? 50 : 5);
  function line(i) {
    const k = keyOf(i);
    const p = product(i.slug);
    const vs = p && Array.isArray(p.variants) ? p.variants : [];
    const opt = vs.length ? vs[i.v == null ? -1 : i.v] : null;
    if (!p || (vs.length && !opt)) return { key: k, slug: i.slug, v: i.v, qty: i.qty, gone: true, name: 'A piece no longer in the shop', option: '', price: 0, image: '', max: 1, link: '' };
    return {
      key: k, slug: p.slug, v: opt ? i.v : null, qty: Math.min(i.qty, maxFor(p)), max: maxFor(p),
      name: p.name, option: opt ? opt.label : '', price: Number(opt ? opt.price : p.price),
      image: (opt && (opt.thumb || opt.image)) || (p.thumbs || p.images || [])[0] || '',
      link: `/product/${p.slug}`, gone: p.inStock === false,
    };
  }
  const lines = () => items.map(line);
  const live = () => lines().filter((l) => !l.gone);
  const count = () => live().reduce((s, l) => s + l.qty, 0);
  const subtotal = () => live().reduce((s, l) => s + l.price * l.qty, 0);

  function add(slug, v, qty = 1) {
    const p = product(slug);
    if (!p) return;
    const vs = Array.isArray(p.variants) ? p.variants : [];
    const vi = vs.length ? (Number.isInteger(v) && v >= 0 && v < vs.length ? v : 0) : null;
    const k = keyOf({ slug, v: vi });
    const found = items.find((i) => keyOf(i) === k);
    if (found) found.qty = Math.min(maxFor(p), found.qty + qty);
    else items.push({ slug, v: vi, qty: Math.min(maxFor(p), qty) });
    save();
    open(k);
  }
  function setQty(k, qty) {
    const i = items.find((x) => keyOf(x) === k);
    if (!i) return;
    const l = line(i);
    i.qty = Math.max(1, Math.min(l.max || 50, qty));
    save();
  }
  function remove(k) {
    items = items.filter((x) => keyOf(x) !== k);
    save();
  }
  function clear() {
    items = [];
    save();
  }
  function adopt(list) { // signing in: the merged cart from the account
    items = clean(list);
    save(false);
  }
  function merge(a, b) {
    const m = new Map();
    [...clean(a), ...clean(b)].forEach((i) => {
      const k = keyOf(i);
      m.set(k, m.has(k) ? { ...i, qty: Math.max(i.qty, m.get(k).qty) } : i);
    });
    return [...m.values()];
  }

  /* Signed in: the account keeps a copy */
  let pushTimer = 0;
  function push() {
    const me = window.DSAccount && window.DSAccount.me;
    if (!me || !me.signedIn) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => {
      fetch('/api/account/cart', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items }) }).catch(() => {});
    }, 400);
  }
  let wasIn = null;
  document.addEventListener('ds:account', async (e) => {
    const now = !!(e.detail && e.detail.signedIn);
    const before = wasIn;
    wasIn = now;
    if (now && before === null) { // the page opened signed in: this browser's cart and the account's become one
      try {
        const res = await fetch('/api/account/cart', { headers: { Accept: 'application/json' }, cache: 'no-store' });
        const out = await res.json();
        if (out.ok) {
          const merged = merge(out.cart, items);
          const changed = JSON.stringify(merged) !== JSON.stringify(clean(out.cart));
          items = merged;
          save(changed);
        }
      } catch (_) {}
    } else if (!now && before) { // signed out: this browser forgets their cart (the account keeps it)
      items = [];
      save(false);
    }
    paint();
  });
  window.addEventListener('storage', (e) => { // another tab changed it
    if (e.key !== KEY) return;
    items = read();
    paint();
    if (dialog && dialog.open) draw();
  });

  /* The header's bag icon and count */
  function paint() {
    const n = count();
    const shop = window.DSAccount && window.DSAccount.shop;
    document.querySelectorAll('[data-cart-open]').forEach((b) => {
      b.hidden = !((shop && shop.open) || n > 0);
      const badge = b.querySelector('.bag-count');
      if (badge) { badge.textContent = n > 99 ? '99+' : String(n); badge.hidden = !n; }
      b.setAttribute('aria-label', n ? `Your cart, ${n} ${n === 1 ? 'piece' : 'pieces'}` : 'Your cart');
    });
  }

  /* The drawer */
  let dialog = null;
  let highlight = '';
  function build() {
    if (dialog) return;
    dialog = document.createElement('dialog');
    dialog.className = 'cart-drawer';
    dialog.setAttribute('aria-labelledby', 'cart-title');
    dialog.innerHTML = `
      <div class="cart-panel">
        <header class="cart-head">
          <h2 id="cart-title">Your cart <span class="cart-n"></span></h2>
          <button type="button" class="cart-close" aria-label="Close the cart">${ICON.x}</button>
        </header>
        <div class="cart-body"></div>
      </div>`;
    document.body.appendChild(dialog);
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) return dialog.close(); // the dimmed page beside it
      if (e.target.closest('.cart-close, [data-continue]')) return dialog.close();
      const li = e.target.closest('[data-key]');
      if (!li) return;
      const k = li.dataset.key;
      const i = items.find((x) => keyOf(x) === k);
      if (e.target.closest('[data-remove]')) remove(k);
      else if (i && e.target.closest('[data-inc]')) setQty(k, i.qty + 1);
      else if (i && e.target.closest('[data-dec]')) { if (i.qty <= 1) remove(k); else setQty(k, i.qty - 1); }
    });
    dialog.addEventListener('close', () => { highlight = ''; document.documentElement.classList.remove('cart-open'); });
  }

  function draw() {
    const all = lines();
    const n = count();
    dialog.querySelector('.cart-n').textContent = n ? `(${n})` : '';
    const body = dialog.querySelector('.cart-body');
    if (!all.length) {
      body.innerHTML = `
        <div class="cart-empty">
          ${ICON.bag}
          <p class="cart-empty-title">Your cart is empty</p>
          <p>Find a blade you love, then add it here.</p>
          <a class="btn btn-dark" href="/shop">Browse the shop</a>
        </div>`;
      return;
    }
    const shop = (window.DSAccount && window.DSAccount.shop) || {};
    const sub = subtotal();
    const freeOver = shop.freeShippingOver;
    let meter = '';
    if (freeOver != null && n) {
      const left = Math.max(0, freeOver - sub);
      const pct = Math.min(100, Math.round((sub / freeOver) * 100));
      meter = `<div class="cart-free${left ? '' : ' is-free'}">
        <p>${ICON.truck}<span>${left ? `You’re <strong>${esc(fmt(left))}</strong> away from free insured shipping` : '<strong>Free insured shipping</strong> on this order'}</span></p>
        <span class="cart-meter" aria-hidden="true"><span style="width:${pct}%"></span></span>
      </div>`;
    }
    body.innerHTML = `
      ${meter}
      <ul class="cart-lines">
        ${all.map((l) => `
          <li class="cart-line${l.key === highlight ? ' is-new' : ''}${l.gone ? ' is-gone' : ''}" data-key="${esc(l.key)}">
            ${l.link ? `<a class="cart-img" href="${esc(l.link)}" tabindex="-1">${l.image ? `<img src="${esc(l.image)}" alt="" />` : ''}</a>` : '<span class="cart-img"></span>'}
            <div class="cart-info">
              ${l.link ? `<a class="cart-name" href="${esc(l.link)}">${esc(l.name)}</a>` : `<span class="cart-name">${esc(l.name)}</span>`}
              ${l.option ? `<span class="cart-opt">${esc(l.option)}</span>` : ''}
              ${l.gone ? '<span class="cart-gone">Sold out, so it won’t be ordered</span>' : `<span class="cart-each">${span(l.price)}${l.qty > 1 ? ' each' : ''}</span>`}
              <div class="cart-row">
                ${l.gone ? '' : `<div class="cart-qty" role="group" aria-label="Quantity">
                  <button type="button" data-dec aria-label="${l.qty <= 1 ? 'Remove' : 'One fewer'}">−</button>
                  <output aria-live="polite">${l.qty}</output>
                  <button type="button" data-inc aria-label="One more"${l.qty >= l.max ? ' disabled' : ''}>+</button>
                </div>`}
                <button type="button" class="cart-remove" data-remove>Remove</button>
              </div>
            </div>
            <span class="cart-line-total">${l.gone ? '' : span(l.price * l.qty)}</span>
          </li>`).join('')}
      </ul>
      <footer class="cart-foot">
        <div class="cart-sub"><span>Subtotal</span><strong>${span(sub)}</strong></div>
        <p class="cart-note">Shipping is added at checkout${freeOver != null ? `, free from ${esc(fmt(freeOver))}` : ''}. No payment is taken until you’ve placed the order.</p>
        ${n ? '<a class="btn btn-dark btn-block" href="/checkout?cart=1">Checkout</a>' : ''}
        <button type="button" class="cart-continue" data-continue>Continue shopping</button>
      </footer>`;
  }

  function open(k) {
    build();
    highlight = k || '';
    draw();
    if (!dialog.open) {
      dialog.showModal();
      document.documentElement.classList.add('cart-open');
    }
    const close = dialog.querySelector('.cart-close');
    if (close) close.focus({ preventScroll: true });
  }

  document.addEventListener('click', (e) => {
    const openBtn = e.target.closest('[data-cart-open]');
    if (openBtn) { e.preventDefault(); open(); return; }
    const addBtn = e.target.closest('[data-add-cart]');
    if (!addBtn) return;
    e.preventDefault();
    const slug = addBtn.dataset.addCart;
    let v = null;
    try {
      const now = window.DSProductNow && window.DSProductNow();
      if (now && now.slug === slug) v = now.v;
    } catch (_) {}
    add(slug, v, 1);
    addBtn.dataset.label = addBtn.dataset.label || addBtn.textContent;
    addBtn.classList.add('is-added');
    addBtn.innerHTML = `${ICON.check}<span>Added</span>`;
    clearTimeout(Number(addBtn.dataset.timer));
    addBtn.dataset.timer = setTimeout(() => { addBtn.classList.remove('is-added'); addBtn.textContent = addBtn.dataset.label; }, 1600);
  });

  window.DSCart = { lines, count, add, setQty, remove, clear, adopt, open, subtotal };
  paint();
})();
