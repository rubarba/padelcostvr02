/**
 * PadelCost - Merge de Ofertas
 * ----------------------------
 * Junta dados normalizados por loja ao catálogo principal, acrescentando
 * ofertas em stores[] quando encontra correspondência segura.
 *
 * Estratégia:
 * 1. Match por EAN
 * 2. Fallback por assinatura normalizada do nome (apenas quando o match é único)
 *
 * Uso:
 *   node merge-offers.js
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.resolve(__dirname, '../data');
const MAIN_FILE = path.join(DATA_DIR, 'products-data.js');
const ADIDAS_FILE = path.join(DATA_DIR, 'adidas-padel-data.js');
const PADEL_MARKET_FILE = path.join(DATA_DIR, 'padel-market-data.js');

const SAFE_ADIDAS_NAME_MAP = new Map([
  ['raquetes::raquete de padel adidas metalbone 2026 ale galan', 'Pala de pádel adidas metalbone 2026 ale galán preto/vermelho'],
  ['raquetes::raquete de padel adidas metalbone hrd 2026 ale galan', 'Pala de pádel adidas metalbone hrd+ 2026 ale galán preto/vermelho'],
  ['raquetes::raquete de padel adidas metalbone ctrl 2026', 'Pala de pádel adidas metalbone ctrl 2026 preto/laranja'],
  ['raquetes::raquete de padel adidas metalbone carbon 2026', 'Pala de pádel adidas metalbone carbon 2026 preto/vermelho'],
  ['raquetes::raquete de padel adidas metalbone carbon ctrl 2026', 'Pala de pádel adidas metalbone carbon ctrl 2026 branco/preto'],
  ['raquetes::raquete de padel adidas metalbone superlight 2026', 'Pala de pádel adidas metalbone superlight preto/vermelho'],
  ['raquetes::raquete de padel adidas metalbone team 2026', 'Pala de pádel adidas metalbone team 2026 preto/vermelho'],
  ['raquetes::raquete de padel adidas metalbone team light 2026', 'Pala de pádel adidas metalbone team light 2026 preto/branco'],
  ['raquetes::raquete de padel adidas drive blue 2026', 'Pala de pádel adidas drive blue 2026 azul/lima'],
  ['raquetes::raquete de padel adidas drive light 2026', 'Pala de pádel adidas drive light 2026 branco/laranja'],
  ['raquetes::raquete de padel adidas match black 2026', 'Pala de pádel adidas match 2026 preto/laranja'],
  ['sapatilhas::sapatilhas de padel adidas crazyquick ls w', 'Sapatilhas adidas crazyquick ls padel mulher rosa'],
  ['raquetes::raquete adidas cross it 3 4', 'Pala pádel adidas da cross it 3.4 preto/laranja'],
  ['raquetes::raquete adidas cross it ctrl 3 4', 'Pala pádel adidas da cross it ctrl 3.4 preto/lima'],
  ['raquetes::raquete de padel adidas cross it light 2026 martita ortega', 'Pala de pádel adidas crossit light 2026 rosa/prata'],
  ['raquetes::raquete de padel adidas cross it team ctrl 2026', 'Pala de pádel adidas crossit team ctrl 2026 preto/branco'],
  ['sapatilhas::sapatilhas de padel adidas courtquick m azul vermelho', 'Sapatilhas de pádel adidas courtquick homem azul'],
  ['sapatilhas::sapatilhas de padel adidas courtquick m branco vermelho', 'Sapatilhas de pádel adidas courtquick homem branco'],
  ['sapatilhas::sapatilhas de padel adidas crazyquick boost m', 'Sapatilhas de tênis adidas crazyquick boost padel homem branco/ p'],
  ['sapatilhas::sapatilhas de padel adidas crazyquick ls m', 'Sapatilhas de pádel adidas crazyquick ls homem branco'],
  ['sacos::saco para raquetes adidas control blue 2026', 'Paletero de pádel adidas racket bag control blue 2026 azul/rosa'],
  ['sacos::saco para raquetes adidas control white 2026', 'Paletero de pádel adidas racket bag control branco 2026 branco/la'],
  ['sacos::saco para raquetes adidas control black 2026', 'Paletero de pádel adidas racket bag control preto 2026 preto/azul'],
  ['sacos::saco para raquetes adidas control verde 3 4', 'Mochila pádel adidas da racket bag control 3.4 verde'],
  ['sacos::saco para raquetes adidas pro tour pink martita ortega 2026', 'Paletero de pádel adidas racket bag protour 2026 martita ortega r'],
  ['sacos::saco para raquetes adidas pro tour bronze 2026', 'Paletero de pádel adidas racket bag tour bronze 2026 bronze/laran'],
  ['sacos::saco para raquetes adidas pro tour silver grey 2026', 'Paletero de pádel adidas racket bag tour silver 2026 prata/lima'],
  ['bolas::bolas adidas speed rx', 'Bolas de pádel adidas balls speed rx'],
  ['acessorios::set of padel overgrip 3 units', 'Overgrip de pádel adidas set de overgrip 3 unidades'],
]);

const REJECTED_ADIDAS_KEYS = new Set([
  'sapatilhas::sapatilhas de padel adidas crazyquick ls m',
  'sapatilhas::sapatilhas de padel adidas crazyquick ls w::marrom',
  'sapatilhas::sapatilhas de padel adidas crazyquick ls m::branco',
]);

function extractWindowData(filePath, variableName) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const prefix = `window.${variableName} = `;
  const jsonText = raw.split(prefix)[1].replace(/;\s*$/, '');
  return JSON.parse(jsonText);
}

function normalizeText(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/protour/g, 'pro tour')
    .replace(/multijogo/g, 'multigame')
    .replace(/racketbag/g, 'racket bag')
    .replace(/offbranco/g, 'off white')
    .replace(/\+/g, ' plus ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const STOPWORDS = new Set([
  'de', 'da', 'do', 'para', 'com', 'e', 'o', 'a', 'um', 'uma', 'the', 'by', 'por',
  'padel', 'pa', 'pala', 'palas', 'raquete', 'raquetes',
  'sapatos', 'sapatilhas', 'tenis',
  'bolsa', 'mochila', 'paletero', 'saco', 'sacos', 'bag', 'backpack', 'racket',
]);

function signature(name) {
  return normalizeText(name)
    .split(' ')
    .filter(token => token && !STOPWORDS.has(token) && token.length > 1)
    .join(' ');
}

const STORE_PRIORITY = {
  'Padel Market': 0,
  'Adidas Padel': 1,
  'Atmosfera Sport': 2,
};

function compareStores(a, b) {
  const priceDiff = a.price - b.price;
  if (priceDiff !== 0) return priceDiff;

  const priorityA = STORE_PRIORITY[a.name] ?? 99;
  const priorityB = STORE_PRIORITY[b.name] ?? 99;
  if (priorityA !== priorityB) return priorityA - priorityB;

  return (a.name || '').localeCompare(b.name || '');
}

function addStoreToProduct(product, offer) {
  const existing = product.stores.find(store => store.name === offer.stores[0].name);
  if (existing) return false;

  product.stores.push(offer.stores[0]);
  product.stores.sort(compareStores);
  product.price = product.stores[0].price;
  return true;
}

function mergeProductData(product, offer) {
  if (!product.image && offer.image) {
    product.image = offer.image;
    product.imageSource = offer.source || product.imageSource || product.source || null;
  }

  const preferBetterAffiliateImage =
    (offer.source === 'padel-market' || offer.source === 'adidas-padel') &&
    offer.image &&
    (product.source === 'atmosfera-sport' || product.imageSource === 'atmosfera-sport' || !product.imageSource);

  if (preferBetterAffiliateImage) {
    product.image = offer.image;
    product.imageSource = offer.source;
  }

  if (!product.ean && offer.ean) {
    product.ean = offer.ean;
  }

  if (!product.productGTIN && offer.productGTIN) {
    product.productGTIN = offer.productGTIN;
  }

  if (!product.mpn && offer.mpn) {
    product.mpn = offer.mpn;
  }

  if (!product.sourceCategory && offer.sourceCategory) {
    product.sourceCategory = offer.sourceCategory;
  }

  const targetSpecs = product.specs || {};
  const sourceSpecs = offer.specs || {};
  for (const key of ['peso', 'forma', 'equilibrio', 'nivel', 'material', 'estilo', 'sola', 'genero', 'cor', 'uso', 'amortecimento']) {
    if ((targetSpecs[key] === null || targetSpecs[key] === undefined || targetSpecs[key] === '') && sourceSpecs[key]) {
      targetSpecs[key] = sourceSpecs[key];
    }
  }
  product.specs = targetSpecs;
}

function nextProductId(products) {
  return products.reduce((max, product) => Math.max(max, Number(product.id) || 0), 0) + 1;
}

function createProductFromOffer(offer, id) {
  return {
    id,
    name: offer.name || '',
    brand: offer.brand || '',
    category: offer.category || 'acessorios',
    price: offer.price ?? null,
    oldPrice: offer.oldPrice ?? null,
    rating: offer.rating ?? null,
    badge: offer.badge ?? null,
    image: offer.image || '',
    ean: offer.ean || null,
    productGTIN: offer.productGTIN || null,
    mpn: offer.mpn || null,
    source: offer.source || 'adidas-padel',
    imageSource: offer.source || 'adidas-padel',
    sourceProductId: offer.sourceProductId || null,
    sourceCategory: offer.sourceCategory || null,
    specs: {
      peso: offer.specs?.peso ?? null,
      forma: offer.specs?.forma ?? null,
      equilibrio: offer.specs?.equilibrio ?? null,
      nivel: offer.specs?.nivel ?? null,
      material: offer.specs?.material ?? null,
      estilo: offer.specs?.estilo ?? null,
      sola: offer.specs?.sola ?? null,
      genero: offer.specs?.genero ?? null,
      cor: offer.specs?.cor ?? null,
      uso: offer.specs?.uso ?? null,
      amortecimento: offer.specs?.amortecimento ?? null,
    },
    stores: [...(offer.stores || [])],
  };
}

function buildIndex(products) {
  const byEan = new Map();
  const byGtin = new Map();
  const byMpn = new Map();
  const bySignature = new Map();
  const byName = new Map();

  for (const product of products) {
    if (product.ean) {
      byEan.set(`${product.category}::${product.ean}`, product);
    }
    if (product.productGTIN) {
      byGtin.set(`${product.category}::${product.productGTIN}`, product);
    }
    if (product.mpn) {
      byMpn.set(`${product.category}::${normalizeText(product.mpn)}`, product);
    }

    const sig = signature(product.name);
    if (!sig) continue;
    const key = `${product.category}::${sig}`;
    if (!bySignature.has(key)) bySignature.set(key, []);
    bySignature.get(key).push(product);
    byName.set(`${product.category}::${normalizeText(product.name)}`, product);
  }

  return { byEan, byGtin, byMpn, bySignature, byName };
}

function processOffers({
  label,
  offers,
  products,
  indexes,
  safeNameMap = new Map(),
  rejectedKeys = new Set(),
  allowSignatureMatch = true,
  counters,
  nextIdRef,
}) {
  const { byEan, byGtin, byMpn, bySignature, byName } = indexes;

  for (const offer of offers) {
    const offerKey = `${offer.category}::${normalizeText(offer.name)}`;
    if (rejectedKeys.has(offerKey)) {
      counters.skipped += 1;
      continue;
    }

    let target = null;

    if (offer.ean) {
      target = byEan.get(`${offer.category}::${offer.ean}`) || null;
      if (target) counters.matchesByEan += 1;
    }

    if (!target && offer.productGTIN) {
      target = byGtin.get(`${offer.category}::${offer.productGTIN}`) || null;
      if (target) counters.matchesByGtin += 1;
    }

    if (!target && offer.mpn) {
      target = byMpn.get(`${offer.category}::${normalizeText(offer.mpn)}`) || null;
      if (target) counters.matchesByMpn += 1;
    }

    if (!target) {
      const explicitTarget = safeNameMap.get(offerKey);
      if (explicitTarget) {
        target = byName.get(`${offer.category}::${normalizeText(explicitTarget)}`) || null;
        if (target) counters.mapped += 1;
      }
    }

    if (!target && allowSignatureMatch) {
      const sig = signature(offer.name);
      const matches = bySignature.get(`${offer.category}::${sig}`) || [];
      if (matches.length === 1) {
        target = matches[0];
        if (target) counters.matchesBySignature += 1;
      }
    }

    if (!target) {
      const newProduct = createProductFromOffer(offer, nextIdRef.value++);
      products.push(newProduct);
      counters.addedAsNewProducts += 1;

      if (newProduct.ean) byEan.set(`${newProduct.category}::${newProduct.ean}`, newProduct);
      if (newProduct.productGTIN) byGtin.set(`${newProduct.category}::${newProduct.productGTIN}`, newProduct);
      if (newProduct.mpn) byMpn.set(`${newProduct.category}::${normalizeText(newProduct.mpn)}`, newProduct);
      const newSig = signature(newProduct.name);
      if (newSig) {
        const sigKey = `${newProduct.category}::${newSig}`;
        if (!bySignature.has(sigKey)) bySignature.set(sigKey, []);
        bySignature.get(sigKey).push(newProduct);
      }
      byName.set(`${newProduct.category}::${normalizeText(newProduct.name)}`, newProduct);
      continue;
    }

    mergeProductData(target, offer);
    if (addStoreToProduct(target, offer)) {
      counters.merged += 1;
    }
  }

  console.log(`   ${label}: ${offers.length} ofertas processadas`);
}

function main() {
  const products = extractWindowData(MAIN_FILE, 'PADELCOST_PRODUCTS');
  const adidas = extractWindowData(ADIDAS_FILE, 'PADELCOST_ADIDAS_PRODUCTS');
  const padelMarket = fs.existsSync(PADEL_MARKET_FILE)
    ? extractWindowData(PADEL_MARKET_FILE, 'PADELCOST_PADEL_MARKET_PRODUCTS')
    : [];
  const indexes = buildIndex(products);

  const counters = {
    merged: 0,
    skipped: 0,
    mapped: 0,
    matchesByEan: 0,
    matchesByGtin: 0,
    matchesByMpn: 0,
    matchesBySignature: 0,
    addedAsNewProducts: 0,
  };
  const nextIdRef = { value: nextProductId(products) };

  processOffers({
    label: 'Adidas Padel',
    offers: adidas,
    products,
    indexes,
    safeNameMap: SAFE_ADIDAS_NAME_MAP,
    rejectedKeys: REJECTED_ADIDAS_KEYS,
    allowSignatureMatch: true,
    counters,
    nextIdRef,
  });

  if (padelMarket.length > 0) {
    processOffers({
      label: 'Padel Market',
      offers: padelMarket,
      products,
      indexes,
      allowSignatureMatch: false,
      counters,
      nextIdRef,
    });
  }

  const now = new Date().toISOString();
  const content = [
    `// PadelCost - Catálogo gerado automaticamente`,
    `// Gerado em: ${now}`,
    `// Produtos: ${products.length}`,
    `// Merge lojas: ${counters.merged} ofertas integradas, ${counters.skipped} por rever`,
    ``,
    `window.PADELCOST_PRODUCTS = ${JSON.stringify(products, null, 2)};`,
  ].join('\n');

  fs.writeFileSync(MAIN_FILE, content, 'utf8');

  console.log(`✅  Merge concluído`);
  console.log(`   Ofertas integradas: ${counters.merged}`);
  console.log(`   Matches por EAN: ${counters.matchesByEan}`);
  console.log(`   Matches por GTIN: ${counters.matchesByGtin}`);
  console.log(`   Matches por MPN: ${counters.matchesByMpn}`);
  console.log(`   Matches por mapa seguro: ${counters.mapped}`);
  console.log(`   Matches por assinatura: ${counters.matchesBySignature}`);
  console.log(`   Novos produtos de lojas adicionados: ${counters.addedAsNewProducts}`);
  console.log(`   Ofertas por rever: ${counters.skipped}`);
}

main();
