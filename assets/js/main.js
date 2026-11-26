/**
 * DRAGON SPRING SWORDS, storefront behaviour.
 *
 * One script for every page. It renders the shared header, footer and
 * announcement, then the page's own content (data-page on <body>):
 *   home · shop · product · info · notfound
 *
 * Data comes from assets/js/content.js (permanent design content) and
 * /catalog.js (products, photos, reviews, pages, settings and exchange rates,
 * all managed by the owner in the admin).
 *
 * On the live site the server already fills each page (header, footer, product
 * grid, product page, …) so search engines see real HTML; <body data-ssr="1">
 * says so. Then this script keeps that markup and only adds behaviour.
 * Without data-ssr (a file opened on its own) it draws everything itself.
 */
(function () {
  'use strict';

  const C = window.DRAGONSPRING || {};
  const PAGE = document.body.dataset.page || 'home';
  const SSR = document.body.dataset.ssr === '1';
  const motionSafe = document.documentElement.classList.contains('motion-ok');
  const S = Object.assign(
    {
      email: 'hello@dragonspringswords.com', whatsapp: '', phone: '', instagram: '', facebook: '',
      showroom: '', announcement: '', order_note: '', chat_src: '', chat_key: '', chat_ai: '0',
    },
    C.settings || {},
  );
  const products = C.products || [];
  const categories = C.categories || [];
  const pages = C.pages || [];

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const esc = (s) =>
    String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const icon = (id, cls = 'icon-sm') => `<svg class="${cls}" aria-hidden="true"><use href="#i-${id}"/></svg>`;
  const params = new URLSearchParams(location.search);
  // Clean URLs: /shop, /shop/<category>, /product/<slug>, /page/<slug>.
  const productUrl = (p) => `/product/${encodeURIComponent(p.slug)}`;
  const pageUrl = (slug) => `/page/${encodeURIComponent(slug)}`;
  const pageTitle = (slug, fallback) => (pages.find((p) => p.slug === slug) || {}).title || fallback;
  const shopUrl = (slug) => (slug ? `/shop/${encodeURIComponent(slug)}` : '/shop');
  const catHref = (c) => shopUrl(c.slug || '');
  /** Slug after /product/, /page/ or /shop/ in the address (or the old ?p= / ?c= form). */
  function pathSlug(prefix, legacy) {
    const m = location.pathname.match(new RegExp(`^/${prefix}/([^/]+)/?$`));
    if (m) {
      try {
        return decodeURIComponent(m[1]);
      } catch (_) {
        return m[1];
      }
    }
    return params.get(legacy) || '';
  }

  /* ---------------------------------------------------------------------------
     ICONS (Lucide)
     ------------------------------------------------------------------------ */
  const P = 'fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"';
  const SPRITE = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
    <symbol id="i-menu" viewBox="0 0 24 24" ${P}><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></symbol>
    <symbol id="i-search" viewBox="0 0 24 24" ${P}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></symbol>
    <symbol id="i-x" viewBox="0 0 24 24" ${P}><path d="M18 6 6 18"/><path d="m6 6 12 12"/></symbol>
    <symbol id="i-arrow-right" viewBox="0 0 24 24" ${P}><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></symbol>
    <symbol id="i-arrow-left" viewBox="0 0 24 24" ${P}><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></symbol>
    <symbol id="i-arrow-down" viewBox="0 0 24 24" ${P}><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></symbol>
    <symbol id="i-arrow-up-right" viewBox="0 0 24 24" ${P}><path d="M7 7h10v10"/><path d="M7 17 17 7"/></symbol>
    <symbol id="i-check" viewBox="0 0 24 24" ${P}><path d="M20 6 9 17l-5-5"/></symbol>
    <symbol id="i-plus" viewBox="0 0 24 24" ${P}><path d="M5 12h14"/><path d="M12 5v14"/></symbol><symbol id="i-minus" viewBox="0 0 24 24" ${P}><path d="M5 12h14"/></symbol>
    <symbol id="i-mail" viewBox="0 0 24 24" ${P}><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></symbol>
    <symbol id="i-phone" viewBox="0 0 24 24" ${P}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></symbol>
    <symbol id="i-whatsapp" viewBox="0 0 24 24" ${P}><path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 2.9L3 21"/><path d="M9 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0v1a5 5 0 0 0 5 5h1a.5.5 0 0 0 0-1h-1a.5.5 0 0 0 0 1"/></symbol>
    <symbol id="i-pin" viewBox="0 0 24 24" ${P}><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></symbol>
    <symbol id="i-instagram" viewBox="0 0 24 24" ${P}><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></symbol>
    <symbol id="i-facebook" viewBox="0 0 24 24" ${P}><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></symbol>
    <symbol id="i-flame" viewBox="0 0 24 24" ${P}><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></symbol>
    <symbol id="i-shield" viewBox="0 0 24 24" ${P}><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></symbol>
    <symbol id="i-truck" viewBox="0 0 24 24" ${P}><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></symbol>
  </defs></svg>`;

  /* ---------------------------------------------------------------------------
     CURRENCY, prices are set in US dollars and shown in the visitor's currency.
     Country comes from Cloudflare (via catalog.js) when available, otherwise
     from the browser's timezone and language. The visitor can always override.
     ------------------------------------------------------------------------ */
  const currencyData = C.currency || { base: 'USD', rates: { USD: 1 } };
  const rates = currencyData.rates || { USD: 1 };
  const CURRENCY_NAMES = {
    PKR: 'Pakistani rupee', USD: 'US dollar', EUR: 'Euro', GBP: 'British pound', AED: 'UAE dirham',
    SAR: 'Saudi riyal', CAD: 'Canadian dollar', AUD: 'Australian dollar', INR: 'Indian rupee',
    JPY: 'Japanese yen', CNY: 'Chinese yuan', TRY: 'Turkish lira', MYR: 'Malaysian ringgit',
    SGD: 'Singapore dollar', QAR: 'Qatari riyal', KWD: 'Kuwaiti dinar', CHF: 'Swiss franc',
  };
  const STORE_KEY = 'dragonspring:currency';

  // Prices show in US dollars for everyone until the visitor picks another currency;
  // their pick is remembered on that device.
  function pickCurrency() {
    try {
      const saved = localStorage.getItem(STORE_KEY);
      if (saved && rates[saved]) return saved;
    } catch (_) {}
    return 'USD';
  }

  let currency = pickCurrency();

  function formatPrice(usd, cur = currency) {
    const n = Number(usd);
    if (cur === 'USD' || !rates[cur]) {
      const whole = Math.abs(n % 1) < 0.005;
      return '$' + n.toLocaleString('en-US', { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 });
    }
    const converted = Math.round(n * rates[cur]);
    if (cur === 'PKR') return 'Rs ' + converted.toLocaleString('en-PK');
    try {
      return new Intl.NumberFormat('en', { style: 'currency', currency: cur, maximumFractionDigits: 0, minimumFractionDigits: 0 }).format(converted);
    } catch (_) {
      return cur + ' ' + converted.toLocaleString('en');
    }
  }
  const priceSpan = (usd) => `<span data-usd="${Number(usd)}">${formatPrice(usd)}</span>`;
  const discountPercent = (base, effective) => (!base || effective >= base ? 0 : Math.round(((base - effective) / base) * 100));

  function updatePrices() {
    $$('[data-usd]').forEach((el) => (el.textContent = formatPrice(el.dataset.usd)));
    $$('.currency-note').forEach((el) => (el.hidden = currency === 'USD'));
    $$('select[data-currency]').forEach((sel) => (sel.value = currency));
    document.dispatchEvent(new CustomEvent('currencychange'));
  }

  function initCurrencyPickers() {
    const codes = Object.keys(rates).filter((c) => CURRENCY_NAMES[c]);
    const pickers = $$('select[data-currency]');
    if (codes.length < 2) {
      pickers.forEach((sel) => (sel.closest('.currency-pick').hidden = true));
      return;
    }
    $$('.rates-credit').forEach((el) => (el.hidden = false));
    pickers.forEach((sel) => {
      sel.innerHTML = codes.map((c) => `<option value="${c}" title="${CURRENCY_NAMES[c]}">${c}</option>`).join('');
      sel.addEventListener('change', () => {
        currency = sel.value;
        try {
          localStorage.setItem(STORE_KEY, currency);
        } catch (_) {}
        updatePrices();
      });
    });
  }

  /* ---------------------------------------------------------------------------
     LAYOUT, announcement, header, mobile menu, footer (shared by every page)
     ------------------------------------------------------------------------ */
  const currencyPicker = (extra = '') =>
    `<label class="currency-pick ${extra}"><span class="sr-only">Currency</span><select data-currency aria-label="Currency"></select></label>`;

  /** Header links. "optional" ones give way (highest number first) when the desktop bar is too narrow. */
  function navLinks() {
    const links = [{ href: '/shop', label: 'Shop', key: 'shop' }];
    categories.slice(0, 3).forEach((c, i) => links.push({ href: catHref(c), label: c.name, key: 'c:' + c.slug, optional: i === 2 ? 1 : 0 }));
    const books = C.lookbooks || [];
    if (books.length) links.push({ href: books.length === 1 ? books[0].url : '/lookbook', label: 'Lookbook', key: 'lookbook' });
    links.push({ href: '/#story', label: 'Our story', key: 'story', optional: 2 });
    return links;
  }

  function activeKey() {
    if (PAGE === 'shop') return pathSlug('shop', 'c') ? 'c:' + pathSlug('shop', 'c') : 'shop';
    if (PAGE === 'lookbook') return 'lookbook';
    return '';
  }
  const overPhoto = PAGE === 'home' || PAGE === 'lookbook';

  function announcementHtml() {
    const text = (S.announcement || '').trim();
    if (!text) return '';
    const parts = text.split(/\{\s*(\d[\d,]*(?:\.\d{1,2})?)\s*\}/);
    const html = parts.map((part, i) => (i % 2 ? priceSpan(part.replace(/,/g, '')) : esc(part))).join('');
    return `
    <div class="announcement" id="announcement" role="region" aria-label="Announcement" data-key="${esc(text)}">
      <div><div class="shell">
        <p>${html} <a href="/shop">Shop now ${icon('arrow-right')}</a></p>
        <button type="button" class="announcement-close" aria-label="Dismiss announcement">${icon('x')}</button>
      </div></div>
    </div>`;
  }

  function renderLayout() {
    const top = $('#layout-top');
    const bottom = $('#layout-bottom');
    const key = activeKey();
    const links = navLinks();
    const helpSlugs = [['shipping', 'Shipping & delivery'], ['returns', 'Returns & exchanges'], ['care', 'Care & sharpening'], ['contact', 'Contact']];
    const legalSlugs = [['terms', 'Terms'], ['privacy', 'Privacy'], ['age-policy', 'Age policy']];
    if (!document.getElementById('i-menu')) {
      document.body.insertAdjacentHTML('afterbegin', SPRITE + '<a href="#main" class="skip-link">Skip to content</a>');
    }

    if (top) {
      top.outerHTML = `
      ${announcementHtml()}
      <header class="site-header${overPhoto ? ' is-transparent' : ''}" id="site-header"${overPhoto ? ' data-surface="inverse"' : ''}>
        <div class="shell header-row">
          <nav class="primary-nav" aria-label="Primary">
            ${links.map((l) => `<a class="underline-grow${l.key === key ? ' is-drawn' : ''}" href="${esc(l.href)}"${l.key === key ? ' aria-current="page"' : ''}${l.optional ? ` data-nav-optional="${l.optional}"` : ''}>${esc(l.label)}</a>`).join('')}
          </nav>
          <button type="button" class="menu-toggle" id="menu-open" aria-label="Open menu" aria-expanded="false" aria-controls="mobile-menu">${icon('menu', 'icon icon-20')}</button>
          <a href="/" class="wordmark" aria-label="Dragon Spring Swords home page"><img class="wordmark-mark" src="/assets/img/brand/logo-mark.webp" alt="" width="44" height="44" decoding="async" /><span class="wordmark-text"><span class="wordmark-name">Dragon Spring</span><span class="wordmark-sub">Swords</span></span></a>
          <div class="header-actions">
            ${currencyPicker('hide-md')}
            <a href="/shop?focus=search" class="icon-link" aria-label="Search the shop">${icon('search', 'icon')}</a>
          </div>
        </div>
      </header>
      <div class="mobile-menu" id="mobile-menu" role="dialog" aria-modal="true" aria-label="Menu">
        <div class="shell mobile-menu-top">
          <span class="wordmark"><img class="wordmark-mark" src="/assets/img/brand/logo-mark.webp" alt="" width="36" height="36" decoding="async" /><span class="wordmark-text"><span class="wordmark-name">Dragon Spring</span><span class="wordmark-sub">Swords</span></span></span>
          <button type="button" id="menu-close" aria-label="Close menu">${icon('x', 'icon icon-20')}</button>
        </div>
        <nav class="shell" aria-label="Primary">
          ${links.map((l, i) => `<a href="${esc(l.href)}" style="--i:${i}">${esc(l.label)}</a>`).join('')}
        </nav>
        <div class="shell mobile-menu-extra">
          ${currencyPicker()}
          <a href="${pageUrl('contact')}">Contact</a>
          <a href="/shop?focus=search">Search</a>
        </div>
      </div>`;
    }

    if (bottom) {
      const contactLines = [
        S.showroom ? `<p>${icon('pin')} ${esc(S.showroom)}</p>` : '',
        S.email ? `<p><a href="mailto:${esc(S.email)}">${icon('mail')} ${esc(S.email)}</a></p>` : '',
        S.whatsapp ? `<p><a href="https://wa.me/${esc(S.whatsapp)}" target="_blank" rel="noopener">${icon('whatsapp')} WhatsApp us</a></p>` : '',
        S.phone ? `<p><a href="tel:${esc(S.phone.replace(/[^\d+]/g, ''))}">${icon('phone')} ${esc(S.phone)}</a></p>` : '',
      ].join('');
      const social = [
        S.instagram ? `<a href="https://instagram.com/${esc(S.instagram)}" target="_blank" rel="noopener" aria-label="Dragon Spring Swords on Instagram">${icon('instagram', 'icon-sm icon-16')}</a>` : '',
        S.facebook ? `<a href="https://facebook.com/${esc(S.facebook)}" target="_blank" rel="noopener" aria-label="Dragon Spring Swords on Facebook">${icon('facebook', 'icon-sm icon-16')}</a>` : '',
      ].join('');
      bottom.outerHTML = `
      <footer class="site-footer" data-surface="inverse">
        <div class="shell">
          <div class="footer-grid">
            <div class="footer-brand">
              <div class="footer-lockup"><img class="footer-emblem" src="/assets/img/brand/logo-emblem.webp" alt="" width="120" height="220" loading="lazy" decoding="async" /><p class="footer-wordmark">Dragon Spring<span>Swords</span></p></div>
              <p class="tagline">Katanas, swords and fine cutlery. Forged slowly, sharpened by hand.</p>
              <address>${contactLines}</address>
            </div>
            <div class="footer-col">
              <h2 class="eyebrow">Shop</h2>
              <ul>
                <li><a href="/shop">All pieces</a></li>
                ${categories.map((c) => `<li><a href="${esc(catHref(c))}">${esc(c.name)}</a></li>`).join('')}
              </ul>
            </div>
            <div class="footer-col">
              <h2 class="eyebrow">Help</h2>
              <ul>${helpSlugs.map(([s, t]) => `<li><a href="${pageUrl(s)}">${esc(pageTitle(s, t))}</a></li>`).join('')}<li><a href="#chat" data-support-open>Chat with a person</a></li></ul>
            </div>
            <div class="footer-news">
              <h2 class="eyebrow">First look</h2>
              <p>New blades and limited runs, a few times a year. Nothing else.</p>
              <div data-newsletter></div>
            </div>
          </div>
          <div class="footer-bottom">
            <div class="footer-legal">
              <p>© ${new Date().getFullYear()} Dragon Spring Swords. Blades are sold only to buyers aged 18 and over.</p>
              <p class="legal-links">${legalSlugs.map(([s, t]) => `<a href="${pageUrl(s)}">${esc(t)}</a>`).join('')}<span class="rates-credit" hidden><a href="https://www.exchangerate-api.com" rel="noopener" target="_blank">Rates by Exchange Rate API</a></span></p>
            </div>
            <div class="footer-social">
              ${social}
              <label class="currency-pick currency-foot"><span>Currency</span><select data-currency aria-label="Currency"></select></label>
            </div>
          </div>
        </div>
      </footer>`;
    }
  }

  /* ---------------------------------------------------------------------------
     SHARED PIECES
     ------------------------------------------------------------------------ */
  function productCard(p, i = 0, eager = false) {
    const discount = p.basePrice ? discountPercent(p.basePrice, p.price) : 0;
    const inStock = p.inStock !== false;
    const [primary, secondary] = p.thumbs || p.images || [];
    const hoverImg = p.hover !== false ? secondary : null;
    let badge = '';
    if (!inStock) badge = '<span class="badge badge-overlay">Sold out</span>';
    else if (discount > 0) badge = `<span class="badge badge-accent">-${discount}%</span>`;
    else if (p.isNew) badge = '<span class="badge badge-overlay">New</span>';
    const swatches =
      p.finishes && p.finishes.length > 1
        ? `<div class="swatches" aria-hidden="true">${p.finishes.slice(0, 5).map((hex) => `<span style="background:${esc(hex)}"></span>`).join('')}</div>`
        : '';
    return `
      <article class="product-card reveal${hoverImg ? ' has-hover' : ''}" style="--delay:${(i % 4) * 0.06}s">
        <a href="${productUrl(p)}">
          <div class="product-frame">
            ${primary ? `<img class="primary" src="${esc(primary)}" alt="${esc(p.name)}" ${eager ? (i === 0 ? 'fetchpriority="high"' : 'loading="eager"') : 'loading="lazy"'} />` : ''}
            ${hoverImg ? `<img class="secondary" data-src="${esc(hoverImg)}" alt="" aria-hidden="true" />` : ''}
            <div class="badges">${badge}</div>
          </div>
          <div class="product-meta">
            <div>
              <h3>${esc(p.name)}</h3>
              ${p.category ? `<p class="cat">${esc(p.category)}</p>` : ''}
            </div>
            <p class="product-price${discount > 0 ? ' is-sale' : ''}" data-numeric>
              ${priceSpan(p.price)}
              ${discount > 0 ? `<s data-usd="${Number(p.basePrice)}">${formatPrice(p.basePrice)}</s>` : ''}
            </p>
          </div>
        </a>
        ${swatches}
      </article>`;
  }

  function wireCards(root) {
    $$('.product-card.has-hover', root).forEach((card) => {
      const load = () => {
        const img = card.querySelector('img.secondary[data-src]');
        if (img) {
          img.src = img.dataset.src;
          img.removeAttribute('data-src');
        }
      };
      card.addEventListener('pointerenter', load, { once: true });
      card.addEventListener('focusin', load, { once: true });
    });
  }

  function emptyCatalog(title = 'The first pieces are on the anvil') {
    return `
      <div class="empty-state">
        <p class="eyebrow">Coming soon</p>
        <h3 class="display-sm">${esc(title)}</h3>
        <p>Every blade is finished by hand, so new pieces arrive in small batches. Join the list and we'll tell you the moment they're ready.</p>
        <div class="empty-form" data-newsletter></div>
      </div>`;
  }

  /** Plain text from the admin → safe HTML. Blank line = paragraph, "- " = bullet. */
  function formatText(text) {
    const bullet = /^[-•]\s+/;
    return String(text || '')
      .trim()
      .split(/\n\s*\n/)
      .map((block) => {
        const out = [];
        let list = [];
        block
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean)
          .forEach((l) => {
            if (bullet.test(l)) list.push(`<li>${esc(l.replace(bullet, ''))}</li>`);
            else {
              if (list.length) out.push(`<ul>${list.join('')}</ul>`), (list = []);
              out.push(`<p>${esc(l)}</p>`);
            }
          });
        if (list.length) out.push(`<ul>${list.join('')}</ul>`);
        return out.join('');
      })
      .join('');
  }

  function setMeta(title, description) {
    document.title = title;
    if (description) {
      let m = $('meta[name="description"]');
      if (!m) {
        m = document.createElement('meta');
        m.name = 'description';
        document.head.appendChild(m);
      }
      m.content = String(description).slice(0, 160);
    }
  }

  const notFoundHtml = (eyebrow, title, text, href, label) => `
    <div class="shell notfound">
      <p class="eyebrow">${esc(eyebrow)}</p>
      <h1 class="display-md">${esc(title)}</h1>
      <p>${esc(text)}</p>
      <a class="btn btn-dark" href="${href}">${esc(label)}</a>
    </div>`;

  /* ---------------------------------------------------------------------------
     HOME
     ------------------------------------------------------------------------ */
  function renderHome() {
    const marquee = $('#marquee');
    if (marquee && C.marquee) {
      const group = (hidden) =>
        `<div class="marquee-group"${hidden ? ' aria-hidden="true"' : ''}>${C.marquee.map((m) => `<span>${esc(m)}</span>`).join('')}</div>`;
      marquee.innerHTML = group(false) + group(true);
    }

    const catGrid = $('#category-grid');
    if (catGrid && !SSR) {
      catGrid.innerHTML = categories
        .map(
          (c, i) => `
        <article class="reveal" style="--delay:${i * 0.08}s">
          <a href="${esc(catHref(c))}" class="category-card">
            <div class="category-frame mask" style="--delay:${i * 0.06}s">
              <div class="mask-scale"><img src="${esc(c.thumb || c.image)}" alt="${esc(c.name)}" loading="lazy" /></div>
              <div class="category-label">
                <div>
                  <h3>${esc(c.name)}</h3>
                  <p>${c.count > 0 ? `${c.count} ${esc(c.count === 1 ? String(c.unit).replace(/s$/, '') : c.unit)}` : 'Coming soon'}</p>
                </div>
                <span class="round-arrow">${icon('arrow-up-right')}</span>
              </div>
            </div>
          </a>
        </article>`,
        )
        .join('');
    }

    const grid = $('#product-grid');
    if (grid && SSR) wireCards(grid);
    else if (grid) {
      const n = products.length;
      const shown = products.slice(0, n >= 8 ? 8 : n >= 4 ? 4 : n);
      if (shown.length) {
        grid.innerHTML = shown.map((x, i) => productCard(x, i)).join('');
        wireCards(grid);
      } else {
        grid.outerHTML = emptyCatalog();
      }
      const viewAll = $('#view-all');
      if (viewAll) viewAll.hidden = n === 0;
    }

    const forge = $('#forge-grid');
    if (forge && C.forge) {
      forge.innerHTML = C.forge
        .slice(0, 3)
        .map(
          (f, i) => `
        <div class="reveal" style="--delay:${i * 0.08}s">
          <a href="${esc(f.href || '#story')}" class="forge-card">
            <div class="forge-frame"><img src="${esc(f.image)}" alt="${esc(f.title)}" loading="lazy" /></div>
            <div class="forge-caption"><p>${esc(f.title)}</p><p>${esc(f.stage)}</p></div>
          </a>
        </div>`,
        )
        .join('');
    }
    renderReviews();
  }

  /* ---------------------------------------------------------------------------
     REVIEWS. Only verified orders, approved by the owner in the admin
     ------------------------------------------------------------------------ */
  const stars = (n) => {
    const k = Math.max(0, Math.min(5, Math.round(Number(n) || 0)));
    return '★'.repeat(k) + '☆'.repeat(5 - k);
  };

  function renderReviews() {
    const list = C.testimonials || [];
    const section = $('#testimonials');
    const quote = $('#quote');
    const dots = $('#quote-dots');
    if (!section || !quote) return;
    if (list.length === 0 && !C.reviewsLive) {
      section.hidden = true;
      return;
    }
    section.hidden = false;
    if (C.reviewsLive) $('#review-cta').hidden = false;
    if (list.length === 0) {
      $('#quote-stage').hidden = true;
      $('#reviews-empty').hidden = false;
      return;
    }
    let index = 0;
    let timer = null;
    function show(i, animate) {
      index = i;
      const t = list[i];
      quote.querySelector('.stars').textContent = stars(t.rating);
      quote.querySelector('.quote').textContent = `“${t.quote}”`;
      quote.querySelector('footer').innerHTML =
        esc(t.attribution) +
        (t.role ? `<span style="opacity:.7"> · ${esc(t.role)}</span>` : '') +
        `<span class="verified">${icon('check')} Verified buyer</span>`;
      quote.setAttribute('aria-label', `${t.rating} out of 5 stars`);
      if (animate) {
        quote.classList.remove('is-swapping');
        void quote.offsetWidth;
        quote.classList.add('is-swapping');
      }
      $$('button', dots).forEach((b, j) => b.setAttribute('aria-current', String(j === i)));
    }
    if (list.length > 1) {
      dots.innerHTML = list
        .map((t, i) => `<button type="button" data-i="${i}" aria-label="Show review from ${esc(t.attribution)}"><span></span></button>`)
        .join('');
      dots.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-i]');
        if (btn) {
          show(Number(btn.dataset.i), true);
          clearInterval(timer);
        }
      });
      if (motionSafe) timer = setInterval(() => show((index + 1) % list.length, true), 7000);
    }
    show(0, false);
  }

  // "Write a review": reviews come from buyers only, through the private link we email
  // after delivery. This dialog sends that link again to the email on the order.
  function initReviewForm() {
    const dialog = $('#review-dialog');
    if (!dialog || !C.reviewsLive) return;
    const form = $('#review-form');
    const error = $('#review-error');
    const thanks = $('#review-thanks');
    const submit = $('#review-submit');
    const elsewhere = $('#review-elsewhere');
    const contact = S.whatsapp ? `https://wa.me/${S.whatsapp}` : S.email ? `mailto:${S.email}` : '';
    if (elsewhere && contact) {
      elsewhere.innerHTML = `Bought from us on WhatsApp, by email or on Etsy? <a href="${esc(contact)}" target="_blank" rel="noopener">Message us</a> and we’ll send you a review link.`;
    }

    const close = () => (dialog.close ? dialog.close() : dialog.removeAttribute('open'));
    $$('[data-review-open]').forEach((btn) =>
      btn.addEventListener('click', () => {
        form.hidden = false;
        thanks.hidden = true;
        error.hidden = true;
        dialog.showModal ? dialog.showModal() : dialog.setAttribute('open', '');
      }),
    );
    $('#review-close').addEventListener('click', close);
    $('#review-done').addEventListener('click', close);
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) close();
    });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());
      if (!data.order.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.email.trim())) {
        error.textContent = 'Please enter your order number and the email you ordered with.';
        error.hidden = false;
        return;
      }
      submit.disabled = true;
      submit.textContent = 'Sending…';
      try {
        const res = await fetch('/api/reviews/link', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        const out = await res.json().catch(() => ({}));
        if (!res.ok || !out.ok) throw new Error(out.error || 'Something went wrong. Please try again.');
        form.reset();
        form.hidden = true;
        thanks.hidden = false;
      } catch (err) {
        error.textContent = err.message === 'Failed to fetch' ? 'Couldn’t reach us just now. Please try again.' : err.message;
        error.hidden = false;
      } finally {
        submit.disabled = false;
        submit.textContent = 'Email me my review link';
      }
    });
  }

  /* ---------------------------------------------------------------------------
     SHOP. Every visible product, with category filter, search and sort
     ------------------------------------------------------------------------ */
  function renderShop() {
    const grid = $('#shop-grid');
    const chips = $('#shop-chips');
    const search = $('#shop-search');
    const sort = $('#shop-sort');
    const count = $('#shop-count');
    const title = $('#shop-title');
    const lede = $('#shop-lede');
    if (!grid) return;
    // Server-drawn page but no live catalogue (e.g. a crawler that skips /catalog.js): keep it as is.
    if (SSR && !C.live) return wireCards(grid);

    const SORTS = ['featured', 'newest', 'price-asc', 'price-desc'];
    const state = { c: pathSlug('shop', 'c'), q: params.get('q') || '', sort: params.get('sort') || 'featured' };
    if (!SORTS.includes(state.sort)) state.sort = 'featured';
    search.value = state.q;
    sort.value = state.sort;

    const counts = {};
    products.forEach((p) => (counts[p.categorySlug] = (counts[p.categorySlug] || 0) + 1));
    const items = [{ slug: '', name: 'All', n: products.length }].concat(
      categories.map((c) => ({ slug: c.slug, name: c.name, n: counts[c.slug] || 0 })),
    );
    chips.innerHTML = items
      .map((it) => `<button type="button" class="chip" data-c="${esc(it.slug)}" aria-pressed="false">${esc(it.name)}<span>${it.n}</span></button>`)
      .join('');

    // The chips row scrolls sideways on phones: fade the edge that has more chips,
    // and slide the chosen chip into view.
    function chipEdges() {
      const max = chips.scrollWidth - chips.clientWidth;
      chips.classList.toggle('can-left', max > 4 && chips.scrollLeft > 4);
      chips.classList.toggle('can-right', max > 4 && chips.scrollLeft < max - 4);
    }
    function revealChip(b, smooth) {
      if (!b || chips.scrollWidth <= chips.clientWidth + 4) return;
      const cr = chips.getBoundingClientRect();
      const br = b.getBoundingClientRect();
      const pad = 24;
      let dx = 0;
      if (br.left < cr.left + pad) dx = br.left - cr.left - pad;
      else if (br.right > cr.right - pad) dx = br.right - cr.right + pad;
      if (dx) chips.scrollBy({ left: dx, behavior: smooth && motionSafe ? 'smooth' : 'auto' });
    }
    chips.addEventListener('scroll', chipEdges, { passive: true });
    window.addEventListener('resize', chipEdges);

    let first = true;
    function apply(push) {
      const q = state.q.trim().toLowerCase();
      let list = products.filter((p) => !state.c || p.categorySlug === state.c);
      if (q) {
        list = list.filter((p) =>
          [p.name, p.subtitle, p.categoryName, p.description, (p.details || []).map((d) => d.join(' ')).join(' ')]
            .join(' ')
            .toLowerCase()
            .includes(q),
        );
      }
      if (state.sort === 'price-asc') list = [...list].sort((a, b) => a.price - b.price);
      if (state.sort === 'price-desc') list = [...list].sort((a, b) => b.price - a.price);
      if (state.sort === 'newest') list = [...list].sort((a, b) => (b.id || 0) - (a.id || 0));

      const cat = categories.find((c) => c.slug === state.c);
      title.textContent = cat ? cat.name : 'All pieces';
      lede.textContent = cat
        ? cat.intro || `Every piece in ${cat.name.toLowerCase()} we have in the vault right now.`
        : 'Katanas, swords, knives and axes. Every piece finished and sharpened by hand.';
      // The server already wrote this page's title and description; change them only on later filters.
      if (!(SSR && first)) setMeta(`${cat ? cat.name : 'Shop'} | Dragon Spring Swords`, lede.textContent);
      first = false;
      $$('.chip', chips).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.c === state.c)));
      count.textContent = `${list.length} ${list.length === 1 ? 'piece' : 'pieces'}`;

      if (products.length === 0) {
        grid.innerHTML = emptyCatalog();
        mountNewsletters(grid);
      } else if (list.length === 0) {
        grid.innerHTML = `
          <div class="empty-state">
            <h3 class="display-sm">Nothing matches${q ? ` “${esc(state.q)}”` : ' here yet'}</h3>
            <p>${q ? 'Try another word or category.' : 'New pieces in this category are on the way.'}</p>
            <button type="button" class="btn btn-outline-dark" id="shop-clear">Show all pieces</button>
          </div>`;
        $('#shop-clear').addEventListener('click', () => {
          state.c = '';
          state.q = '';
          search.value = '';
          apply(true);
        });
      } else {
        grid.innerHTML = list.map((p, i) => productCard(p, i, i < 4)).join('');
        wireCards(grid);
      }
      updatePrices();
      observeMotion(grid);

      const qs = new URLSearchParams();
      if (state.q) qs.set('q', state.q);
      if (state.sort !== 'featured') qs.set('sort', state.sort);
      history[push ? 'pushState' : 'replaceState'](null, '', shopUrl(state.c) + (qs.toString() ? '?' + qs : ''));
    }

    chips.addEventListener('click', (e) => {
      const b = e.target.closest('.chip');
      if (!b) return;
      state.c = b.dataset.c;
      apply(true);
      revealChip(b, true);
    });
    let t;
    search.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(() => {
        state.q = search.value;
        apply(false);
      }, 180);
    });
    $('#shop-search-form').addEventListener('submit', (e) => {
      e.preventDefault();
      state.q = search.value;
      apply(false);
      search.blur(); // closes the phone keyboard so the results are visible
    });
    sort.addEventListener('change', () => {
      state.sort = sort.value;
      apply(false);
    });
    window.addEventListener('popstate', () => {
      const p = new URLSearchParams(location.search);
      state.c = (location.pathname.match(/^\/shop\/([^/]+)/) || [])[1] || p.get('c') || '';
      try {
        state.c = decodeURIComponent(state.c);
      } catch (_) {}
      state.q = p.get('q') || '';
      state.sort = SORTS.includes(p.get('sort')) ? p.get('sort') : 'featured';
      search.value = state.q;
      sort.value = state.sort;
      apply(false);
    });
    apply(false);
    revealChip($('.chip[aria-pressed="true"]', chips), false);
    chipEdges();
    if (params.get('focus') === 'search') search.focus();
  }

  /* ---------------------------------------------------------------------------
     PRODUCT
     ------------------------------------------------------------------------ */
  function renderProduct() {
    const root = $('#product');
    if (!root) return;
    const p = products.find((x) => x.slug === pathSlug('product', 'p'));
    if (SSR) return wireProduct(p);
    if (!p) {
      root.innerHTML = notFoundHtml(
        'Not in the vault', 'This piece isn’t available',
        'It may have sold or been taken down. Have a look at what’s in the shop now.', '/shop', 'Browse the shop',
      );
      setMeta('Piece not found | Dragon Spring Swords');
      return;
    }
    const discount = p.basePrice ? discountPercent(p.basePrice, p.price) : 0;
    const inStock = p.inStock !== false;
    const images = p.images || [];
    const related = products
      .filter((x) => x.slug !== p.slug)
      .sort((a, b) => (b.categorySlug === p.categorySlug) - (a.categorySlug === p.categorySlug))
      .slice(0, 4);
    const myReviews = (C.testimonials || []).filter((r) => r.role === p.name);
    const avg = myReviews.length ? myReviews.reduce((s, r) => s + Number(r.rating || 0), 0) / myReviews.length : 0;
    const pageBlurb = (s) => {
      const pg = pages.find((x) => x.slug === s);
      if (!pg) return null;
      const first = pg.body.split(/\n\s*\n/).slice(0, 2).join('\n\n');
      return [pg.title, `${formatText(first)}<p><a href="${pageUrl(s)}" class="text-link">Read the full page</a></p>`];
    };
    const thumbs = p.thumbs || images;
    const sections = [];
    if (p.description) sections.push(['Description', formatText(p.description)]);
    if (p.details && p.details.length) {
      sections.push(['Specifications', `<dl class="specs">${p.details.map(([k, v]) => (k ? `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>` : `<div class="spec-wide"><dd>${esc(v)}</dd></div>`)).join('')}</dl>`, true]);
    }
    ['shipping', 'returns', 'care'].map(pageBlurb).filter(Boolean).forEach((b) => sections.push(b));

    root.innerHTML = `
      <div class="shell product-shell">
        <nav class="crumbs reveal is-mount" aria-label="Breadcrumb" style="--distance:8px">
          <a href="/shop">Shop</a>
          ${p.categorySlug ? `<span aria-hidden="true">/</span><a href="${esc(shopUrl(p.categorySlug))}">${esc(p.categoryName)}</a>` : ''}
          <span aria-hidden="true">/</span><span aria-current="page">${esc(p.name)}</span>
        </nav>
        <div class="product-layout">
          <div class="gallery${images.length > 1 ? ' has-many' : ''}">
            ${images.length > 1 ? `<div class="gallery-rail" aria-label="Choose a photo">${thumbs
              .map((src, i) => `<button type="button"${i === 0 ? ' aria-current="true"' : ''} data-i="${i}" aria-label="Photo ${i + 1} of ${images.length}"><img src="${esc(src)}" alt="" loading="lazy" /></button>`)
              .join('')}</div>` : ''}
            <div class="gallery-stage">
              <div class="gallery-frame mask is-mount"><div class="mask-scale">
                <div class="gallery-track" id="gallery-main" tabindex="0" aria-label="Product photos${images.length > 1 ? ', use the arrow keys to change' : ''}">
                  ${images.map((src, i) => `<figure class="gallery-slide${i === 0 ? ' is-active' : ''}"><img src="${esc(src)}" alt="${esc(p.name)}${i ? `, photo ${i + 1}` : ''}" ${i ? 'loading="lazy"' : 'fetchpriority="high"'} /></figure>`).join('')}
                </div>
              </div></div>
              ${images.length > 1 ? `
              <button type="button" class="gallery-nav prev" aria-label="Previous photo">${icon('arrow-left')}</button>
              <button type="button" class="gallery-nav next" aria-label="Next photo">${icon('arrow-right')}</button>
              <span class="gallery-count" id="gallery-count">1 / ${images.length}</span>
              <div class="gallery-dots" aria-hidden="true">${images.map((_, i) => `<span${i === 0 ? ' class="is-active"' : ''}></span>`).join('')}</div>` : ''}
            </div>
          </div>

          <div class="product-info">
            ${p.categoryName ? `<p class="eyebrow reveal is-mount" style="--distance:10px"><a href="${esc(shopUrl(p.categorySlug))}">${esc(p.categoryName)}</a></p>` : ''}
            <h1 class="product-title split${p.name.length > 40 ? ' is-long' : ''}" data-split data-mount style="--delay:0.08s">${esc(p.name)}</h1>
            <div class="product-intro reveal is-mount" style="--delay:0.25s;--distance:14px">
              ${p.subtitle ? `<p class="product-sub">${esc(p.subtitle)}</p>` : ''}
              ${myReviews.length ? `<a href="#product-reviews" class="rating-line"><span class="stars-inline" aria-hidden="true">${stars(avg)}</span> ${avg.toFixed(1)} · ${myReviews.length} verified review${myReviews.length === 1 ? '' : 's'}</a>` : ''}
              <div class="product-price-lg${discount > 0 ? ' is-sale' : ''}" data-numeric>
                ${priceSpan(p.price)}
                ${discount > 0 ? `<s data-usd="${Number(p.basePrice)}">${formatPrice(p.basePrice)}</s><span class="badge badge-accent">-${discount}%</span>` : ''}
                ${!inStock ? '<span class="badge badge-dark">Sold out</span>' : p.isNew ? '<span class="badge badge-dark">New</span>' : ''}
              </div>
              <p class="currency-note" hidden>Converted from US dollars at today’s rate. The final amount is confirmed when you order.</p>
            </div>
            ${p.finishes && p.finishes.length > 1 ? `<div class="finish-row reveal is-mount" style="--delay:0.32s"><span>Finishes</span><div class="swatches swatches-lg">${p.finishes.map((h) => `<span style="background:${esc(h)}"></span>`).join('')}</div></div>` : ''}

            <div class="order-box reveal is-mount" style="--delay:0.36s;--distance:14px">
              ${inStock ? `<a class="btn btn-dark btn-block" href="/checkout?p=${encodeURIComponent(p.slug)}" data-buy hidden>Buy now</a>` : ''}
              ${S.whatsapp ? `<a class="btn btn-dark btn-block" id="order-wa" target="_blank" rel="noopener">${icon('whatsapp')} ${inStock ? 'Order on WhatsApp' : 'Ask about availability'}</a>` : ''}
              ${S.email ? `<a class="btn ${S.whatsapp ? 'btn-outline-dark' : 'btn-dark'} btn-block" id="order-mail">${icon('mail')} ${inStock ? 'Email to order' : 'Email about availability'}</a>` : ''}
              ${S.order_note ? `<p class="order-note">${esc(S.order_note)}</p>` : ''}
              <ul class="order-points">
                <li>${icon('flame')} Sharpened and checked by hand</li>
                <li>${icon('truck')} Insured, tracked delivery</li>
                <li>${icon('shield')} Sold only to buyers 18+</li>
              </ul>
            </div>

            <div class="product-accordion reveal is-mount" data-accordion style="--delay:0.42s;--distance:14px">
              ${sections.map(([title, body, isSpecs], i) => `
              <div class="acc-item${i === 0 ? ' is-open' : ''}">
                <h2><button type="button" class="acc-head" aria-expanded="${i === 0}" aria-controls="acc-${i + 1}" id="acc-h${i + 1}">${esc(title)}<span class="acc-icon" aria-hidden="true">${icon('plus')}${icon('minus')}</span></button></h2>
                <div class="acc-panel" id="acc-${i + 1}" role="region" aria-labelledby="acc-h${i + 1}"><div><div class="acc-body${isSpecs ? '' : ' prose'}">${body}</div></div></div>
              </div>`).join('')}
            </div>
          </div>
        </div>
      </div>

      <section class="shell section section-tight" id="product-reviews">
        <div class="section-heading">
          <div><p class="eyebrow">Verified buyers</p><h2 class="display-sm">Reviews</h2></div>
          ${C.reviewsLive ? `<button type="button" class="btn btn-outline-dark" data-review-open data-product="${esc(p.name)}">Write a review</button>` : ''}
        </div>
        ${myReviews.length
          ? `<div class="review-cards">${myReviews.map((r) => `
              <figure class="review-card">
                <p class="stars" aria-label="${r.rating} out of 5 stars">${stars(r.rating)}</p>
                <blockquote>“${esc(r.quote)}”</blockquote>
                <figcaption>${esc(r.attribution)} <span class="verified">${icon('check')} Verified buyer</span></figcaption>
              </figure>`).join('')}</div>`
          : `<p class="muted-line">No reviews for this piece yet. Reviews come only from verified orders.</p>`}
      </section>

      ${related.length ? `
      <section class="shell section section-tight">
        <div class="section-heading"><div><p class="eyebrow">Also in the vault</p><h2 class="display-sm">You may also like</h2></div>
          <a href="/shop" class="arrow-link">View all ${icon('arrow-right')}</a></div>
        <div class="product-grid">${related.map((x, i) => productCard(x, i)).join('')}</div>
      </section>` : ''}`;

    setMeta(`${p.name} | Dragon Spring Swords`, p.description || `${p.name}${p.subtitle ? ', ' + p.subtitle : ''}. Hand-finished by Dragon Spring Swords.`);
    wireProduct(p);
  }

  /** Order links, gallery and card hovers on a product page (drawn here or by the server). */
  function wireProduct(p) {
    const root = $('#product');
    wireCards(root);
    if (!$('#gallery-main')) return; // "not found" page

    // Order links carry the piece, the price the visitor sees, and the page.
    const inStock = p && p.inStock !== false;
    function updateOrderLinks() {
      if (!p) return; // no live catalogue: keep the server's US-dollar links
      const shown = currency === 'USD' ? formatPrice(p.price) : `${formatPrice(p.price)} (US ${formatPrice(p.price, 'USD')})`;
      const msg = `Hello Dragon Spring Swords, I'd like to ${inStock ? 'order' : 'ask about'}:\n${p.name}${p.subtitle ? ', ' + p.subtitle : ''}\nPrice shown: ${shown}\n${location.href}`;
      const wa = $('#order-wa');
      const mail = $('#order-mail');
      if (wa) wa.href = `https://wa.me/${S.whatsapp}?text=${encodeURIComponent(msg)}`;
      if (mail) mail.href = `mailto:${S.email}?subject=${encodeURIComponent((inStock ? 'Order: ' : 'Availability: ') + p.name)}&body=${encodeURIComponent(msg + '\n\nMy name:\nCountry for delivery:\n')}`;
    }
    updateOrderLinks();
    document.addEventListener('currencychange', updateOrderLinks);

    initGallery();
    initAccordion($('[data-accordion]', root));
  }

  /**
   * Product photos (Nehta's ProductGallery). Desktop: a thumbnail rail beside one
   * frame that cross-fades. Phones and tablets: a swipeable strip where the next
   * photo peeks in from the right, with dots underneath.
   */
  function initGallery() {
    const track = $('#gallery-main');
    if (!track) return;
    const slides = $$('.gallery-slide', track);
    const rail = $$('.gallery-rail button');
    const dots = $$('.gallery-dots span');
    const count = $('#gallery-count');
    let cur = 0;
    const swipes = () => track.scrollWidth > track.clientWidth + 4; // the strip layout is active
    function mark(i) {
      cur = i;
      slides.forEach((el, j) => el.classList.toggle('is-active', j === i));
      rail.forEach((b, j) => (j === i ? b.setAttribute('aria-current', 'true') : b.removeAttribute('aria-current')));
      dots.forEach((d, j) => d.classList.toggle('is-active', j === i));
      if (count) count.textContent = `${i + 1} / ${slides.length}`;
    }
    function go(i) {
      i = (i + slides.length) % slides.length;
      mark(i);
      if (swipes()) track.scrollTo({ left: slides[i].offsetLeft - slides[0].offsetLeft, behavior: motionSafe ? 'smooth' : 'auto' });
    }
    if (slides.length < 2) return;
    $('.gallery-nav.prev').addEventListener('click', () => go(cur - 1));
    $('.gallery-nav.next').addEventListener('click', () => go(cur + 1));
    rail.forEach((b) => b.addEventListener('click', () => go(Number(b.dataset.i))));
    track.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(cur - 1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); go(cur + 1); }
    });
    let pending = false;
    track.addEventListener('scroll', () => {
      if (pending || !swipes()) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        const step = slides[1].offsetLeft - slides[0].offsetLeft || 1;
        const i = Math.max(0, Math.min(slides.length - 1, Math.round(track.scrollLeft / step)));
        if (i !== cur) mark(i);
      });
    }, { passive: true });
  }

  /** Nehta's ProductAccordion: one section open at a time, height animated with the 0fr/1fr grid trick. */
  function initAccordion(box) {
    if (!box) return;
    box.classList.add('is-ready'); // without JS every section stays open
    const items = $$('.acc-item', box);
    items.forEach((item) => {
      $('.acc-head', item).addEventListener('click', () => {
        const open = !item.classList.contains('is-open');
        items.forEach((x) => {
          const on = x === item && open;
          x.classList.toggle('is-open', on);
          $('.acc-head', x).setAttribute('aria-expanded', String(on));
        });
      });
    });
  }

  /* ---------------------------------------------------------------------------
     INFO PAGES  /* ---------------------------------------------------------------------------
     INFO PAGES (shipping, returns, care, terms, privacy, age policy, contact)
     ------------------------------------------------------------------------ */
  function renderInfo() {
    const root = $('#info');
    if (!root) return;
    if (SSR) return; // already drawn by the server
    const slug = pathSlug('page', 'p');
    const pg = pages.find((x) => x.slug === slug);
    if (!pg) {
      root.innerHTML = notFoundHtml('Not found', 'This page has left the vault', 'The link may be old or mistyped.', '/', 'Back to the homepage');
      setMeta('Page not found | Dragon Spring Swords');
      return;
    }
    const card = (href, ic, label, value, ext) =>
      `<a class="contact-card" href="${href}"${ext ? ' target="_blank" rel="noopener"' : ''}>${icon(ic, 'icon')}<span><strong>${label}</strong>${esc(value)}</span></a>`;
    const contact =
      slug === 'contact'
        ? `<div class="contact-cards">
            ${S.whatsapp ? card(`https://wa.me/${esc(S.whatsapp)}`, 'whatsapp', 'WhatsApp', '+' + S.whatsapp, true) : ''}
            ${S.email ? card(`mailto:${esc(S.email)}`, 'mail', 'Email', S.email) : ''}
            ${S.phone ? card(`tel:${esc(S.phone.replace(/[^\d+]/g, ''))}`, 'phone', 'Phone', S.phone) : ''}
            ${S.instagram ? card(`https://instagram.com/${esc(S.instagram)}`, 'instagram', 'Instagram', '@' + S.instagram, true) : ''}
            ${S.facebook ? card(`https://facebook.com/${esc(S.facebook)}`, 'facebook', 'Facebook', S.facebook, true) : ''}
            ${S.showroom ? `<div class="contact-card">${icon('pin', 'icon')}<span><strong>Visit</strong>${esc(S.showroom)}</span></div>` : ''}
          </div>`
        : '';
    root.innerHTML = `
      <div class="shell info-shell">
        <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a><span aria-hidden="true">/</span><span aria-current="page">${esc(pg.title)}</span></nav>
        <div class="info-layout">
          <article class="info-body">
            <h1 class="display-md">${esc(pg.title)}</h1>
            ${contact}
            <div class="prose">${formatText(pg.body)}</div>
          </article>
          <aside class="info-aside" aria-label="More information">
            <p class="eyebrow">More information</p>
            <ul>${pages.map((o) => `<li><a href="${pageUrl(o.slug)}"${o.slug === slug ? ' aria-current="page"' : ''}>${esc(o.title)}</a></li>`).join('')}</ul>
          </aside>
        </div>
      </div>`;
    setMeta(`${pg.title} | Dragon Spring Swords`, pg.body.split('\n')[0]);
  }

  /* ---------------------------------------------------------------------------
     NEWSLETTER, email or WhatsApp number, stored in the admin
     ------------------------------------------------------------------------ */
  let formCount = 0;
  function mountNewsletters(root = document) {
    $$('[data-newsletter]:not([data-mounted])', root).forEach((host) => {
      host.dataset.mounted = '1';
      const id = `newsletter-${++formCount}`;
      host.innerHTML = `
        <form novalidate>
          <label for="${id}" class="sr-only">Email address or WhatsApp number</label>
          <div class="nl-field">
            <input id="${id}" type="text" inputmode="email" autocomplete="email" placeholder="Email or WhatsApp number" aria-describedby="${id}-error" />
            <button type="submit" aria-label="Sign up">${icon('arrow-right')}</button>
          </div>
          <label class="hp" aria-hidden="true">Website <input name="website" tabindex="-1" autocomplete="off" /></label>
          <p class="nl-error" id="${id}-error" role="alert" hidden></p>
        </form>`;
      const form = $('form', host);
      const input = $(`#${id}`, host);
      const error = $('.nl-error', host);
      input.addEventListener('input', () => {
        error.hidden = true;
        input.removeAttribute('aria-invalid');
      });
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const value = input.value.trim();
        const looksOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value) || /^\+?\d{8,15}$/.test(value.replace(/[\s\-()]/g, ''));
        if (!looksOk) {
          error.textContent = 'Enter an email address, or a WhatsApp number with country code.';
          error.hidden = false;
          input.setAttribute('aria-invalid', 'true');
          return;
        }
        try {
          const res = await fetch('/api/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contact: value, website: form.website.value }),
          });
          const out = await res.json().catch(() => ({}));
          if (!res.ok || !out.ok) throw new Error(out.error || 'Something went wrong. Please try again.');
          const done = document.createElement('p');
          done.className = 'form-done';
          done.setAttribute('role', 'status');
          done.innerHTML =
            icon('check') +
            (out.channel === 'whatsapp' ? 'Thank you. We’ll message you on WhatsApp when new pieces land.' : 'Thank you. We’ll email you when new pieces land.');
          form.replaceWith(done);
        } catch (err) {
          error.textContent = err.message === 'Failed to fetch' ? 'Couldn’t reach us just now. Please try again.' : err.message;
          error.hidden = false;
        }
      });
    });
  }

  /* ---------------------------------------------------------------------------
     ANNOUNCEMENT, HEADER, MENU
     ------------------------------------------------------------------------ */
  function initAnnouncement() {
    const bar = $('#announcement');
    if (!bar) return;
    const key = 'dragonspring:dismissed:' + bar.dataset.key;
    try {
      if (sessionStorage.getItem(key)) return bar.remove();
    } catch (_) {}
    bar.querySelector('.announcement-close').addEventListener('click', () => {
      bar.classList.add('is-dismissed');
      try {
        sessionStorage.setItem(key, '1');
      } catch (_) {}
      setTimeout(() => bar.remove(), 450);
    });
  }

  function initHeader() {
    const header = $('#site-header');
    const menu = $('#mobile-menu');
    const openBtn = $('#menu-open');
    const closeBtn = $('#menu-close');
    if (!header) return;
    const overHero = overPhoto;
    let last = window.scrollY;

    // Links on the left must never run under the centred wordmark: drop the
    // optional ones (Our story first, then the third category) until they fit.
    const nav = $('.primary-nav', header);
    const mark = $('.wordmark', header);
    function fitNav() {
      if (!nav || !mark) return;
      const optional = $$('[data-nav-optional]', nav).sort((a, b) => b.dataset.navOptional - a.dataset.navOptional);
      optional.forEach((a) => (a.hidden = false));
      if (getComputedStyle(nav).display === 'none') return;
      // links sit to the right of the wordmark: drop the optional ones while they would touch it
      const limit = mark.getBoundingClientRect().right + 32;
      const left = () => Math.min(...$$('a:not([hidden])', nav).map((a) => a.getBoundingClientRect().left));
      for (const a of optional) {
        if (left() >= limit) break;
        a.hidden = true;
      }
    }
    fitNav();
    window.addEventListener('resize', fitNav);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitNav);
    let menuOpen = false;
    function update() {
      const y = window.scrollY;
      const transparent = overHero && y <= 24 && !menuOpen;
      header.classList.toggle('is-transparent', transparent);
      if (transparent) header.setAttribute('data-surface', 'inverse');
      else header.removeAttribute('data-surface');
      if (y > last && y > 220 && Math.abs(y - last) > 12) header.classList.add('is-hidden');
      else if (y < last) header.classList.remove('is-hidden');
      document.documentElement.classList.toggle('header-hidden', header.classList.contains('is-hidden'));
      last = y;
    }
    function setMenu(open) {
      menuOpen = open;
      menu.classList.toggle('is-open', open);
      openBtn.setAttribute('aria-expanded', String(open));
      document.body.style.overflow = open ? 'hidden' : '';
      document.documentElement.classList.toggle('menu-open', open);
      (open ? closeBtn : openBtn).focus();
      update();
    }
    openBtn.addEventListener('click', () => setMenu(true));
    closeBtn.addEventListener('click', () => setMenu(false));
    $$('a', menu).forEach((a) => a.addEventListener('click', () => setMenu(false)));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && menuOpen) setMenu(false);
    });
    window.addEventListener('scroll', update, { passive: true });
    update();
  }

  /* ---------------------------------------------------------------------------
     MOTION: SplitText, Reveal, ImageMask, hero + parallax
     ------------------------------------------------------------------------ */
  function splitWords(el) {
    const text = el.textContent.trim();
    el.setAttribute('aria-label', text);
    el.innerHTML = text
      .split(/(\s+)/)
      .map((unit, i) =>
        /^\s+$/.test(unit) ? ' ' : `<span class="split-word" aria-hidden="true"><span style="--i:${Math.floor(i / 2)}">${esc(unit)}</span></span>`,
      )
      .join('');
  }

  let io = null;
  function observeMotion(root = document) {
    if (!motionSafe) return;
    const targets = $$('.split:not([data-mount]):not(.is-in), .reveal:not(.is-in):not(.is-mount), .mask:not(.is-in):not(.is-mount)', root);
    if (!('IntersectionObserver' in window)) return targets.forEach((el) => el.classList.add('is-in'));
    if (!io) {
      io = new IntersectionObserver(
        (entries) =>
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-in');
              io.unobserve(entry.target);
            }
          }),
        { rootMargin: '0px 0px -12% 0px' },
      );
    }
    targets.forEach((el) => io.observe(el));
  }

  /**
   * Shop, info, checkout and 404 pages get the same entrance as the homepage:
   * the heading rises word by word, the rest fades up as it scrolls into view.
   */
  function autoMotion() {
    const main = $('#main');
    if (!motionSafe || !main || PAGE === 'home' || PAGE === 'lookbook') return;
    const h1 = $('h1', main);
    if (h1 && !h1.classList.contains('split') && !h1.children.length) {
      h1.classList.add('split');
      h1.dataset.split = '';
      h1.dataset.mount = '';
      h1.style.setProperty('--delay', '0.08s');
    }
    const tag = (el, delay, distance) => {
      if (el.classList.contains('reveal') || el.closest('.reveal')) return;
      el.classList.add('reveal');
      el.style.setProperty('--distance', distance);
      if (delay) el.style.setProperty('--delay', delay);
    };
    $$('.crumbs, .shop-lede, .eyebrow', main).forEach((el, i) => tag(el, `${(0.12 + i * 0.05).toFixed(2)}s`, '12px'));
    $$('.info-aside, .checkout-summary, .shop-tools, .chips', main).forEach((el) => tag(el, '0.2s', '16px'));
    $$('.prose > *, .contact-card, .checkout-form > *', main).forEach((el) => tag(el, '', '16px'));
  }

  function initMotion() {
    autoMotion();
    $$('[data-split]').forEach(splitWords);
    if (!motionSafe) return;
    requestAnimationFrame(() => requestAnimationFrame(() => $$('[data-mount], .is-mount').forEach((el) => el.classList.add('is-in'))));
    observeMotion();
  }

  function initScrollEffects() {
    if (!motionSafe) return;
    const hero = $('#hero');
    const media = $('#hero-media');
    const copy = $('#hero-copy');
    const scrim = $('#hero-scrim');
    const cue = $('#hero-slides-ui');
    const parallaxEls = $$('[data-parallax]');
    if (!hero && !parallaxEls.length) return;
    let ticking = false;
    function frame() {
      ticking = false;
      const vh = window.innerHeight;
      if (hero) {
        const h = hero.offsetHeight || 1;
        const pr = Math.min(Math.max(-hero.getBoundingClientRect().top / h, 0), 1);
        media.style.transform = `translate3d(0, ${pr * 18}%, 0)`;
        copy.style.transform = `translate3d(0, ${pr * 46}%, 0)`;
        const fade = Math.max(0, 1 - pr / 0.65);
        copy.style.opacity = fade;
        if (cue) cue.style.opacity = fade;
        scrim.style.opacity = 0.42 + pr * 0.24;
      }
      parallaxEls.forEach((el) => {
        const box = el.parentElement.getBoundingClientRect();
        if (box.bottom < 0 || box.top > vh) return;
        const distance = Number(el.dataset.parallax) || 40;
        const progress = (box.top + box.height / 2 - vh / 2) / (vh / 2 + box.height / 2);
        el.style.transform = `translate3d(0, ${(-progress * distance).toFixed(1)}px, 0)`;
      });
    }
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(frame);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    frame();
  }

  /**
   * Lookbook (Nehta's LookbookExperience): a hairline progress bar across the top,
   * and the chapter rail on the right marking the look in the middle of the screen.
   */
  function initLookbook() {
    const book = $('.lookbook');
    if (!book) return;
    const bar = $('#lookbook-progress');
    const rail = $('.lookbook-rail');
    const looks = $$('[data-look]', book);
    const cover = $('.lookbook-cover', book);
    if (bar && motionSafe) {
      let ticking = false;
      const frame = () => {
        ticking = false;
        const max = book.offsetHeight - window.innerHeight;
        const pr = max > 0 ? Math.min(1, Math.max(0, -book.getBoundingClientRect().top / max)) : 0;
        bar.style.transform = `scaleX(${pr.toFixed(4)})`;
        if (rail && cover) rail.classList.toggle('is-shown', cover.getBoundingClientRect().bottom < window.innerHeight * 0.5);
      };
      window.addEventListener('scroll', () => {
        if (!ticking) {
          ticking = true;
          requestAnimationFrame(frame);
        }
      }, { passive: true });
      frame();
    } else if (rail) rail.classList.add('is-shown');
    if (!rail || !looks.length || !('IntersectionObserver' in window)) return;
    const links = $$('a', rail);
    const spy = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const i = Number(e.target.dataset.look);
      links.forEach((a, j) => (j === i ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current')));
    }), { rootMargin: '-45% 0px -45% 0px' });
    looks.forEach((el) => spy.observe(el));
  }

  /**
   * Smooth wheel scrolling, Lenis's feel (Nehta's SmoothScroll: 1.1 s, exponential
   * ease-out). Mouse wheels and trackpads only; touch keeps the phone's own
   * scrolling, and visitors who ask for reduced motion get the browser's default.
   */
  function initSmoothScroll() {
    if (!motionSafe || window.matchMedia('(pointer: coarse)').matches) return;
    const DURATION = 1100;
    const ease = (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t));
    let target = window.scrollY;
    let from = target;
    let start = 0;
    let raf = 0;
    let running = false;
    const maxY = () => document.documentElement.scrollHeight - window.innerHeight;
    function step(now) {
      const t = Math.min(1, (now - start) / DURATION);
      window.scrollTo({ top: from + (target - from) * ease(t), behavior: 'instant' });
      if (t < 1) raf = requestAnimationFrame(step);
      else running = false;
    }
    function scrollsItself(el) {
      for (; el && el !== document.body && el !== document.documentElement; el = el.parentElement) {
        if (el.scrollHeight > el.clientHeight + 1) {
          const o = getComputedStyle(el).overflowY;
          if (o === 'auto' || o === 'scroll') return true;
        }
      }
      return false;
    }
    window.addEventListener('wheel', (e) => {
      if (e.ctrlKey || e.defaultPrevented || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      if (document.body.style.overflow === 'hidden' || scrollsItself(e.target)) return;
      e.preventDefault();
      let d = e.deltaY;
      if (e.deltaMode === 1) d *= 40;
      else if (e.deltaMode === 2) d *= window.innerHeight;
      if (!running) target = window.scrollY;
      target = Math.max(0, Math.min(maxY(), target + d));
      from = window.scrollY;
      start = performance.now();
      if (!running) {
        running = true;
        raf = requestAnimationFrame(step);
      }
    }, { passive: false });
    // Keys, the scrollbar, links to #anchors and touch take over straight away.
    const stop = () => {
      if (running) {
        cancelAnimationFrame(raf);
        running = false;
      }
    };
    ['keydown', 'mousedown', 'touchstart'].forEach((ev) => window.addEventListener(ev, stop, { passive: true }));
    document.addEventListener('click', (e) => {
      if (e.target.closest && e.target.closest('a[href*="#"]')) stop();
    });
  }

  /**
   * Homepage hero: the emblem render and three of Hadi's pieces cross-fade every few seconds.
   * Pictures after the first load only when their turn is near. It pauses while the hero is off
   * screen or the tab is hidden, and never moves on its own for visitors who asked for less motion
   * (the bars still switch pictures).
   */
  function initHeroSlides() {
    const media = $('#hero-media');
    const ui = $('#hero-slides-ui');
    if (!media || !ui) return;
    const slides = $$('.hero-slide', media);
    const bars = $$('.hero-bar', ui);
    const caption = $('#hero-caption');
    if (slides.length < 2) return;
    const MS = 6500;
    ui.style.setProperty('--slide-ms', MS + 'ms');
    let cur = 0;
    let timer = 0;
    let visible = true;

    const load = (slide) => {
      const img = $('img', slide);
      if (img && img.dataset.src) {
        if (img.dataset.srcset) img.srcset = img.dataset.srcset;
        img.src = img.dataset.src;
        delete img.dataset.src;
        delete img.dataset.srcset;
      }
      return img;
    };
    const ready = (img) => (!img || img.complete ? Promise.resolve() : new Promise((r) => { img.onload = img.onerror = r; }));
    const label = (slide) => (slide.dataset.href
      ? `<span class="hero-caption-pre">In the photo: </span><a href="${esc(slide.dataset.href)}">${esc(slide.dataset.caption)}</a>`
      : esc(slide.dataset.caption || ''));

    function play() {
      clearTimeout(timer);
      const on = motionSafe && visible && !document.hidden;
      ui.classList.toggle('is-playing', on);
      if (on) timer = setTimeout(() => show(cur + 1), MS);
    }
    async function show(i) {
      i = (i + slides.length) % slides.length;
      clearTimeout(timer);
      await ready(load(slides[i]));
      slides.forEach((s, j) => s.classList.toggle('is-active', j === i));
      bars.forEach((b, j) => {
        b.classList.toggle('is-active', j === i);
        if (j === i) b.setAttribute('aria-current', 'true');
        else b.removeAttribute('aria-current');
      });
      ui.classList.remove('is-playing');
      void ui.offsetWidth; // restart the progress line on the new bar
      caption.innerHTML = label(slides[i]);
      cur = i;
      load(slides[(i + 1) % slides.length]); // fetch the next one in good time
      play();
    }

    bars.forEach((b, j) => b.addEventListener('click', () => show(j)));
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => { visible = e.isIntersecting; play(); }).observe($('#hero'));
    }
    document.addEventListener('visibilitychange', play);
    caption.innerHTML = label(slides[0]);
    // the second picture loads once the page has settled
    window.addEventListener('load', () => load(slides[1]), { once: true });
    play();
  }

  /* ---------------------------------------------------------------------------
     LIVE CHAT, HaloChime widget, switched on from the admin's settings
     ------------------------------------------------------------------------ */
  function initChat() {
    // the AI assistant only when switched on in the admin; "Chat with us" (support.js) is always there
    if (S.chat_ai !== '1' || !S.chat_key || !/^https:\/\//.test(S.chat_src || '')) return;
    // "Talk to a person" inside HaloChime ends the AI chat and opens our own chat (support.js),
    // which lands in the admin's Support inbox.
    window.Halochime = window.Halochime || { q: [] };
    (window.Halochime.q = window.Halochime.q || []).push(['setSwitch', {
      label: 'Talk to a person',
      onSelect: () => window.DSSupport && window.DSSupport.open(),
    }]);
    const s = document.createElement('script');
    s.src = S.chat_src;
    s.async = true;
    s.dataset.key = S.chat_key;
    document.body.appendChild(s);
  }

  /* ---------------------------------------------------------------------------
     FORGE-EMBER CURSOR: a glowing ember instead of the arrow, faint sparks when
     the mouse moves fast, a small burst on click. Desktop mice only: touch
     screens and "reduce motion" keep the normal cursor, and typing fields keep
     the text cursor.
     ------------------------------------------------------------------------ */
  function initEmberCursor() {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const TYPING = 'input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="submit"]):not([type="button"]), textarea, select, [contenteditable=""], [contenteditable="true"]';
    const HOT = 'a, button, [role="button"], label, summary, [data-cursor-hot]';
    const ember = document.createElement('div');
    ember.className = 'ember-cursor';
    ember.setAttribute('aria-hidden', 'true');
    ember.appendChild(document.createElement('span'));
    const canvas = document.createElement('canvas');
    canvas.className = 'ember-sparks';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.append(canvas, ember);
    document.documentElement.classList.add('has-ember-cursor');

    const ctx = canvas.getContext('2d');
    let sparks = [];
    let running = false;
    let lastX = null;
    let lastY = null;
    let visible = false;
    function size() {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(innerWidth * dpr);
      canvas.height = Math.round(innerHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    size();
    window.addEventListener('resize', size, { passive: true });

    function show(on) {
      if (on === visible) return;
      visible = on;
      ember.classList.toggle('is-on', on);
    }
    function spawn(x, y, n, power) {
      for (let i = 0; i < n && sparks.length < 160; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = (0.4 + Math.random() * 1.6) * power;
        sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.6 * power, life: 1, r: 0.6 + Math.random() * 1.1 });
      }
      if (!running) {
        running = true;
        requestAnimationFrame(frame);
      }
    }
    // The spark layer only animates while sparks are alive, then goes quiet.
    function frame() {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      sparks = sparks.filter((p) => p.life > 0);
      for (const p of sparks) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy -= 0.02;
        p.vx *= 0.97;
        p.life -= 0.028;
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.life > 0.5 ? '#ffd08a' : '#e07a35';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (sparks.length) requestAnimationFrame(frame);
      else running = false;
    }

    document.addEventListener('mousemove', (e) => {
      const x = e.clientX;
      const y = e.clientY;
      const t = e.target instanceof Element ? e.target : null;
      const typing = !!(t && t.closest(TYPING));
      show(!typing);
      ember.classList.toggle('is-hot', !typing && !!(t && t.closest(HOT)));
      ember.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      if (lastX !== null && !typing) {
        const speed = Math.hypot(x - lastX, y - lastY);
        if (speed > 16) spawn(x, y, Math.min(3, Math.floor(speed / 16)), 0.6);
      }
      lastX = x;
      lastY = y;
    }, { passive: true });
    document.addEventListener('mouseout', (e) => {
      if (!e.relatedTarget) show(false);
    });
    window.addEventListener('blur', () => show(false));
    document.addEventListener('mousedown', (e) => {
      if (e.button !== 0 || !visible) return;
      ember.classList.add('is-press');
      spawn(e.clientX, e.clientY, 14, 2.2);
    });
    document.addEventListener('mouseup', () => ember.classList.remove('is-press'));
  }

  /* ---------------------------------------------------------------------------
     HOMEPAGE INTRO: the logo-reveal film. index.html decides whether to show it
     (adds html.has-intro); here it plays, then fades into the page and hands over
     to the header wordmark's own entrance. Never blocks the page: it gives up if
     the video can't start within 3 seconds, and ends after 8 at most (the film is 5).
     ------------------------------------------------------------------------ */
  function initIntro(after) {
    const box = $('#intro');
    const video = $('#intro-video');
    if (!box || !video || !document.documentElement.classList.contains('has-intro')) {
      after();
      return;
    }
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      box.classList.add('is-leaving');
      document.documentElement.classList.remove('has-intro');
      setTimeout(() => {
        box.remove();
        after();
      }, 700);
    };
    $('#intro-skip').addEventListener('click', finish);
    // the film ends on the finished logo: start fading into the page just before the last frame
    video.addEventListener('timeupdate', () => { if (video.duration && video.duration - video.currentTime < 0.3) finish(); });
    video.addEventListener('ended', finish);
    video.addEventListener('error', finish);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') finish(); });
    const start = setTimeout(() => { if (video.currentTime < 0.1) finish(); }, 3000);
    video.addEventListener('playing', () => clearTimeout(start), { once: true });
    setTimeout(finish, 8000);
    const p = video.play();
    if (p && p.catch) p.catch(finish);
  }

  /* ---------------------------------------------------------------------------
     WORDMARK ENTRANCE: the medallion turns in, "Dragon Spring" draws together from
     wide spacing, a gold glint runs across it and "Swords" opens between two rules.
     Once per visit; hovering the logo replays the glint.
     ------------------------------------------------------------------------ */
  function initWordmarkIntro() {
    const marks = $$('.site-header .wordmark');
    if (!marks.length || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let seen = false;
    try {
      seen = sessionStorage.getItem('ds-wordmark-seen') === '1';
      sessionStorage.setItem('ds-wordmark-seen', '1');
    } catch (e) { /* storage blocked: play it */ }
    if (seen) return;
    marks.forEach((m) => {
      m.classList.add('is-intro');
      setTimeout(() => m.classList.remove('is-intro'), 3200);
    });
  }

  /* ---------------------------------------------------------------------------
     VISITOR STATS: one small ping per page for the admin's Visitors page, plus one
     when someone taps Order on WhatsApp or Email to order. No cookies; the server
     turns the connection into an anonymous code. ?notrack=1 stops counting this
     device (the shop owner's own browsing), ?notrack=0 starts it again.
     ------------------------------------------------------------------------ */
  function initVisits() {
    const q = new URLSearchParams(location.search);
    try {
      if (q.has('notrack')) {
        if (q.get('notrack') === '0') localStorage.removeItem('ds-notrack');
        else localStorage.setItem('ds-notrack', '1');
      }
      if (localStorage.getItem('ds-notrack') === '1') return;
    } catch (e) { /* storage blocked: count as usual */ }
    if (navigator.webdriver || !window.JSON) return;
    const send = (data) => {
      const body = JSON.stringify(data);
      try {
        if (navigator.sendBeacon && navigator.sendBeacon('/api/visit', body)) return;
      } catch (e) { /* fall back to fetch */ }
      if (window.fetch) fetch('/api/visit', { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'text/plain' } }).catch(() => {});
    };
    send({ k: 'view', p: location.pathname, s: q.get('p') || '', r: document.referrer || '', u: q.get('utm_source') || '' });
    document.addEventListener('click', (e) => {
      const a = e.target.closest && e.target.closest('#order-wa, #order-mail');
      if (a) send({ k: 'ask', p: location.pathname, c: a.id === 'order-wa' ? 'whatsapp' : 'email' });
    }, true);
  }

  /* ---------------------------------------------------------------------------
     BOOT
     ------------------------------------------------------------------------ */
  renderLayout();
  initIntro(initWordmarkIntro);
  initCurrencyPickers();
  if (PAGE === 'home') renderHome();
  if (PAGE === 'shop') renderShop();
  if (PAGE === 'product') renderProduct();
  if (PAGE === 'info') renderInfo();
  mountNewsletters();
  initReviewForm();
  updatePrices();
  initAnnouncement();
  initHeader();
  initMotion();
  initScrollEffects();
  initHeroSlides();
  initLookbook();
  initEmberCursor();
  initVisits();
  // initSmoothScroll() is kept but switched off: JS-driven wheel scrolling runs on the
  // main thread and stuttered on the homepage; the browser's own scrolling stays smooth.
  initChat();
})();
