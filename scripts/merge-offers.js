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
const { normalizeProductName } = require('./name-normalization');
const { normalizeBrand } = require('./brand-normalization');
const { isCategoryIntruder } = require('./category-rules');

const DATA_DIR = path.resolve(__dirname, '../data');
const MAIN_FILE = path.join(DATA_DIR, 'products-data.js');
const ADIDAS_FILE = path.join(DATA_DIR, 'adidas-padel-data.js');
const PADEL_MARKET_FILE = path.join(DATA_DIR, 'padel-market-data.js');
const PADEL_PROSHOP_FILE = path.join(DATA_DIR, 'padel-proshop-data.js');
const FORUM_SPORT_FILE = path.join(DATA_DIR, 'forum-sport-data.js');
const ZONA_DE_PADEL_FILE = path.join(DATA_DIR, 'zona-de-padel-data.js');

const MERGED_STORE_NAMES = new Set([
  'Adidas Padel',
  'Padel Market',
  'Padel Proshop PT',
  'Forum Sport ES',
  'Zona de Padel',
]);

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

function hasWord(text, word) {
  return text.split(' ').includes(word);
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
  'Padel Proshop PT': 3,
  'Forum Sport ES': 4,
  'Zona de Padel': 5,
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
  const incomingStore = offer.stores[0];
  const existing = product.stores.find(store => store.name === incomingStore.name);

  if (existing) {
    const changed =
      existing.price !== incomingStore.price ||
      existing.stock !== incomingStore.stock ||
      existing.url !== incomingStore.url ||
      existing.deliveryCost !== incomingStore.deliveryCost;

    existing.price = incomingStore.price;
    existing.stock = incomingStore.stock;
    existing.url = incomingStore.url;
    if (incomingStore.deliveryCost !== undefined) {
      existing.deliveryCost = incomingStore.deliveryCost;
    }

    product.stores.sort(compareStores);
    product.price = product.stores[0].price;
    return changed;
  }

  product.stores.push(incomingStore);
  product.stores.sort(compareStores);
  product.price = product.stores[0].price;
  return true;
}

function clearMergedStoreOffers(products) {
  let removedOffers = 0;
  for (const product of products) {
    const stores = Array.isArray(product.stores) ? product.stores : [];
    const keptStores = stores.filter(store => !MERGED_STORE_NAMES.has(store.name));
    removedOffers += stores.length - keptStores.length;
    product.stores = keptStores.sort(compareStores);
    product.price = product.stores[0]?.price ?? null;
  }
  return removedOffers;
}

function removeProductsWithoutStores(products) {
  let removedProducts = 0;
  for (let i = products.length - 1; i >= 0; i -= 1) {
    if (!Array.isArray(products[i].stores) || products[i].stores.length === 0) {
      products.splice(i, 1);
      removedProducts += 1;
    }
  }
  return removedProducts;
}

function getProductIdentifierKey(product) {
  const identifier = product.ean || product.productGTIN;
  if (!identifier || !product.category) return null;
  return `${product.category}::${identifier}`;
}

function chooseConsolidationTarget(group) {
  return [...group].sort((a, b) => {
    const storesDiff = (b.stores?.length || 0) - (a.stores?.length || 0);
    if (storesDiff !== 0) return storesDiff;

    const priceDiff = (a.price || Infinity) - (b.price || Infinity);
    if (priceDiff !== 0) return priceDiff;

    return (Number(b.id) || 0) - (Number(a.id) || 0);
  })[0];
}

function consolidateDuplicateProducts(products) {
  const byIdentifier = new Map();
  for (const product of products) {
    const key = getProductIdentifierKey(product);
    if (!key) continue;
    if (!byIdentifier.has(key)) byIdentifier.set(key, []);
    byIdentifier.get(key).push(product);
  }

  const remove = new Set();
  for (const group of byIdentifier.values()) {
    if (group.length < 2) continue;

    const target = chooseConsolidationTarget(group);
    for (const duplicate of group) {
      if (duplicate === target) continue;
      mergeProductData(target, duplicate);
      for (const store of duplicate.stores || []) {
        addStoreToProduct(target, { stores: [store] });
      }
      remove.add(duplicate);
    }
  }

  if (remove.size === 0) return 0;
  for (let i = products.length - 1; i >= 0; i -= 1) {
    if (remove.has(products[i])) {
      products.splice(i, 1);
    }
  }
  return remove.size;
}

function mergeProductData(product, offer) {
  if (!product.image && offer.image) {
    product.image = offer.image;
    product.imageSource = offer.source || product.imageSource || product.source || null;
  }

  const preferBetterAffiliateImage =
    (offer.source === 'padel-market' || offer.source === 'adidas-padel' || offer.source === 'padel-proshop' || offer.source === 'forum-sport-es' || offer.source === 'zona-de-padel') &&
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

  if (!product.description && offer.description) {
    product.description = offer.description;
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
    name: normalizeProductName(offer.name || '', offer.category),
    brand: normalizeBrand(offer.brand),
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
    description: offer.description || null,
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

function inferCatalogCategory(item) {
  const text = normalizeText([
    item?.name,
    item?.brand,
    item?.sourceCategory,
  ].filter(Boolean).join(' | '));

  if (!text) return item?.category;

  if (
    text.includes('camiseta') ||
    text.includes('camisola') ||
    text.includes('t shirt') ||
    text.includes('polo') ||
    text.includes('saia') ||
    text.includes('vestido') ||
    text.includes('short') ||
    text.includes('calcas') ||
    text.includes('calcoes') ||
    text.includes('pantalon') ||
    text.includes('pantalones') ||
    text.includes('legging') ||
    text.includes('sweatshirt') ||
    text.includes('hoodie') ||
    text.includes('sudadera') ||
    text.includes('jacket') ||
    hasWord(text, 'falda')
  ) return 'roupa';

  if (
    text.includes('overgrip') ||
    text.includes(' grip ') ||
    text.startsWith('grip ') ||
    text.includes('protector') ||
    text.includes('protetor') ||
    text.includes('antivibr') ||
    text.includes('cordao') ||
    text.includes('lanyard') ||
    text.includes('meia') ||
    text.includes('meias') ||
    text.includes('sock') ||
    text.includes('socks') ||
    text.includes('bandana')
  ) return 'acessorios';

  if (
    text.includes('paletero') ||
    text.includes('mochila') ||
    text.includes('bolsa') ||
    text.includes('saco') ||
    text.includes('bag') ||
    text.includes('backpack')
  ) return 'sacos';

  if (
    text.includes('sapatilha') ||
    text.includes('zapatilla') ||
    text.includes('shoe') ||
    text.includes('shoes') ||
    text.includes('zapatos')
  ) return 'sapatilhas';

  if (
    text.includes('raquete') ||
    text.includes('raquetas') ||
    text.includes('pala') ||
    text.includes('palas') ||
    text.includes('racket')
  ) return 'raquetes';

  if (/\b(bola|bolas|pelota|pelotas|ball|balls)\b/.test(text)) return 'acessorios';

  return item?.category;
}

function normalizeCatalogCategory(item) {
  const inferred = inferCatalogCategory(item);
  if (inferred && inferred !== item.category) {
    item.category = inferred;
  }
  if (item.category === 'bolas') {
    item.category = 'acessorios';
  }
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
    offer.brand = normalizeBrand(offer.brand);
    normalizeCatalogCategory(offer);
    if (isCategoryIntruder(offer, offer.category)) {
      counters.skipped += 1;
      continue;
    }

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
        target =
          byName.get(`${offer.category}::${normalizeText(explicitTarget)}`) ||
          byName.get(`${offer.category}::${normalizeText(normalizeProductName(explicitTarget, offer.category))}`) ||
          null;
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
  for (const product of products) {
    product.name = normalizeProductName(product.name, product.category);
    product.brand = normalizeBrand(product.brand);
    normalizeCatalogCategory(product);
  }
  for (let i = products.length - 1; i >= 0; i -= 1) {
    if (isCategoryIntruder(products[i], products[i].category)) {
      products.splice(i, 1);
    }
  }
  const consolidatedDuplicateProducts = consolidateDuplicateProducts(products);
  const removedStaleOffers = clearMergedStoreOffers(products);
  const adidas = extractWindowData(ADIDAS_FILE, 'PADELCOST_ADIDAS_PRODUCTS');
  const padelMarket = fs.existsSync(PADEL_MARKET_FILE)
    ? extractWindowData(PADEL_MARKET_FILE, 'PADELCOST_PADEL_MARKET_PRODUCTS')
    : [];
  const padelProshop = fs.existsSync(PADEL_PROSHOP_FILE)
    ? extractWindowData(PADEL_PROSHOP_FILE, 'PADELCOST_PADEL_PROSHOP_PRODUCTS')
    : [];
  const forumSport = fs.existsSync(FORUM_SPORT_FILE)
    ? extractWindowData(FORUM_SPORT_FILE, 'PADELCOST_FORUM_SPORT_PRODUCTS')
    : [];
  const zonaDePadel = fs.existsSync(ZONA_DE_PADEL_FILE)
    ? extractWindowData(ZONA_DE_PADEL_FILE, 'PADELCOST_ZONA_DE_PADEL_PRODUCTS')
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

  if (padelProshop.length > 0) {
    processOffers({
      label: 'Padel Proshop PT',
      offers: padelProshop,
      products,
      indexes,
      allowSignatureMatch: false,
      counters,
      nextIdRef,
    });
  }

  if (forumSport.length > 0) {
    processOffers({
      label: 'Forum Sport ES',
      offers: forumSport,
      products,
      indexes,
      allowSignatureMatch: false,
      counters,
      nextIdRef,
    });
  }

  if (zonaDePadel.length > 0) {
    processOffers({
      label: 'Zona de Padel',
      offers: zonaDePadel,
      products,
      indexes,
      allowSignatureMatch: false,
      counters,
      nextIdRef,
    });
  }

  const removedProductsWithoutStores = removeProductsWithoutStores(products);

  const now = new Date().toISOString();
  const content = [
    `// PadelCost - Catálogo gerado automaticamente`,
    `// Gerado em: ${now}`,
    `// Produtos: ${products.length}`,
    `// Merge lojas: ${counters.merged} ofertas integradas, ${counters.skipped} por rever`,
    ``,
    `window.PADELCOST_UPDATED_AT = ${JSON.stringify(now)};`,
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
  console.log(`   Produtos duplicados por EAN/GTIN consolidados: ${consolidatedDuplicateProducts}`);
  console.log(`   Ofertas antigas removidas antes do merge: ${removedStaleOffers}`);
  console.log(`   Produtos sem lojas removidos no fim: ${removedProductsWithoutStores}`);
}

main();
