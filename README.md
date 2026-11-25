# Dragon Spring Swords, landing page

Katanas, swords, kitchen knives and cutlery. The design is ported from the
Nehta clothing storefront (`apps/storefront` in the Nehta repo): the same
colours, fonts (Shippori Mincho and Zen Kaku Gothic New), animations and section order. The
Nehta code itself was not changed.

## Run it on localhost

Nothing needs to be installed. macOS already has Python.

- **Easiest:** double-click `start.command`. It opens http://localhost:8080 with the
  fallback content (no products). Press `Ctrl + C` in its window to stop.
- **With the real products:** run the admin app (admin repo README, "Run locally"); it
  serves this folder too.

Links are root-relative clean URLs (`/shop`, `/shop/katanas`, `/product/<slug>`,
`/page/<slug>`), so open the site through one of those servers, not by double-clicking
an `.html` file.

## What's where

| File | What it holds |
|---|---|
| `index.html` | Page structure and fixed copy: hero, story, promises, newsletter |
| `shop.html`, `product.html`, `page.html`, `404.html` | The other page shells |
| `assets/js/content.js` | **Edit this for products, prices, categories, forge photos, testimonials and the scrolling strip** |
| `assets/css/styles.css` | Design tokens (colours, fonts, spacing) at the top, then each section |
| `assets/js/main.js` | Animations, header behaviour, mobile menu, newsletter form |
| `assets/img/` | All photos |

## Server-rendered pages (SEO)

On the live site these HTML files are **templates**: the admin app's `store.py` fills them
before sending, so search engines get real titles, descriptions, product data and links.
It fills only the marked spots, so keep these markers when editing:

- `<!--seo--> … <!--/seo-->` in `<head>`: title, description, robots, canonical, Open Graph,
  JSON-LD. What is inside is only used when a file is opened on its own.
- `<div id="layout-top"></div>` and `<div id="layout-bottom"></div>`: header and footer.
- `<!--ssr:NAME--> … <!--/ssr:NAME-->`: page content (product grid, product page, …).

The server marks such pages with `<body data-ssr="1">`; `main.js` then keeps the server's
markup and only adds behaviour. If you change markup that `main.js` draws (product cards,
header, footer, product page), change the matching template in the admin repo's
`templates/store/` too.

## Products, photos and reviews

These are managed by Hadi in the admin (see the `dragonspringswords-admin` repo), not in
this repo. The storefront loads them from `/catalog.js` on the server.
`assets/js/content.js` only holds the fallback catalogue used when you open the page
without the server (for example with `start.command`).

## Deploying

From the admin repo on your Mac: `./deploy/deploy.sh` uploads this folder to the server.

## Before going live

- Reviews only come from verified orders approved in the admin; never add quotes by hand.
- Replace the **contact details** in the footer (`hello@dragonspringswords.com`,
  `+92 300 000 0000`) and the social links.
- Check the copy: the "12 days", "60+ HRC" and resharpening promises are
  placeholders until you confirm them.
- Search-engine indexing is switched on by the admin repo's `deploy/go-live.sh`
  (`DS_ALLOW_INDEXING=1`), not in these files.
- The newsletter form currently only shows a thank-you message. It is not
  connected to an email or WhatsApp service yet.
