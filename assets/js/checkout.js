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
 * Pay by card (optional, owner switch in the admin): when this piece has a Payoneer
 * link and the order total is exactly its amount, the confirmation also offers
 * "Pay by card (Payoneer)". The server decides; the form text here is only a preview.
 *
 * Bank transfer is offered only to the countries the owner lists (United States at first).
 * Elsewhere the card link is the only way to pay; when it doesn't apply either, the
 * order can't be placed and the buyer is asked to message the shop instead.
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

  async function config(slug) {
    try {
      const q = slug ? `?p=${encodeURIComponent(slug)}` : '';
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

  // Visitor's country (from the currency lookup) → pre-selects the main markets only.
  const ISO_NAME = {
    US: 'United States', CA: 'Canada', GB: 'United Kingdom', DE: 'Germany', CH: 'Switzerland',
    AU: 'Australia', FI: 'Finland', ES: 'Spain', EE: 'Estonia', SA: 'Saudi Arabia',
  };
  const SUBMIT_PAY = 'Place order and pay by bank transfer';
  const SUBMIT_CARD = 'Place order and pay by card or bank transfer';
  const SUBMIT_CARD_ONLY = 'Place order and pay by card';
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

  function message(title, text, extra = '') {
    root.innerHTML = `
      <div class="checkout-message">
        <h1 class="display-md">${esc(title)}</h1>
        <p>${esc(text)}</p>
        <div class="checkout-message-actions">${extra}</div>
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
    const maxQty = Math.max(1, Number(cfg.maxQty) || 1);
    const img = (product.images || [])[0];
    root.innerHTML = `
      <h1 class="display-md checkout-title">Checkout</h1>
      <div class="checkout-layout">
        <form class="checkout-form" id="checkout-form" novalidate>
          <fieldset>
            <legend>Your details</legend>
            <label>Full name <input name="name" autocomplete="name" maxlength="80" required /></label>
            <div class="co-grid">
              <label>Email <input name="email" type="email" autocomplete="email" maxlength="120" required /></label>
              <label>Phone <small>for the courier</small><input name="phone" type="tel" autocomplete="tel" maxlength="40" required placeholder="+1 555 123 4567" /></label>
            </div>
          </fieldset>
          <fieldset>
            <legend>Shipping address</legend>
            <label>Address <input name="address1" autocomplete="address-line1" maxlength="120" required /></label>
            <label>Apartment, suite, etc. <small>optional</small><input name="address2" autocomplete="address-line2" maxlength="120" /></label>
            <div class="co-grid co-grid-3">
              <label>City <input name="city" autocomplete="address-level2" maxlength="80" required /></label>
              <label id="co-region-label"><span id="co-region-text">State / region</span>
                <input name="region" id="co-region-input" autocomplete="address-level1" maxlength="80" />
                <select name="region" id="co-region-select" autocomplete="address-level1" hidden disabled>
                  <option value="">Choose state</option>${(cfg.auStates || []).map((st) => `<option value="${esc(st)}">${esc(st)}</option>`).join('')}
                </select>
              </label>
              <label>Postcode <input name="postcode" autocomplete="postal-code" maxlength="20" /></label>
            </div>
            <label>Country <select name="country" id="co-country" autocomplete="country-name" required>${countryOptions(cfg)}</select></label>
            <div class="co-rules" id="co-rules" role="status" aria-live="polite" hidden></div>
            <p class="co-hint">Some countries restrict importing blades. Please check your local rules. We can’t ship where it isn’t allowed.</p>
          </fieldset>
          <fieldset>
            <legend>Anything we should know? <small>optional</small></legend>
            <label class="sr-only" for="co-notes">Note</label>
            <textarea id="co-notes" name="notes" rows="3" maxlength="500" placeholder="Engraving request, delivery instructions…"></textarea>
          </fieldset>
          <fieldset class="co-checks">
            <label class="co-check"><input type="checkbox" name="adult" required /> <span>I am <strong>18 or over</strong>, and owning and importing this item is legal where I live. (<a href="/page/age-policy" target="_blank">Age policy</a>)</span></label>
            <label class="co-check"><input type="checkbox" name="agree" required /> <span>I agree to the <a href="/page/terms" target="_blank">terms</a>, <a href="/page/shipping" target="_blank">shipping</a> and <a href="/page/returns" target="_blank">returns</a> policies.</span></label>
          </fieldset>
          <label class="hp" aria-hidden="true">Website <input name="website" tabindex="-1" autocomplete="off" /></label>
          <p class="co-error" id="co-error" role="alert" hidden></p>
          <button type="submit" class="btn btn-dark btn-block co-submit" id="co-submit">${SUBMIT_PAY}</button>
          <p class="co-hint co-center" id="co-submit-hint">No payment is taken now. You’ll get our bank details and your order number straight away.</p>
        </form>

        <aside class="checkout-summary" aria-label="Order summary">
          <div class="co-item">
            ${img ? `<img src="${esc(img)}" alt="" />` : ''}
            <div>
              <p class="co-item-name">${esc(product.name)}</p>
              ${product.subtitle ? `<p class="co-muted">${esc(product.subtitle)}</p>` : ''}
              <p class="co-muted">${usd(product.price)} each</p>
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
            <div><dt>Shipping <small>tracked, signed-for</small></dt><dd id="co-shipping"></dd></div>
            <div class="co-total"><dt>Total</dt><dd><span id="co-total"></span> <small>USD</small><span class="co-approx" id="co-approx"></span></dd></div>
          </dl>
          <ul class="co-trust">
            <li id="co-trust-pay">Pay by bank transfer with your order number as reference.</li>
            <li>We ship only after your payment clears. Every parcel is insured, tracked and signed-for.</li>
            <li>Every blade is sharpened and checked by hand before it leaves.</li>
          </ul>
        </aside>
      </div>`;

    let qty = 1;
    // Card (Payoneer link) only fits an order whose total is exactly the link amount.
    const cardFits = (q = qty) => {
      if (cfg.cardTotal == null) return false;
      const subtotal = product.price * q;
      const free = cfg.freeShippingOver != null && subtotal >= cfg.freeShippingOver;
      const total = subtotal + (free ? 0 : Number(cfg.shippingFee) || 0);
      return Math.abs(total - Number(cfg.cardTotal)) < 0.005;
    };
    function totals() {
      const subtotal = product.price * qty;
      const free = cfg.freeShippingOver != null && subtotal >= cfg.freeShippingOver;
      const shipping = free ? 0 : Number(cfg.shippingFee) || 0;
      $('#co-qty').textContent = qty;
      $('#co-subtotal').textContent = usd(subtotal);
      $('#co-shipping').textContent = shipping ? usd(shipping) : 'Free';
      $('#co-total').textContent = usd(subtotal + shipping);
      $('#co-approx').textContent = approx(subtotal + shipping);
    }
    root.querySelectorAll('[data-step]').forEach((b) =>
      b.addEventListener('click', () => {
        qty = Math.min(maxQty, Math.max(1, qty + Number(b.dataset.step)));
        totals();
        if (!submit.dataset.busy) showVerdict(); // card or bank-only wording depends on the total
      }),
    );
    totals();

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

    // How this buyer can pay: bank transfer from their country, and/or the card link for this total.
    function payMethods() {
      const country = countrySel.value;
      const list = cfg.bankCountries;
      return { country, bank: !country || !Array.isArray(list) || list.includes(country), card: cardFits() };
    }
    const THE = ['Czech Republic', 'Dominican Republic', 'Netherlands', 'Philippines', 'United Arab Emirates', 'United Kingdom', 'United States'];
    function noMethodText(country) {
      const place = THE.includes(country) ? `the ${country}` : country;
      return qty > 1 && cardFits(1)
        ? `From ${place} you can pay by card for one piece at a time. Set the quantity to 1, or message us by WhatsApp or email to order more.`
        : `We can’t take bank transfers from ${place} yet, and card payment is coming soon. To order now, message us by WhatsApp or email and we’ll arrange it with you.`;
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
      submit.textContent = none ? 'Message us to order' : verdict.needsCheck ? SUBMIT_CHECK : m.card ? (m.bank ? SUBMIT_CARD : SUBMIT_CARD_ONLY) : SUBMIT_PAY;
      submitHint.textContent = verdict.blocked
        ? 'This piece can’t be shipped to the address above.'
        : none
          ? 'Message us and we’ll arrange payment and delivery with you.'
          : verdict.needsCheck
            ? 'No payment now. We’ll check the import rules and email you the payment details, usually within 1–2 working days.'
            : m.card && m.bank
              ? 'No payment is taken now. Next you choose: pay by card through Payoneer, or by bank transfer.'
              : m.card
                ? 'No payment is taken now. Next you pay by card on Payoneer’s secure page.'
                : 'No payment is taken now. You’ll get our bank details and your order number straight away.';
      $('#co-trust-pay').textContent = none
        ? 'For your country, we arrange payment with you by WhatsApp or email.'
        : m.card && m.bank
          ? 'Pay by card through Payoneer, or by bank transfer with your order number as reference.'
          : m.card
            ? 'Pay by card on Payoneer’s secure page.'
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
          body: JSON.stringify({ ...data, product: product.slug, qty, adult: true, agree: true }),
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
    const card = !!o.cardUrl;
    const bank = !!o.bankDetails;
    const days = Number(o.paymentDays) || 5;
    const intro = card && bank
      ? `<p>To complete it, pay <strong>${usd(o.total)} USD</strong> by card or by bank transfer within <strong>${days} days</strong>. We’ve also emailed both options to <strong>${esc(o.email)}</strong>.</p>`
      : card
        ? `<p>To complete it, pay <strong>${usd(o.total)} USD</strong> by card within <strong>${days} days</strong>. We’ve also emailed the payment link to <strong>${esc(o.email)}</strong>.</p>`
        : `<p>To complete it, send <strong>${usd(o.total)} USD</strong> by bank transfer within <strong>${days} days</strong>, with <strong>${esc(o.number)}</strong> as the payment reference. We’ve also emailed these details to <strong>${esc(o.email)}</strong>.</p>`;
    root.innerHTML = `
      <div class="co-done">
        <p class="eyebrow">Order placed</p>
        <h1 class="display-md">Thank you. Your order number is <span class="co-number">${esc(o.number)}</span></h1>
        ${intro}
        ${card
          ? `<div class="co-card">
          <p class="co-card-title">Pay by card</p>
          <p>Payoneer’s secure page opens in a new tab. Please use <strong>${esc(o.email)}</strong> as your email there, and if the form has a note field, add your order number <strong>${esc(o.number)}</strong>.</p>
          <a class="btn btn-dark" href="${esc(o.cardUrl)}" target="_blank" rel="noopener noreferrer">Pay by card (Payoneer) ${usd(o.total)}</a>
        </div>`
          : ''}
        ${bank
          ? `<div class="co-bank">
          <div class="co-bank-head"><span>${card ? 'Or pay by bank transfer' : 'Bank transfer details'}</span><button type="button" class="btn btn-outline-dark co-copy" data-copy="bank">Copy</button></div>
          <pre id="co-bank-text">Amount: ${usd(o.total)} USD
Reference: ${esc(o.number)}

${esc(o.bankDetails)}</pre>
        </div>`
          : ''}
        ${notes}
        <ol class="co-next">
          <li><strong>Pay</strong>: ${card && bank
            ? 'by card, or by bank transfer with your order number as reference. For transfers, any bank or transfer fees are paid by the sender, so the full amount arrives.'
            : card
              ? 'by card on Payoneer’s page, with the same email as your order.'
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
