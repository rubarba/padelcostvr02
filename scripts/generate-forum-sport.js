/**
 * PadelCost - Gerador Forum Sport ES (AWIN)
 * -----------------------------------------
 * Lê o feed CSV da Forum Sport ES na AWIN, filtra produtos relevantes para o
 * PadelCost e gera um ficheiro normalizado com ofertas da loja.
 */

require('dotenv').config();
const http = require('http');
const https = require('https');
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse');
const { normalizeProductName } = require('./name-normalization');
const { isCoreCatalogProduct } = require('./category-rules');

const CONFIG = {
  feedUrl: process.env.FORUM_SPORT_FEED_URL || '',
  maxProducts: parseInt(process.env.MAX_PRODUCTS_FORUM_SPORT || process.env.MAX_PRODUCTS || '0', 10),
  outputDir: process.env.OUTPUT_DIR || '../data',
};

const INCLUDE_KEYWORDS = ['padel', 'pádel'];
const EXCLUDE_KEYWORDS = ['pickleball', 'beach tennis', 'tenis de praia', 'tênis de praia', 'badminton', 'fronton', 'frontón', 'squash'];
const CORE_CATEGORIES = new Set(['raquetes', 'sapatilhas', 'sacos', 'acessorios']);
const EXCLUDE_PRODUCT_MARKERS = [
  'calcetin',
  'calcetines',
  'meia',
  'meias',
  'sock',
  'socks',
  'pelota tenis',
  'pelotas tenis',
  'pelotas squash',
  'cordaje',
  'chaveiro',
  'porta chaves',
  'keyring',
  'keychain',
  'varios padel',
  'varios tenis',
  'neceser',
  'funda termica',
  'funda térmica',
  'raqueta tenis',
  'raqueta de tenis',
  'raqueta squash',
  'raqueta de squash',
  'tennis racket',
  'racket tennis',
  'racket tenis',
  'squash racket',
  'squash rkt',
  ' sq rkt',
  'fronton',
  'frontón',
  'goma fronton',
  'goma frontón',
  'pala cuero',
  'badminton',
  'praia',
  'beach',
  'frescobol',
  'muñequera',
  'pulsera',
  'pulsiera',
];
const ACCESSORY_PRODUCT_MARKERS = [
  'bola padel',
  'bolas padel',
  'pelota padel',
  'pelotas padel',
  'pelota de padel',
  'pelotas de padel',
  'overgrip',
  'overgrips',
  'grip',
  'antivibrador',
  'antivibradores',
  'protector',
  'protetor',
  'protection',
  'aderencia',
  'adhesive',
  'presurizador',
  'pressurizador',
  'pascal box',
  'tambor',
  'bote',
  'tubo',
  'cajon',
  'cajón',
  'pack 3 botes',
];

function normalizeText(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function normalizeSpaces(str) {
  return (str || '').replace(/\s+/g, ' ').trim();
}

function slugify(str) {
  return normalizeText(str).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function includesAny(text, keywords) {
  return keywords.some(keyword => text.includes(keyword));
}

function containsAny(text, markers) {
  return markers.some(marker => text.includes(marker));
}

function cleanPrice(value) {
  if (value == null || value === '') return null;
  const normalized = String(value).replace(',', '.').replace(/[^0-9.]/g, '');
  const n = parseFloat(normalized);
  return Number.isNaN(n) ? null : Math.round(n * 100) / 100;
}

function firstNonEmpty(...values) {
  for (const value of values) {
    if (value != null && String(value).trim() !== '') return value;
  }
  return null;
}

function fetchFeed(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (!url) {
      return reject(new Error('FORUM_SPORT_FEED_URL não definida.'));
    }

    console.log('⬇️  A descarregar feed da Forum Sport ES...');
    const client = url.startsWith('http://') ? http : https;
    client.get(url, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirects < 5) {
        const nextUrl = new URL(res.headers.location, url).toString();
        res.resume();
        return resolve(fetchFeed(nextUrl, redirects + 1));
      }

      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode}`));
      }

      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        const isGzip =
          res.headers['content-encoding'] === 'gzip' ||
          (buffer.length >= 2 && buffer[0] === 0x1f && buffer[1] === 0x8b);

        if (isGzip) {
          zlib.gunzip(buffer, (err, decoded) => {
            if (err) return reject(err);
            resolve(decoded.toString('utf8'));
          });
          return;
        }

        resolve(buffer.toString('utf8'));
      });
      res.on('error', reject);
    }).on('error', reject);
  });
}

function parseCsv(raw) {
  return new Promise((resolve, reject) => {
    parse(
      raw,
      {
        columns: true,
        delimiter: ',',
        relax_column_count: true,
        skip_empty_lines: true,
      },
      (err, records) => {
        if (err) return reject(err);
        resolve(records);
      }
    );
  });
}

function extractRacketSpecs(row) {
  const textRaw = normalizeSpaces([
    row.description,
    row.product_short_description,
    row.specifications,
    row.product_name,
    row.merchant_category,
    row.category_name,
    row.product_type,
    row.keywords,
    row.promotional_text,
    row.dimensions,
  ].filter(Boolean).join(' '));
  const text = normalizeText(textRaw);

  const weightRangeMatch = text.match(/(\d{2,3})\s*(?:-|–|a|ate|to|e)\s*(\d{2,3})\s*(?:g|gr|grama|gramas)/);
  const weightSingleMatch = text.match(/(\d{2,3}(?:[.,]\d+)?)\s*(?:g|gr|grama|gramas)/);

  let peso = null;
  if (weightRangeMatch) peso = `${weightRangeMatch[1]}-${weightRangeMatch[2]}g`;
  else if (weightSingleMatch) peso = `${weightSingleMatch[1].replace(',', '.')}g`;

  let forma = null;
  if (/\bdiamante\b|\bdiamond\b/.test(text)) forma = 'Diamante';
  else if (/\bredonda\b|\bredond\b|\bround\b/.test(text)) forma = 'Redonda';
  else if (/\bhibrida\b|\bhybrid\b|\blagrima\b|\bteardrop\b/.test(text)) forma = 'Híbrida';

  let equilibrio = null;
  if (/\bequilibrio alto\b|\bhigh balance\b/.test(text)) equilibrio = 'Alto';
  else if (/\bequilibrio medio\b|\bequilibrio médio\b|\bmedium balance\b/.test(text)) equilibrio = 'Médio';
  else if (/\bequilibrio bajo\b|\bequilibrio baixo\b|\blow balance\b|\blow balance\b/.test(text)) equilibrio = 'Baixo';

  let nivel = null;
  if (/\bprofession|\bcompetition\b/.test(text)) nivel = 'Profissional';
  else if (/\bavanzad|\bavancad|\bavançad|\bexpert\b|\badvanced\b/.test(text)) nivel = 'Avançado';
  else if (/\bintermed/.test(text)) nivel = 'Intermédio';
  else if (/\binician|\bbeginner|\bprincipiante/.test(text)) nivel = 'Iniciante';

  let material = null;
  const carbonMatch = textRaw.match(/\bcarbon(?:o)?\s*(24k|18k|16k|12k|6k|3k)?/i);
  if (carbonMatch) material = carbonMatch[1] ? `Carbono ${carbonMatch[1].toUpperCase()}` : 'Carbono';
  else if (/fibra de vidrio|fibra de vidro|fiberglass|fiber glass/i.test(textRaw)) material = 'Fibra de vidro';
  else if (/kevlar/i.test(textRaw)) material = 'Kevlar';

  let estilo = null;
  if (/controlo|control/.test(text) && /potencia|power/.test(text)) estilo = 'Equilibrado';
  else if (/controlo|control/.test(text)) estilo = 'Controlo';
  else if (/potencia|power/.test(text)) estilo = 'Potência';
  else if (/equilibrad/.test(text)) estilo = 'Equilibrado';

  return { peso, forma, equilibrio, nivel, material, estilo };
}

function extractShoeSpecs(row) {
  const textRaw = normalizeSpaces([
    row.description,
    row.product_short_description,
    row.specifications,
    row.product_name,
    row.merchant_category,
    row.category_name,
    row.product_type,
    row.keywords,
    row.promotional_text,
  ].filter(Boolean).join(' '));
  const text = normalizeText(textRaw);
  const lowerName = normalizeText(row.product_name);

  let sola = null;
  if (/\bclay\b|\bespiga\b|\bspiga\b/.test(text)) sola = 'Clay / Espiga';
  else if (/\bomni\b|\ball court\b/.test(text)) sola = 'Omni / All Court';
  else if (/\bpadel\b/.test(text)) sola = 'Pádel';

  let genero = null;
  if (/\bmulher\b|\bmujer\b|\bwoman\b|\bwomen\b|\bfeminin/.test(text)) genero = 'Mulher';
  else if (/\bhomem\b|\bhombre\b|\bman\b|\bmen\b|\bmasculin/.test(text)) genero = 'Homem';
  else if (/\bunisex\b|\bunissex\b/.test(text)) genero = 'Unissexo';

  let cor = null;
  if (/\bazul\b|\bblue\b/.test(lowerName)) cor = 'Azul';
  else if (/\brosa\b|\bpink\b/.test(lowerName)) cor = 'Rosa';
  else if (/\bbranco\b|\bblanco\b|\bwhite\b/.test(lowerName)) cor = 'Branco';
  else if (/\bpreto\b|\bnegro\b|\bblack\b/.test(lowerName)) cor = 'Preto';
  else if (/\bverde\b|\bgreen\b/.test(lowerName)) cor = 'Verde';
  else if (/\bvermelho\b|\brojo\b|\bred\b/.test(lowerName)) cor = 'Vermelho';
  else if (/\bamarelo\b|\bamarillo\b|\byellow\b/.test(lowerName)) cor = 'Amarelo';

  let uso = null;
  if (/\bcompeti|\bcompetition\b/.test(text)) uso = 'Competição';
  else if (/\bintens/.test(text)) uso = 'Intenso';
  else if (/\bpadel\b/.test(text)) uso = 'Pádel';

  let amortecimento = null;
  if (/\bboost\b|\blightstrike\b|\bcushion|\bfoam\b|\bamort/.test(text)) amortecimento = 'Alto';

  return { sola, genero, cor, uso, amortecimento };
}

function isPadelProduct(row) {
  const nameText = normalizeText(row.product_name);
  const haystack = normalizeText([
    row.product_name,
    row.description,
    row.product_short_description,
    row.specifications,
    row.keywords,
    row.promotional_text,
    row.merchant_category,
    row.category_name,
    row.merchant_product_category_path,
    row.merchant_product_third_category,
    row.product_type,
  ].filter(Boolean).join(' | '));

  if (!includesAny(haystack, INCLUDE_KEYWORDS)) return false;
  if (includesAny(haystack, EXCLUDE_KEYWORDS)) return false;
  if (containsAny(haystack, EXCLUDE_PRODUCT_MARKERS)) return false;

  const padelType = normalizeText([
    row.product_type,
    row.merchant_product_category_path,
    row.merchant_product_third_category,
    row.category_name,
    row.merchant_category,
  ].filter(Boolean).join(' | '));

  const shoeSignal =
    /\bzapatill/.test(padelType) &&
    /\bpadel\b/.test(padelType) &&
    !/\btenis\b/.test(padelType);
  const racketSignal =
    (/\braqueta/.test(padelType) || /\bpala\b/.test(padelType)) &&
    /\bpadel\b/.test(padelType);
  const bagSignal =
    (/\braquetero\b/.test(padelType) || /\bpaletero\b/.test(padelType) || /\bpadel bag\b/.test(padelType)) &&
    /\bpadel\b/.test(padelType);
  const accessorySignal =
    containsAny(haystack, ACCESSORY_PRODUCT_MARKERS) &&
    /\bpadel\b/.test(haystack) &&
    !/\bsquash\b|\bfronton\b|\bbadminton\b/.test(haystack) &&
    !(
      (/\btenis\b|\btennis\b/.test(nameText) && !/\bpadel\b/.test(nameText)) ||
      nameText.includes('pelota tenis') ||
      nameText.includes('pelotas tenis')
    );

  return shoeSignal || racketSignal || bagSignal || accessorySignal;
}

function mapCategory(row) {
  const combined = normalizeText([
    row.product_name,
    row.merchant_category,
    row.category_name,
    row.merchant_product_category_path,
    row.merchant_product_third_category,
    row.product_type,
    row['Fashion:category'],
  ].filter(Boolean).join(' | '));

  if (
    containsAny(combined, EXCLUDE_PRODUCT_MARKERS) ||
    combined.includes('squash') ||
    combined.includes('badminton') ||
    combined.includes('fronton') ||
    combined.includes('frontón') ||
    (((combined.includes('tenis') || combined.includes('tennis')) && !combined.includes('padel')) &&
      (combined.includes('raqueta') ||
        combined.includes('raquete') ||
        combined.includes('racket') ||
        combined.includes('pala'))) ||
    combined.includes('sandalia') ||
    combined.includes('sandália') ||
    combined.includes('chinelo') ||
    combined.includes('slide') ||
    combined.includes('footgel')
  ) {
    return null;
  }

  if (
    containsAny(combined, ACCESSORY_PRODUCT_MARKERS) &&
    combined.includes('padel') &&
    !combined.includes('pelota tenis') &&
    !combined.includes('pelotas tenis') &&
    !combined.includes('pelotas squash')
  ) {
    return 'acessorios';
  }

  if (
    (combined.includes('paletero') ||
      combined.includes('raquetero') ||
      combined.includes('padel bag')) &&
    combined.includes('padel')
  ) {
    return 'sacos';
  }

  if (
    (combined.includes('zapatilla') ||
      combined.includes('sapatilha') ||
      combined.includes('calzado') ||
      combined.includes('shoe')) &&
    combined.includes('padel') &&
    !combined.includes('tenis')
  ) {
    return 'sapatilhas';
  }

  if (
    (combined.includes('raquete') ||
      combined.includes('raqueta') ||
      combined.includes('racket') ||
      combined.includes('pala') ||
      combined.includes('palas')) &&
    combined.includes('padel')
  ) {
    return 'raquetes';
  }

  return null;
}

function isAllowedAccessoryProduct(offer) {
  const text = normalizeText([
    offer.name,
    offer.brand,
    offer.sourceCategory,
    offer.description,
  ].filter(Boolean).join(' | '));

  if (
    containsAny(text, EXCLUDE_PRODUCT_MARKERS) ||
    text.includes('calcetin') ||
    text.includes('calcetines') ||
    text.includes('meia') ||
    text.includes('meias') ||
    text.includes('sock') ||
    text.includes('socks') ||
    text.includes('neceser') ||
    text.includes('monedero') ||
    text.includes('wallet') ||
    text.includes('funda') ||
    text.includes('ropa') ||
    text.includes('camiseta') ||
    text.includes('pantalon') ||
    text.includes('pantalones') ||
    text.includes('falda') ||
    text.includes('sudadera')
  ) {
    return false;
  }

  return containsAny(text, ACCESSORY_PRODUCT_MARKERS);
}

function parseAvailability(value) {
  const normalized = normalizeText(value);
  if (!normalized) return 'Disponibilidade por confirmar';
  if (
    normalized.includes('in stock') ||
    normalized.includes('instock') ||
    normalized.includes('em stock') ||
    normalized.includes('dispon') ||
    normalized === 'yes' ||
    normalized === '1'
  ) return 'Em stock';
  if (normalized.includes('out of stock') || normalized.includes('agotado') || normalized.includes('no')) return 'Sem stock';
  return 'Disponibilidade por confirmar';
}

function toOffer(row) {
  const category = mapCategory(row);
  if (!category || !CORE_CATEGORIES.has(category)) return null;

  const specs =
    category === 'raquetes' ? extractRacketSpecs(row) :
    category === 'sapatilhas' ? extractShoeSpecs(row) :
    {};
  const price = cleanPrice(firstNonEmpty(row.store_price, row.search_price, row.display_price));
  if (price == null) return null;

  const oldPrice = cleanPrice(firstNonEmpty(row.rrp_price, row.product_price_old, row.base_price, row.base_price_amount));
  const name = normalizeProductName(row.product_name, category);
  const brand = normalizeSpaces(row.brand_name || row.merchant_name || '');
  const sourceProductId = row.merchant_product_id || row.aw_product_id || null;
  const url = firstNonEmpty(row.merchant_deep_link, row.aw_deep_link);
  if (!name || !url) return null;

  const offer = {
    id: `forum-sport-${slugify(name)}-${sourceProductId || slugify(row.ean || row.product_GTIN || row.mpn || '')}`,
    name,
    brand,
    category,
    price,
    oldPrice,
    rating: cleanPrice(row.average_rating ?? row.rating),
    image: firstNonEmpty(row.large_image, row.aw_image_url, row.merchant_image_url, row.alternate_image, row.aw_thumb_url, row.merchant_thumb_url) || '',
    source: 'forum-sport-es',
    sourceProductId,
    sourceCategory: row.merchant_product_category_path || row.category_name || row.merchant_category || null,
    description: normalizeSpaces(row.description || row.product_description || row.long_description || row.short_description || '') || null,
    ean: normalizeSpaces(row.ean || '') || null,
    productGTIN: normalizeSpaces(row.product_GTIN || '') || null,
    mpn: normalizeSpaces(row.mpn || row.model_number || row.merchant_product_id || '') || null,
    specs,
    stores: [
      {
        name: 'Forum Sport ES',
        price,
        stock: parseAvailability(row.in_stock || row.stock_status),
        url,
        deliveryCost: cleanPrice(row.delivery_cost),
      },
    ],
  };

  if (category === 'acessorios') {
    return isAllowedAccessoryProduct(offer) ? offer : null;
  }

  return isCoreCatalogProduct(offer) ? offer : null;
}

function main() {
  const outputPath = path.resolve(__dirname, CONFIG.outputDir, 'forum-sport-data.js');

  fetchFeed(CONFIG.feedUrl)
    .then(parseCsv)
    .then((rows) => {
      console.log(`📦  Total de linhas no feed: ${rows.length.toLocaleString('pt-PT')}`);

      const offers = [];
      const seen = new Set();
      let passedPadel = 0;
      let passedOffer = 0;

      for (const row of rows) {
        if (!isPadelProduct(row)) continue;
        passedPadel++;
        const offer = toOffer(row);
        if (!offer) continue;
        passedOffer++;

        const dedupeKey = `${offer.category}::${offer.ean || ''}::${offer.productGTIN || ''}::${offer.mpn || ''}::${slugify(offer.name)}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);

        offers.push(offer);
        if (CONFIG.maxProducts > 0 && offers.length >= CONFIG.maxProducts) break;
      }

      const summary = offers.reduce((acc, offer) => {
        acc[offer.category] = (acc[offer.category] || 0) + 1;
        return acc;
      }, {});

      const content = [
        `// PadelCost - Forum Sport ES`,
        `// Gerado em: ${new Date().toISOString()}`,
        `window.PADELCOST_FORUM_SPORT_PRODUCTS = ${JSON.stringify(offers, null, 2)};`,
      ].join('\n');

      fs.writeFileSync(outputPath, content, 'utf8');

      console.log(`✅  Ficheiro gerado: ${outputPath}`);
      console.log('📊  Resumo por categoria:');
      Object.entries(summary)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .forEach(([category, count]) => {
          console.log(`   ${category.padEnd(12)} ${count} produtos`);
        });
      console.log('\n🧩  Próximo passo: fazer merge destas ofertas com o catálogo principal.');
    })
    .catch((error) => {
      console.error(`❌  Erro: ${error.message}`);
      process.exitCode = 1;
    });
}

main();
