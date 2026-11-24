# Dragon Spring Swords — landing page

Katanas, swords, kitchen knives and cutlery. The design is ported from the
Nehta clothing storefront (`apps/storefront` in the Nehta repo): the same
colours, fonts (Bodoni Moda and Geist), animations and section order. The
Nehta code itself was not changed.

## Run it on localhost

Nothing needs to be installed. macOS already has Python.

- **Easiest:** double-click `start.command`. It opens http://localhost:8080.
- **Or in Terminal:**

  ```bash
  cd ~/Desktop/Hadi/dragonspringswords
  python3 -m http.server 8080
  ```

  Then open http://localhost:8080. Press `Ctrl + C` to stop.

## What's where

| File | What it holds |
|---|---|
| `index.html` | Page structure and fixed copy: hero, story, promises, newsletter, footer |
| `assets/js/content.js` | **Edit this for products, prices, categories, forge photos, testimonials and the scrolling strip** |
| `assets/css/styles.css` | Design tokens (colours, fonts, spacing) at the top, then each section |
| `assets/js/main.js` | Animations, header behaviour, mobile menu, newsletter form |
| `assets/img/` | All photos |

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
- Remove `<meta name="robots" content="noindex, nofollow">` from `index.html`
  so search engines can index the site.
- The newsletter form currently only shows a thank-you message. It is not
  connected to an email or WhatsApp service yet.
