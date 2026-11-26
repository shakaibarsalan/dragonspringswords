/**
 * DRAGON SPRING SWORDS, checkout (bank transfer).
 *
 * On /checkout?p=<product-slug>: order form → POST /api/orders → order number
 * and bank-transfer instructions (also emailed). Prices are always recalculated
 * by the server; the totals here are only a preview.
 *
 * Country rules (set by the owner in the admin): /api/shipping-check says whether
 * this product can go to the chosen country (or Australian state). Blocked places
 * can't order; "check" places order without bank details until the owner confirms.
 * The server enforces the same rules when the order is placed.
 *
 * Pay by card (optional, owner switch in the admin): no card details are taken here. The
 * buyer chooses card, and the shop emails them a Payoneer payment request for this order
 * (Payoneer: a new request for each order). The server decides; this page only previews.
 *
 * Bank transfer is offered only to the countries the owner lists, when bank details are set.
 * When card and bank transfer both apply, the buyer chooses; when neither does, the order
 * can't be placed and the buyer is asked to message the shop instead.
 *
 * On product pages: reveals the "Buy now" button ([data-buy]) when online
 * ordering is switched on in the admin.
 */
(function () {
  'use strict';

  const C = window.DRAGONSPRING || {};
  const S = C.settings || {};
  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = (s) =>
    String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const usd = (n) => {
    const v = Number(n);
    const whole = Math.abs(v % 1) < 0.005;
    return '$' + v.toLocaleString('en-US', { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 });
  };
  function approx(n) {
    let cur = 'USD';
    try {
      cur = localStorage.getItem('dragonspring:currency') || 'USD';
    } catch (_) {}
    const rate = ((C.currency || {}).rates || {})[cur];
    if (cur === 'USD' || !rate) return '';
    const v = Math.round(Number(n) * rate);
    try {
      return '≈ ' + new Intl.NumberFormat('en', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(v);
    } catch (_) {
      return `≈ ${cur} ${v.toLocaleString('en')}`;
    }
  }

  const offerToken = new URLSearchParams(location.search).get('offer') || '';
  async function config(slug) {
    try {
      const q = slug ? `?p=${encodeURIComponent(slug)}${offerToken ? '&offer=' + encodeURIComponent(offerToken) : ''}` : '';
      const res = await fetch('/api/checkout-config' + q, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error();
      return await res.json();
    } catch (_) {
      return { open: false };
    }
  }

  /* -------------------------------------------------- product page: Buy now */
  const buy = document.querySelectorAll('[data-buy]');
  if (buy.length) {
    config().then((cfg) => {
      if (!cfg.open) return;
      buy.forEach((b) => (b.hidden = false));
      const wa = document.getElementById('order-wa');
      if (wa) wa.classList.replace('btn-dark', 'btn-outline-dark');
    });
  }

  /* ------------------------------------------------------------- checkout */
  const root = $('#checkout');
  if (!root) return;

  const slug = new URLSearchParams(location.search).get('p') || '';
  const product = (C.products || []).find((p) => p.slug === slug);
  // Pieces sold by option (?v=index): the chosen option sets the price and is named on the order.
  let variant = -1;
  if (product && Array.isArray(product.variants) && product.variants.length) {
    const v = parseInt(new URLSearchParams(location.search).get('v') || '0', 10);
    variant = Math.min(Math.max(Number.isFinite(v) ? v : 0, 0), product.variants.length - 1);
    const opt = product.variants[variant];
    product.price = Number(opt.price);
    product.name = `${product.name} · ${opt.label}`;
    product.subtitle = '';
  }

  // Visitor's country (from the currency lookup) → pre-selects the main markets only.
  const ISO_NAME = {
    US: 'United States', CA: 'Canada', GB: 'United Kingdom', DE: 'Germany', CH: 'Switzerland',
    AU: 'Australia', FI: 'Finland', ES: 'Spain', EE: 'Estonia', SA: 'Saudi Arabia',
  };
  const SUBMIT_PAY = 'Place order and pay by bank transfer';
  const SUBMIT_CARD = 'Place order and pay by card';
  const SUBMIT_CHECK = 'Place order (we’ll confirm before you pay)';

  function countryOptions(cfg) {
    const main = cfg.mainCountries || [];
    const rest = (cfg.countries || []).filter((c) => !main.includes(c));
    const opt = (c) => `<option value="${esc(c)}">${esc(c)}</option>`;
    return `<option value="">Choose your country</option>
      <optgroup label="Where we ship most">${main.map(opt).join('')}</optgroup>
      <optgroup label="All countries">${rest.map(opt).join('')}</optgroup>`;
  }

  function contactButtons() {
    const out = [];
    if (S.whatsapp) out.push(`<a class="btn btn-dark" href="https://wa.me/${esc(S.whatsapp)}" target="_blank" rel="noopener">Order on WhatsApp</a>`);
    if (S.email) out.push(`<a class="btn btn-outline-dark" href="mailto:${esc(S.email)}">Email us</a>`);
    return out.join('');
  }


  // Small line icons for the checkout (stroke = currentColor)
  const svg = (d) => `<svg class="co-ico" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
  const CO_ICON = {
    shield: svg('<path d="M12 3l8 3v6c0 4.5-3.4 8.4-8 9-4.6-.6-8-4.5-8-9V6l8-3z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>'),
    blade: svg('<path d="M4 20l9.5-9.5"/><path d="M13.5 10.5L20 4l-1 5-5.5 5.5"/><path d="M6.5 15.5l2 2"/>'),
    mail: svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>'),
    lock: svg('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
    card: svg('<rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M2.5 10h19"/><path d="M6.5 15h4"/>'),
    info: svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>'),
    bag: svg('<path d="M5 8h14l-1 12H6L5 8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>'),
    chev: svg('<path d="M6 9l6 6 6-6"/>'),
  };
  const BADGES = `
    <ul class="co-badges">
      <li>${CO_ICON.shield}<span><strong>Insured delivery</strong>Tracked and signed-for, to your door</span></li>
      <li>${CO_ICON.blade}<span><strong>Hand-sharpened</strong>Checked twice before it ships</span></li>
      <li>${CO_ICON.mail}<span><strong>Pay after ordering</strong>Payment details come by email</span></li>
    </ul>`;

  function message(title, text, extra = '') {
    const pic = product && (product.images || [])[0];
    root.innerHTML = `
      <div class="checkout-message">
        <div class="co-msg-copy">
          <p class="eyebrow">Checkout</p>
          <h1 class="display-md">${esc(title)}</h1>
          <p>${esc(text)}</p>
          <div class="checkout-message-actions">${extra}</div>
          ${BADGES}
        </div>
        ${product ? `<a class="co-msg-product" href="/product/${esc(product.slug)}">
          ${pic ? `<img src="${esc(pic)}" alt="" />` : ''}
          <span class="co-msg-product-text"><span class="co-item-name">${esc(product.name)}</span>
          ${product.subtitle ? `<span class="co-muted">${esc(product.subtitle)}</span>` : ''}
          <span class="co-msg-price">${usd(product.price)}</span></span></a>` : ''}
      </div>`;
  }

  function render(cfg) {
    if (!product) {
      message('This piece isn’t available', 'It may have sold or been taken down.', '<a class="btn btn-dark" href="/shop">Browse the shop</a>');
      return;
    }
    if (!cfg.open) {
      message('Online ordering opens soon', `For now, order “${product.name}” by WhatsApp or email and we’ll arrange payment and delivery with you.`, contactButtons());
      return;
    }
    if (product.inStock === false) {
      message('This piece is sold out', 'Ask us about the next batch. We’ll reserve one for you.', contactButtons());
      return;
    }
    // an agreed offer: that price, for one piece
    if (cfg.offer) product.price = Number(cfg.offer.price);
    const maxQty = cfg.offer ? 1 : Math.max(1, Number(cfg.maxQty) || 1);
    const img = (product.images || [])[0];
    const wa = S.whatsapp ? ` or <a href="https://wa.me/${esc(S.whatsapp)}?text=${encodeURIComponent('Hello, a question about ' + product.name)}" target="_blank" rel="noopener">WhatsApp</a>` : '';
    root.innerHTML = `
      <div class="co-head">
        <h1 class="co-title">Checkout</h1>
        <ol class="co-steps" aria-hidden="true">
          <li class="is-on" data-for="1"><span>1</span><b>Contact</b></li>
          <li data-for="2"><span>2</span><b>Delivery</b></li>
          <li data-for="3"><span>3</span><b>Confirm</b></li>
        </ol>
      </div>
      <button type="button" class="co-summary-toggle" id="co-summary-toggle" aria-expanded="false" aria-controls="co-summary">
        <span class="co-summary-toggle-label">${CO_ICON.bag}<span>Show order summary</span>${CO_ICON.chev}</span>
        <strong data-co-total></strong>
      </button>
      <div class="checkout-layout">
        <form class="checkout-form" id="checkout-form" novalidate>
          <section class="co-section" data-section="1">
            <header class="co-section-head"><span class="co-num">1</span><div><h2>Contact</h2><p>Your order confirmation and payment details go to this email.</p></div></header>
            <label class="co-field">Full name <input name="name" autocomplete="name" maxlength="80" required /></label>
            <div class="co-grid">
              <label class="co-field">Email <input name="email" type="email" autocomplete="email" maxlength="120" required /></label>
              <label class="co-field"><span>Phone <small>for the courier</small></span><input name="phone" type="tel" autocomplete="tel" maxlength="40" required placeholder="+1 555 123 4567" /></label>
            </div>
          </section>

          <section class="co-section" data-section="2">
            <header class="co-section-head"><span class="co-num">2</span><div><h2>Delivery</h2><p>Insured, tracked and signed-for, to your door.</p></div></header>
            <label class="co-field">Country <select name="country" id="co-country" autocomplete="country-name" required>${countryOptions(cfg)}</select></label>
            <div class="co-rules" id="co-rules" role="status" aria-live="polite" hidden></div>
            <label class="co-field">Address <input name="address1" autocomplete="address-line1" maxlength="120" required placeholder="Street and house number" /></label>
            <label class="co-field"><span>Apartment, suite, etc. <small>optional</small></span><input name="address2" autocomplete="address-line2" maxlength="120" /></label>
            <div class="co-grid co-grid-3">
              <label class="co-field">City <input name="city" autocomplete="address-level2" maxlength="80" required /></label>
              <label class="co-field" id="co-region-label"><span id="co-region-text">State / region</span>
                <input name="region" id="co-region-input" autocomplete="address-level1" maxlength="80" />
                <select name="region" id="co-region-select" autocomplete="address-level1" hidden disabled>
                  <option value="">Choose state</option>${(cfg.auStates || []).map((st) => `<option value="${esc(st)}">${esc(st)}</option>`).join('')}
                </select>
              </label>
              <label class="co-field">Postcode <input name="postcode" autocomplete="postal-code" maxlength="20" /></label>
            </div>
            <p class="co-hint co-hint-ico">${CO_ICON.info}<span>Some countries restrict importing blades. Please check your local rules; we can’t ship where it isn’t allowed.</span></p>
            <details class="co-note">
              <summary>Add a note <small>engraving request, delivery instructions</small></summary>
              <label class="sr-only" for="co-notes">Note</label>
              <textarea id="co-notes" name="notes" rows="3" maxlength="500" placeholder="Anything we should know?"></textarea>
            </details>
          </section>

          <section class="co-section" data-section="3">
            <header class="co-section-head"><span class="co-num">3</span><div><h2>Confirm</h2><p>No payment is taken on this page.</p></div></header>
            <div class="co-pay" id="co-pay-one">${CO_ICON.card}<div><p class="co-pay-title">How you’ll pay</p><p id="co-trust-pay">Pay by bank transfer with your order number as reference.</p></div></div>
            <fieldset class="co-paywith" id="co-paywith" hidden>
              <legend class="co-pay-title">How would you like to pay?</legend>
              <label class="co-payopt"><input type="radio" name="pay" value="card" checked /><span><strong>Card</strong><small>Visa, Mastercard and more. We email you a secure Payoneer payment request for this order.</small></span></label>
              <label class="co-payopt"><input type="radio" name="pay" value="bank" /><span><strong>Bank transfer</strong><small>Our bank details come straight away, with your order number as reference.</small></span></label>
            </fieldset>
            <fieldset class="co-checks">
              <label class="co-check"><input type="checkbox" name="adult" required /> <span>I am <strong>18 or over</strong>, and owning and importing this item is legal where I live. (<a href="/page/age-policy" target="_blank">Age policy</a>)</span></label>
              <label class="co-check"><input type="checkbox" name="agree" required /> <span>I agree to the <a href="/page/terms" target="_blank">terms</a>, <a href="/page/shipping" target="_blank">shipping</a> and <a href="/page/returns" target="_blank">returns</a> policies.</span></label>
            </fieldset>
            <label class="hp" aria-hidden="true">Website <input name="website" tabindex="-1" autocomplete="off" /></label>
            <p class="co-error" id="co-error" role="alert" hidden></p>
            <div class="co-place">
              <div class="co-place-total"><span>Total</span><strong data-co-total></strong></div>
              <button type="submit" class="btn btn-dark btn-block co-submit" id="co-submit">${SUBMIT_PAY}</button>
              <p class="co-hint co-center" id="co-submit-hint">No payment is taken now. You’ll get our bank details and your order number straight away.</p>
              <p class="co-secure">${CO_ICON.lock}<span>Sent securely. Used only for this order.</span></p>
            </div>
          </section>
        </form>

        <aside class="checkout-summary" id="co-summary" aria-label="Order summary">
          <p class="co-summary-title">Your order</p>
          <div class="co-item">
            ${img ? `<img src="${esc(img)}" alt="" />` : '<span class="co-item-noimg"></span>'}
            <div>
              <p class="co-item-name">${esc(product.name)}</p>
              ${product.subtitle ? `<p class="co-muted">${esc(product.subtitle)}</p>` : ''}
              <p class="co-muted">${cfg.offer ? `<strong class="co-deal">Agreed price ${usd(product.price)}</strong> · offer ${esc(cfg.offer.number)}` : `${usd(product.price)} each`}</p>
            </div>
          </div>
          <div class="co-qty">
            <span>Quantity</span>
            <div class="co-stepper">
              <button type="button" data-step="-1" aria-label="One fewer">−</button>
              <output id="co-qty" aria-live="polite">1</output>
              <button type="button" data-step="1" aria-label="One more">+</button>
            </div>
          </div>
          <dl class="co-totals">
            <div><dt>Subtotal</dt><dd id="co-subtotal"></dd></div>
            <div><dt>Shipping <small>insured, tracked, signed-for</small></dt><dd id="co-shipping"></dd></div>
            <div class="co-total"><dt>Total</dt><dd><span id="co-total"></span> <small>USD</small><span class="co-approx" id="co-approx"></span></dd></div>
          </dl>
          ${BADGES}
          <div class="co-flow">
            <p class="co-summary-title">What happens next</p>
            <ol>
              <li><strong>You place the order</strong> here, no payment yet.</li>
              <li><strong>We email the payment details</strong> with your order number.</li>
              <li><strong>You pay</strong> by bank transfer or card.</li>
              <li><strong>We ship</strong> within 3 to 5 working days, insured.</li>
            </ol>
          </div>
          <p class="co-help">Questions? <a href="#chat" data-support-open>Chat with us</a>${wa}.</p>
        </aside>
      </div>`;

    let qty = 1;
    function totals() {
      const subtotal = product.price * qty;
      const free = cfg.freeShippingOver != null && subtotal >= cfg.freeShippingOver;
      const shipping = free ? 0 : Number(cfg.shippingFee) || 0;
      $('#co-qty').textContent = qty;
      $('#co-subtotal').textContent = usd(subtotal);
      $('#co-shipping').textContent = shipping ? usd(shipping) : 'Free';
      $('#co-total').textContent = usd(subtotal + shipping);
      $('#co-approx').textContent = approx(subtotal + shipping);
      root.querySelectorAll('[data-co-total]').forEach((el) => (el.textContent = usd(subtotal + shipping)));
    }
    root.querySelectorAll('[data-step]').forEach((b) =>
      b.addEventListener('click', () => {
        qty = Math.min(maxQty, Math.max(1, qty + Number(b.dataset.step)));
        totals();
        if (!submit.dataset.busy) showVerdict();
      }),
    );
    totals();

    // phones: the order summary folds away under a "Show order summary" bar
    const toggle = $('#co-summary-toggle');
    const summary = $('#co-summary');
    toggle.addEventListener('click', () => {
      const open = !summary.classList.contains('is-open');
      summary.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.querySelector('.co-summary-toggle-label span').textContent = open ? 'Hide order summary' : 'Show order summary';
    });
    // the step bar follows where the buyer is in the form
    const steps = root.querySelectorAll('.co-steps li');
    root.querySelectorAll('.co-section').forEach((sec) => sec.addEventListener('focusin', () => {
      const n = Number(sec.dataset.section);
      steps.forEach((li) => {
        const k = Number(li.dataset.for);
        li.classList.toggle('is-on', k === n);
        li.classList.toggle('is-done', k < n);
      });
    }));

    const form = $('#checkout-form');
    const error = $('#co-error');
    const submit = $('#co-submit');
    const countrySel = $('#co-country');
    const regionInput = $('#co-region-input');
    const regionSel = $('#co-region-select');
    const rulesBox = $('#co-rules');
    const submitHint = $('#co-submit-hint');
    let verdict = { blocked: null, needsCheck: false, buyerNotes: [] };
    let checkSeq = 0;

    // How this buyer can pay: bank transfer from their country, and/or card (a Payoneer request by email).
    const payWith = $('#co-paywith');
    const payOne = $('#co-pay-one');
    function payMethods() {
      const country = countrySel.value;
      const list = Array.isArray(cfg.bankCountries) ? cfg.bankCountries : [];
      return { country, bank: list.length > 0 && (!country || list.includes(country)), card: !!cfg.cards };
    }
    // the chosen way: from the choice when both apply, otherwise the one that does
    function chosen(m = payMethods()) {
      if (m.card && m.bank) return (form.querySelector('input[name="pay"]:checked') || {}).value === 'bank' ? 'bank' : 'card';
      return m.card ? 'card' : 'bank';
    }
    payWith.addEventListener('change', () => showVerdict());
    const THE = ['Czech Republic', 'Dominican Republic', 'Netherlands', 'Philippines', 'United Arab Emirates', 'United Kingdom', 'United States'];
    function noMethodText(country) {
      const place = THE.includes(country) ? `the ${country}` : country;
      return `We can’t take payment from ${place} online yet. To order now, message us by WhatsApp or email and we’ll arrange it with you.`;
    }
    function contactRow(country) {
      const out = [];
      if (S.whatsapp) out.push(`<a class="btn btn-dark" href="https://wa.me/${esc(S.whatsapp)}?text=${encodeURIComponent(`Hello, I’d like to order ${product.name} to ${country}.`)}" target="_blank" rel="noopener">WhatsApp us</a>`);
      if (S.email) out.push(`<a class="btn btn-outline-dark" href="mailto:${esc(S.email)}?subject=${encodeURIComponent('Order: ' + product.name)}">Email us</a>`);
      return out.length ? `<div class="co-rules-actions">${out.join('')}</div>` : '';
    }

    function showVerdict() {
      const m = payMethods();
      const none = !verdict.blocked && !!m.country && !m.bank && !m.card;
      const parts = [];
      if (verdict.blocked) parts.push(`<p class="co-rules-block">${esc(verdict.blocked)}</p>`);
      else {
        if (none) parts.push(`<p class="co-rules-block">${esc(noMethodText(m.country))}</p>${contactRow(m.country)}`);
        (verdict.buyerNotes || []).forEach((n) => parts.push(`<p>${esc(n)}</p>`));
      }
      rulesBox.innerHTML = parts.join('');
      rulesBox.hidden = !parts.length;
      rulesBox.classList.toggle('is-blocked', !!verdict.blocked || none);
      submit.disabled = !!verdict.blocked || none;
      const way = chosen(m);
      const both = m.card && m.bank && !none && !verdict.blocked;
      payWith.hidden = !both;
      payOne.hidden = both;
      submit.textContent = none ? 'Message us to order' : verdict.needsCheck ? SUBMIT_CHECK : way === 'card' ? SUBMIT_CARD : SUBMIT_PAY;
      submitHint.textContent = verdict.blocked
        ? 'This piece can’t be shipped to the address above.'
        : none
          ? 'Message us and we’ll arrange payment and delivery with you.'
          : verdict.needsCheck
            ? 'No payment now. We’ll check the import rules and email you the payment details, usually within 1–2 working days.'
            : way === 'card'
              ? 'No payment is taken now. We’ll email you a secure Payoneer payment request for this order, usually within one working day.'
              : 'No payment is taken now. You’ll get our bank details and your order number straight away.';
      $('#co-trust-pay').textContent = none
        ? 'For your country, we arrange payment with you by WhatsApp or email.'
        : way === 'card'
          ? 'Pay by card (Visa, Mastercard and more) through a secure Payoneer payment request, sent to your email.'
          : 'Pay by bank transfer with your order number as reference.';
    }

    async function checkRules() {
      const country = countrySel.value;
      const isAU = country === 'Australia';
      regionSel.hidden = regionSel.disabled = !isAU;
      regionSel.required = isAU;
      regionInput.hidden = regionInput.disabled = isAU;
      $('#co-region-text').textContent = isAU ? 'State / territory' : 'State / region';
      const state = isAU ? regionSel.value : '';
      verdict = { blocked: null, needsCheck: false, buyerNotes: [] };
      if (!country || (isAU && !state)) return showVerdict();
      const seq = ++checkSeq;
      try {
        const q = new URLSearchParams({ p: product.slug, country, state });
        const res = await fetch('/api/shipping-check?' + q, { headers: { Accept: 'application/json' } });
        const out = await res.json();
        if (seq !== checkSeq) return;
        if (out.ok) verdict = out;
      } catch (_) {
        /* the server checks again when the order is placed */
      }
      showVerdict();
    }
    countrySel.addEventListener('change', checkRules);
    regionSel.addEventListener('change', checkRules);
    const guess = ISO_NAME[String((C.currency || {}).country || '').toUpperCase()];
    if (guess && [...countrySel.options].some((o) => o.value === guess)) countrySel.value = guess;
    checkRules();

    form.addEventListener('input', (e) => {
      e.target.removeAttribute('aria-invalid');
      error.hidden = true;
    });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const data = Object.fromEntries(fd.entries());
      const required = ['name', 'email', 'phone', 'address1', 'city', 'country'];
      const missing = required.filter((k) => !String(data[k] || '').trim());
      if (missing.length) return fail('Please fill in the highlighted fields.', missing);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.email.trim())) return fail('That email address doesn’t look right.', ['email']);
      if (countrySel.value === 'Australia' && !regionSel.value) return fail('Please choose your Australian state or territory.', ['region']);
      if (verdict.blocked) return fail(verdict.blocked, ['country']);
      if (!form.adult.checked || !form.agree.checked) return fail('Please tick both boxes to confirm.');
      submit.disabled = true;
      submit.dataset.busy = '1';
      submit.textContent = 'Placing your order…';
      try {
        const res = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...data, pay: chosen(), product: product.slug, variant, qty, adult: true, agree: true, offer: cfg.offer ? cfg.offer.token : '' }),
        });
        const out = await res.json().catch(() => ({}));
        if (!res.ok || !out.ok) {
          if (out.blocked) {
            verdict = { blocked: out.error, needsCheck: false, buyerNotes: [] };
            showVerdict();
          }
          return fail(out.error || 'Something went wrong. Please try again.', out.fields || (out.blocked ? ['country'] : []));
        }
        done(out);
      } catch (_) {
        fail('Couldn’t reach us just now. Please check your connection and try again.');
      } finally {
        delete submit.dataset.busy;
        if (document.body.contains(submit)) showVerdict();
      }
    });

    function fail(msg, fields = []) {
      error.textContent = msg;
      error.hidden = false;
      const field = (f) => (f === 'region' ? (countrySel.value === 'Australia' ? regionSel : regionInput) : form[f]);
      fields.forEach((f) => field(f) && field(f).setAttribute('aria-invalid', 'true'));
      const first = fields.length && field(fields[0]);
      (first || error).scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (first) first.focus({ preventScroll: true });
    }
  }

  function done(o) {
    document.title = `Order ${o.number} | Dragon Spring Swords`;
    const notes = (o.buyerNotes || []).length
      ? `<div class="co-rules">${o.buyerNotes.map((n) => `<p>${esc(n)}</p>`).join('')}</div>`
      : '';
    const waLink = S.whatsapp
      ? `<a class="btn btn-outline-dark" href="https://wa.me/${esc(S.whatsapp)}?text=${encodeURIComponent('Hello, about my order ' + o.number)}" target="_blank" rel="noopener">Questions? WhatsApp us</a>`
      : '';
    if (o.needsCheck) {
      root.innerHTML = `
      <div class="co-done">
        <span class="co-done-mark" aria-hidden="true">${CO_ICON.mail}</span>
        <p class="eyebrow">Order received</p>
        <h1 class="display-md">Thank you. Your order number is <span class="co-number">${esc(o.number)}</span></h1>
        <p><strong>Please don’t pay yet.</strong> Importing swords into your country can need a permit, so we check the current rules for every sword order first. We’ll email <strong>${esc(o.email)}</strong> with the payment details, usually within 1–2 working days, or tell you if we can’t ship it.</p>
        ${notes}
        <ol class="co-next">
          <li><strong>We check</strong> the import rules for your address.</li>
          <li><strong>You pay</strong> once we’ve emailed the payment details (${usd(o.total)} USD).</li>
          <li><strong>We ship</strong> after the payment clears: insured, tracked and signed-for.</li>
        </ol>
        <div class="checkout-message-actions"><a class="btn btn-dark" href="/shop">Keep browsing</a>${waLink}</div>
      </div>`;
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const card = o.method === 'card';
    const bank = !card && !!o.bankDetails;
    const days = Number(o.paymentDays) || 5;
    const intro = card
      ? `<p>To complete it, pay <strong>${usd(o.total)} USD</strong> by card. We’ll email a secure <strong>Payoneer payment request</strong> to <strong>${esc(o.email)}</strong>, usually within one working day. Please pay within <strong>${days} days</strong> of receiving it.</p>`
      : `<p>To complete it, send <strong>${usd(o.total)} USD</strong> by bank transfer within <strong>${days} days</strong>, with <strong>${esc(o.number)}</strong> as the payment reference. We’ve also emailed these details to <strong>${esc(o.email)}</strong>.</p>`;
    root.innerHTML = `
      <div class="co-done">
        <span class="co-done-mark" aria-hidden="true">${CO_ICON.shield}</span>
        <p class="eyebrow">Order placed</p>
        <h1 class="display-md">Thank you. Your order number is <span class="co-number">${esc(o.number)}</span></h1>
        ${intro}
        ${card
          ? `<div class="co-card">
          <p class="co-card-title">Your card payment request</p>
          <p>It comes by email from Payoneer (payoneer.com), from Dragon Spring Swords, with your order number <strong>${esc(o.number)}</strong>. Open it and pay by card on Payoneer’s secure page. Don’t see it after a working day? Check your spam folder, or message us.</p>
        </div>`
          : ''}
        ${bank
          ? `<div class="co-bank">
          <div class="co-bank-head"><span>Bank transfer details</span><button type="button" class="btn btn-outline-dark co-copy" data-copy="bank">Copy</button></div>
          <pre id="co-bank-text">Amount: ${usd(o.total)} USD
Reference: ${esc(o.number)}

${esc(o.bankDetails)}</pre>
        </div>`
          : ''}
        ${notes}
        <ol class="co-next">
          ${card ? '<li><strong>We send the request</strong>: a Payoneer payment request for this order, to your email.</li>' : ''}
          <li><strong>Pay</strong>: ${card
            ? 'by card on Payoneer’s secure page, from the request.'
            : 'any bank or transfer fees are paid by the sender, so the full amount arrives.'}</li>
          <li><strong>We confirm</strong>: you’ll get an email as soon as the payment clears.</li>
          <li><strong>We ship</strong>: insured, tracked and signed-for. The tracking number comes by email.</li>
        </ol>
        <div class="checkout-message-actions"><a class="btn btn-dark" href="/shop">Keep browsing</a>${waLink}</div>
      </div>`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const copy = root.querySelector('[data-copy]');
    if (copy) copy.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText($('#co-bank-text').textContent);
        copy.textContent = 'Copied';
      } catch (_) {
        copy.textContent = 'Select and copy';
      }
    });
  }

  config(slug).then(render);
})();
