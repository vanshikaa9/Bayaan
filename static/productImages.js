/**
 * Category-strict images. Each catalog product ID maps to a verified garment photo.
 */
const IMG = (id) =>
  `https://images.unsplash.com/photo-${id}?w=640&q=75&auto=format&fit=crop`;

const CATEGORY_IMAGES = {
  saree: [
    IMG('1595777457583-95e059d581b8'),
    IMG('1572470176170-98fa8abcb741'),
    IMG('1771507056578-f9675a2a8f8a'),
    IMG('1771654805161-442c6aab7b55')
  ],
  kurti: [
    IMG('1742800764280-d51117b7eb0a'),
    IMG('1766994063823-ed214f883548'),
    IMG('1745313452052-0e4e341f326c')
  ],
  'salwar suit': [
    IMG('1766994063823-ed214f883548'),
    IMG('1742800764280-d51117b7eb0a'),
    IMG('1745313452052-0e4e341f326c')
  ],
  lehenga: [
    IMG('1758985402638-6028bae83b98'),
    IMG('1771507056578-f9675a2a8f8a')
  ],
  dupatta: [
    IMG('1604709173412-77939383304f'),
    IMG('1572470176170-98fa8abcb741')
  ],
  jeans: [
    IMG('1541099649105-f69ad21f3246'),
    IMG('1542272604-787c3835535d')
  ],
  leggings: [
    IMG('1506629082955-511b1aa562c8')
  ],
  jacket: [
    IMG('1551028719-00167b16eac5'),
    IMG('1591047139829-d91aecb6caea')
  ],
  pajama: [
    IMG('1745313452052-0e4e341f326c'),
    IMG('1617137968427-85924c800a22')
  ],
  dress: [
    IMG('1594633312681-425c7b97ccd1')
  ],
  shirt: [
    IMG('1596755381012-68eb8039c826'),
    IMG('1572804013309-59a88b7e92f1')
  ]
};

/** Stable per-product image — keyed by catalog id */
const PRODUCT_IMAGE_BY_ID = {
  1: CATEGORY_IMAGES.kurti[0],
  2: CATEGORY_IMAGES.kurti[1],
  3: CATEGORY_IMAGES.kurti[2],
  4: CATEGORY_IMAGES['salwar suit'][0],
  5: CATEGORY_IMAGES['salwar suit'][1],
  6: CATEGORY_IMAGES.saree[0],
  7: CATEGORY_IMAGES.saree[1],
  8: CATEGORY_IMAGES.dupatta[0],
  9: CATEGORY_IMAGES.dupatta[1],
  10: CATEGORY_IMAGES.jeans[0],
  11: CATEGORY_IMAGES.jeans[1],
  12: CATEGORY_IMAGES.leggings[0],
  13: CATEGORY_IMAGES.lehenga[0],
  14: CATEGORY_IMAGES.pajama[0],
  15: CATEGORY_IMAGES.kurti[0],
  16: CATEGORY_IMAGES.kurti[2],
  17: CATEGORY_IMAGES.saree[2],
  18: CATEGORY_IMAGES.saree[3],
  19: CATEGORY_IMAGES.jacket[0],
  20: CATEGORY_IMAGES.dupatta[1]
};

const CATEGORY_ALIASES = {
  saari: 'saree', saaree: 'saree', sari: 'saree',
  kurta: 'kurti', kurtee: 'kurti',
  'salwar kameez': 'salwar suit', salwar: 'salwar suit',
  chunni: 'dupatta', lehnga: 'lehenga', ghagra: 'lehenga',
  pyjama: 'pajama', denim: 'jeans', coat: 'jacket', top: 'shirt'
};

const CATEGORY_KEYWORDS = [
  'salwar suit', 'salwar kameez', 'lehenga', 'saree', 'saari', 'kurti', 'kurta',
  'dupatta', 'leggings', 'jeans', 'jacket', 'pajama', 'dress', 'shirt'
];

const OCCASION_REASONS = {
  wedding: 'Elegant drape and rich fabric — ideal for bridal and wedding celebrations.',
  party: 'A festive pick for evenings out and special gatherings.',
  casual: 'Easy, everyday style without compromising on grace.',
  'daily wear': 'Comfort-first design built for all-day wear.',
  sleepwear: 'Soft fabrics chosen for restful comfort.',
  festive: 'Made to stand out at festivals and cultural occasions.',
  office: 'Polished look suited for professional settings.',
  traditional: 'Honours classic silhouettes and heritage craftsmanship.'
};

function normalizeCategory(raw) {
  const key = (raw || '').toLowerCase().trim();
  return CATEGORY_ALIASES[key] || key;
}

function getProductImage(product) {
  if (product.image_url || product.image) {
    return product.image_url || product.image;
  }

  if (product.id && PRODUCT_IMAGE_BY_ID[product.id]) {
    return PRODUCT_IMAGE_BY_ID[product.id];
  }

  const category = normalizeCategory(product.category);
  const pool = CATEGORY_IMAGES[category];
  if (!pool) {
    return CATEGORY_IMAGES.kurti[0];
  }
  return pool[(product.id || 0) % pool.length];
}

const ASPECT_CLASSES = ['tall', 'medium', 'short', 'tall', 'medium', 'short'];

function getAspectClass(index) {
  return ASPECT_CLASSES[index % ASPECT_CLASSES.length];
}

function getRecommendationReason(product) {
  const occasion = (product.occasion || '').toLowerCase();
  if (OCCASION_REASONS[occasion]) return OCCASION_REASONS[occasion];

  const fabric = product.fabric || 'quality fabric';
  const rating = product.rating ? `Rated ${product.rating}★` : 'Curated pick';
  return `${rating} — crafted in ${fabric} for your ${product.category || 'wardrobe'}.`;
}

function buildFashionInsight(products) {
  if (!products.length) return '';

  const fabrics = [...new Set(products.map(p => p.fabric).filter(Boolean))];
  const occasions = [...new Set(products.map(p => p.occasion).filter(Boolean))];

  if (!fabrics.length && !occasions.length) return '';

  let text = '';

  if (fabrics.length >= 2) {
    const last = fabrics[fabrics.length - 1];
    const rest = fabrics.slice(0, -1);
    text = `${rest.join(', ')} and ${last} dominate these recommendations`;
  } else if (fabrics.length === 1) {
    text = `${fabrics[0].charAt(0).toUpperCase() + fabrics[0].slice(1)} stands out across this selection`;
  }

  if (occasions.length) {
    const occ = occasions.slice(0, 3).join(' and ');
    text += text
      ? `, making them suitable for ${occ} occasions.`
      : `Well suited for ${occ} occasions.`;
  } else if (text) {
    text += '.';
  }

  return text;
}

function detectCategoryInQuery(query) {
  const q = query.toLowerCase();
  for (const kw of CATEGORY_KEYWORDS) {
    if (q.includes(kw)) return kw === 'kurta' ? 'kurti' : kw === 'saari' ? 'saree' : kw;
  }
  return null;
}

function insertOccasionInQuery(query, occasion) {
  const q = query.trim();
  const lower = q.toLowerCase();
  for (const kw of CATEGORY_KEYWORDS) {
    const idx = lower.indexOf(kw);
    if (idx !== -1) {
      return `${q.slice(0, idx)}${occasion} ${q.slice(idx)}`.replace(/\s+/g, ' ').trim();
    }
  }
  return `${q} ${occasion}`.trim();
}

function appendBudgetToQuery(query, amount) {
  return query.replace(/\s*under\s+₹?\d+/gi, '').trim() + ` under ${amount}`;
}

function appendColorToQuery(query, color) {
  const colors = ['red', 'blue', 'green', 'black', 'pink', 'white', 'yellow', 'orange'];
  let q = query.trim();
  colors.forEach(c => {
    q = q.replace(new RegExp(`\\b${c}\\b`, 'gi'), '');
  });
  return `${color} ${q}`.replace(/\s+/g, ' ').trim();
}
