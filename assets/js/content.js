/**
 * DRAGON SPRING SWORDS — permanent design content.
 *
 * Only the parts of the page that belong to the design live here: the
 * scrolling strip, the forge photos, and fallback category tiles used when
 * the page is opened without the server.
 *
 * Products, product photos, reviews, info pages and contact details are
 * managed by the owner in the admin and arrive from /catalog.js.
 */
window.DRAGONSPRING = {
  marquee: [
    'Hand-sharpened before it ships',
    'Insured delivery worldwide',
    'Free resharpening for life',
    'Blades sold to buyers 18+ only',
  ],

  categories: [
    { name: 'Katanas', slug: 'katanas', count: 0, unit: 'blades', image: 'assets/img/category-katanas.jpg' },
    { name: 'Swords', slug: 'swords', count: 0, unit: 'blades', image: 'assets/img/category-swords.jpg' },
    { name: 'Kitchen & Cutlery', slug: 'kitchen-cutlery', count: 0, unit: 'pieces', image: 'assets/img/category-kitchen.jpg' },
  ],

  products: [],

  forge: [
    { title: 'Shaping at the anvil', stage: 'Stage 01', image: 'assets/img/forge-anvil.jpg' },
    { title: 'Quench and temper', stage: 'Stage 02', image: 'assets/img/forge-quench.jpg' },
    { title: 'Embers before dawn', stage: 'Stage 03', image: 'assets/img/forge-embers.jpg' },
  ],

  // Reviews come only from the admin (verified orders, approved by the owner).
  testimonials: [],
};
