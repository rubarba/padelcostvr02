/**
 * PadelCost - Gerador Sport is Good (AWIN)
 * ---------------------------------------
 * Lê o feed CSV da Sport is Good na AWIN, filtra produtos relevantes para o
 * PadelCost e gera um ficheiro normalizado com ofertas da loja.
 */

require('dotenv').config();
const https = require('https');
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse');
const { normalizeProductName } = require('./name-normalization');
const { isCoreCatalogProduct } = require('./category-rules');

const CONFIG = {
  feedUrl: process.env.SPORT_IS_GOOD_FEED_URL || '',
  feedFile: process.env.SPORT_IS_GOOD_FEED_FILE || '',
  feedId: process.env.SPORT_IS_GOOD_FEED_ID || '89044',
  apiKey: process.env.AWIN_API_KEY || '',
  maxProducts: parseInt(process.env.MAX_PRODUCTS_SPORT_IS_GOOD || process.env.MAX_PRODUCTS || '0', 10),
  outputDir: process.env.OUTPUT_DIR || '../data',
};

const CORE_CATEGORIES = new Set(['raquetes', 'sapatilhas', 'sacos', 'acessorios']);

const CLOTHING_MARKERS = [
  'camiseta',
  'camisa',
  'polo',
  'pantalon',
  'pantalón',
  'pantalones',
  'calcoes',
  'calções',
  'short',
  'falda',
  't-shirt',
  'sudadera',
  'chaqueta',
  'casaco',
  'chandal',
  'chándal',
  'ropa',
  'tirantes',
  'manga corta',
  'manga larga',
  'calcetin',
  'calcetines',
];

const EXCLUDE_MARKERS = [
  'badminton',
  'bádminton',
  'balonmano',
  'fronton',
  'frontón',
  'squash',
  'pickleball',
  'red de padel',
  'red de pádel',
  'postes padel',
  'postes pádel',
  'banco con respaldo',
  'cesta con ruedas',
  'cesta de pelotas',
  'maquina',
  'máquina',
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

function containsAny(text, markers) {
  return markers.some(marker => text.includes(normalizeText(marker)));
}

function hasAnyWord(text, markers) {
  return markers.some(marker => new RegExp(`(^|\\s)${normalizeText(marker).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`).test(text));
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

function buildFeedUrl() {
  if (CONFIG.feedUrl) return CONFIG.feedUrl;
  if (!CONFIG.apiKey) {
    throw new Error('Define SPORT_IS_GOOD_FEED_URL ou AWIN_API_KEY no ficheiro .env.');
  }

  const columns = [
    'aw_deep_link',
    'product_name',
    'data_feed_id',
    'merchant_id',
    'merchant_name',
    'aw_product_id',
    'aw_image_url',
    'aw_thumb_url',
    'category_id',
    'category_name',
    'brand_id',
    'brand_name',
    'merchant_product_id',
    'ean',
    'product_GTIN',
    'mpn',
    'model_number',
    'description',
    'product_short_description',
    'specifications',
    'merchant_deep_link',
    'merchant_image_url',
    'search_price',
    'store_price',
    'delivery_cost',
    'rrp_price',
    'product_price_old',
    'display_price',
    'stock_status',
    'in_stock',
    'brand_name',
    'colour',
    'product_type',
    'merchant_category',
    'merchant_product_category_path',
    'merchant_product_second_category',
    'merchant_product_third_category',
  ].join('%2C');

  return `https://productdata.awin.com/datafeed/download/apikey/${CONFIG.apiKey}/language/es/fid/${CONFIG.feedId}/rid/0/hasEnhancedFeeds/0/columns/${columns}/format/csv/delimiter/%2C/compression/gzip/adultcontent/1/`;
}

function fetchFeed(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    console.log('⬇️  A descarregar feed da Sport is Good...');
    https.get(url, (res) => {
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

function readFeedFile(filePath) {
  const buffer = fs.readFileSync(filePath);
  const isGzip = buffer.length >= 2 && buffer[0] === 0x1f && buffer[1] === 0x8b;
  return isGzip ? zlib.gunzipSync(buffer).toString('utf8') : buffer.toString('utf8');
}

function extractRacketSpecs(row) {
  const textRaw = normalizeSpaces([
    row.description,
    row.specifications,
    row.product_name,
    row.category_name,
    row.product_short_description,
    row.product_type,
    row.merchant_category,
  ].filter(Boolean).join(' '));
  const text = normalizeText(textRaw);

  const weightRangeMatch = text.match(/(\d{2,3})\s*(?:-|–|a|hasta|to|e)\s*(\d{2,3})\s*(?:g|gr|gramo|gramos)/);
  const weightSingleMatch = text.match(/(\d{2,3}(?:[.,]\d+)?)\s*(?:g|gr|gramo|gramos)/);

  let peso = null;
  if (weightRangeMatch) peso = `${weightRangeMatch[1]}-${weightRangeMatch[2]}g`;
  else if (weightSingleMatch) peso = `${weightSingleMatch[1].replace(',', '.')}g`;

  let forma = null;
  if (/\bdiamante\b|\bdiamond\b/.test(text)) forma = 'Diamante';
  else if (/\bredonda\b|\bround\b/.test(text)) forma = 'Redonda';
  else if (/\bhibrida\b|\bhybrid\b|\blagrima\b|\bteardrop\b/.test(text)) forma = 'Híbrida';

  let equilibrio = null;
  if (/\bbalance alto\b|\bequilibrio alto\b|\bhigh balance\b/.test(text)) equilibrio = 'Alto';
  else if (/\bbalance medio\b|\bequilibrio medio\b|\bmedium balance\b/.test(text)) equilibrio = 'Médio';
  else if (/\bbalance bajo\b|\bequilibrio bajo\b|\blow balance\b/.test(text)) equilibrio = 'Baixo';

  let nivel = null;
  if (/\bprofesional\b|\bcompetition\b|\bcompeticion\b/.test(text)) nivel = 'Profissional';
  else if (/\bavanzad|\bexpert|\badvanced/.test(text)) nivel = 'Avançado';
  else if (/\bintermed/.test(text)) nivel = 'Intermédio';
  else if (/\biniciac|\bbeginner|\bprincipiante/.test(text)) nivel = 'Iniciante';

  let material = null;
  const carbonMatch = textRaw.match(/\bcarbon(?:o)?\s*(24k|18k|16k|12k|6k|3k)?/i);
  if (carbonMatch) material = carbonMatch[1] ? `Carbono ${carbonMatch[1].toUpperCase()}` : 'Carbono';
  else if (/fibra de vidrio|fibra de vidro|fiberglass|fiber glass/i.test(textRaw)) material = 'Fibra de vidro';

  let estilo = null;
  if (/control/.test(text) && /potencia|power/.test(text)) estilo = 'Equilibrado';
  else if (/control/.test(text)) estilo = 'Controlo';
  else if (/potencia|power/.test(text)) estilo = 'Potência';
  else if (/polivalente|equilibr/.test(text)) estilo = 'Equilibrado';

  return { peso, forma, equilibrio, nivel, material, estilo };
}

function extractShoeSpecs(row) {
  const textRaw = normalizeSpaces([
    row.description,
    row.specifications,
    row.product_name,
    row.category_name,
    row.product_short_description,
    row.product_type,
    row.merchant_category,
  ].filter(Boolean).join(' '));
  const text = normalizeText(textRaw);
  const lowerName = normalizeText(row.product_name);

  let sola = null;
  if (/\bclay\b|\bespiga\b|\bspiga\b/.test(text)) sola = 'Clay / Espiga';
  else if (/\bomni\b|\ball court\b|\bmultipista\b/.test(text)) sola = 'Omni / All Court';
  else if (/\bpadel\b/.test(text)) sola = 'Pádel';

  let genero = null;
  if (/\bmujer\b|\bwoman\b|\bwomen\b|\bfeminin/.test(text)) genero = 'Mulher';
  else if (/\bhombre\b|\bman\b|\bmen\b|\bmasculin/.test(text)) genero = 'Homem';
  else if (/\bunisex\b|\bunissex\b/.test(text)) genero = 'Unissexo';

  let cor = null;
  if (/\bazul\b|\bblue\b/.test(lowerName)) cor = 'Azul';
  else if (/\brosa\b|\bpink\b/.test(lowerName)) cor = 'Rosa';
  else if (/\bblanco\b|\bbranco\b|\bwhite\b/.test(lowerName)) cor = 'Branco';
  else if (/\bnegro\b|\bpreto\b|\bblack\b/.test(lowerName)) cor = 'Preto';
  else if (/\bverde\b|\bgreen\b/.test(lowerName)) cor = 'Verde';
  else if (/\brojo\b|\bvermelho\b|\bred\b/.test(lowerName)) cor = 'Vermelho';
  else if (/\bamarillo\b|\bamarelo\b|\byellow\b/.test(lowerName)) cor = 'Amarelo';

  let uso = null;
  if (/\bcompeticion\b|\bcompetition\b/.test(text)) uso = 'Competição';
  else if (/\bintens/.test(text)) uso = 'Intenso';
  else if (/\bpadel\b/.test(text)) uso = 'Pádel';

  return { sola, genero, cor, uso, amortecimento: null };
}

function mapCategory(row) {
  const name = normalizeText(row.product_name);
  const sourceCategory = normalizeText([
    row.category_name,
    row.merchant_category,
    row.merchant_product_category_path,
    row.merchant_product_second_category,
    row.merchant_product_third_category,
  ].filter(Boolean).join(' | '));
  const combined = normalizeText([
    row.product_name,
    row.description,
    row.product_short_description,
    row.specifications,
    row.category_name,
    row.product_type,
    row.merchant_category,
    row.merchant_product_category_path,
    row.merchant_product_second_category,
    row.merchant_product_third_category,
  ].filter(Boolean).join(' | '));

  if (containsAny(combined, EXCLUDE_MARKERS)) return null;
  if (containsAny(name, CLOTHING_MARKERS)) return name.includes('padel') ? 'roupa' : null;

  const isPadelContext = sourceCategory.includes('padel') || name.includes('padel');
  if (!isPadelContext) return null;
  if (/\btenis\b|\btennis\b|\bballe de tennis\b|\btube balles de tennis\b/.test(name) && !/\bpadel\b/.test(name)) return null;

  const racketNamePattern = /\bpa\b|\bpas\b|\bpala\b|\bpalas\b|\braqueta\b|\braquetas\b|\braquete\b|\braquetes\b|\bracket\b|\brackets\b/;

  if (
    hasAnyWord(name, ['overgrip', 'cubregrip', 'antivibrador']) ||
    (
      isPadelContext &&
      (
        hasAnyWord(name, ['protector', 'protetor', 'proteccion', 'protection', 'grip']) ||
        /\bpelota\b|\bpelotas\b|\bbola\b|\bbolas\b/.test(name) ||
        name.includes('tripack') ||
        name.includes('bipack') ||
        name.includes('tubo')
      )
    )
  ) return 'acessorios';

  if (
    sourceCategory.includes('sac de raquette de padel') ||
    sourceCategory.includes('sac a dos') ||
    sourceCategory.includes('sac à dos') ||
    hasAnyWord(name, ['paletero', 'raquetero']) ||
    (name.includes('padel') && hasAnyWord(name, ['bolsa', 'mochila', 'saco', 'bag', 'backpack']))
  ) return 'sacos';

  if (
    sourceCategory.includes('chaussures de padel') ||
    (name.includes('padel') && hasAnyWord(name, ['zapatilla', 'zapatillas', 'sapatilha', 'sapatilhas', 'calzado', 'shoe', 'shoes', 'tenis']))
  ) return 'sapatilhas';

  if (
    sourceCategory.includes('raquette de padel') ||
    isPadelContext && (racketNamePattern.test(name) || /^padel\s+/.test(name))
  ) return 'raquetes';

  if (sourceCategory.includes('padel') && hasAnyWord(name, ['funda'])) return 'acessorios';

  return null;
}

function parseAvailability(row) {
  const normalized = normalizeText(row.stock_status);
  if (!normalized) return 'Disponibilidade por confirmar';
  if (
    normalized.includes('in stock') ||
    normalized.includes('instock') ||
    normalized.includes('en stock') ||
    normalized.includes('dispon')
  ) return 'Em stock';
  if (normalized.includes('out of stock') || normalized.includes('agotado') || normalized.includes('sin stock')) return 'Sem stock';
  return 'Disponibilidade por confirmar';
}

function toOffer(row) {
  const category = mapCategory(row);
  if (!category || !CORE_CATEGORIES.has(category)) return null;

  const price = cleanPrice(row.search_price);
  if (price == null) return null;

  const cleanedName = normalizeSpaces(row.product_name)
    .replace(/\bp[áa]\s+pala\s+de\s+p[áa]del\b/gi, 'raquete de padel')
    .replace(/\bp[áa]\s+pala\b/gi, 'raquete de padel')
    .replace(/^p[áa]del\s+/i, 'raquete de padel ')
    .replace(/\bp[áa]\s+(?:da\s+|de\s+|do\s+)?padel\b/gi, 'raquete de padel');
  const name = normalizeProductName(cleanedName, category)
    .replace(/^P[áa]\s+raquete\b/i, 'Raquete de padel')
    .replace(/^Saco\s+saco\b/i, 'Saco');
  const url = firstNonEmpty(row.aw_deep_link, row.merchant_deep_link);
  if (!name || !url) return null;

  const specs =
    category === 'raquetes' ? extractRacketSpecs(row) :
    category === 'sapatilhas' ? extractShoeSpecs(row) :
    {};

  const offer = {
    id: `sport-is-good-${slugify(name)}-${row.aw_product_id || row.merchant_product_id || slugify(row.ean || '')}`,
    name,
    brand: normalizeSpaces(row.brand_name || row.merchant_name || 'Sport is Good'),
    category,
    price,
    oldPrice: cleanPrice(row.product_price_old || row.rrp_price),
    rating: null,
    badge: null,
    image: firstNonEmpty(row.aw_image_url, row.merchant_image_url, row.large_image, row.aw_thumb_url, row.merchant_thumb_url) || '',
    ean: normalizeSpaces(row.ean || '') || null,
    productGTIN: normalizeSpaces(row.product_GTIN || '') || null,
    mpn: normalizeSpaces(row.mpn || row.model_number || row.merchant_product_id || '') || null,
    source: 'sport-is-good',
    sourceProductId: row.aw_product_id || row.merchant_product_id || null,
    sourceCategory: firstNonEmpty(row.category_name, row.merchant_category, row.merchant_product_category_path) || null,
    description: normalizeSpaces(row.description || row.product_short_description || row.specifications || '') || null,
    specs,
    stores: [
      {
        key: 'sport-is-good',
        name: 'Sport is Good',
        price,
        stock: parseAvailability(row),
        url,
        deliveryCost: cleanPrice(row.delivery_cost),
      },
    ],
  };

  if (category === 'acessorios') return offer;
  return isCoreCatalogProduct(offer) ? offer : null;
}

async function main() {
  console.log('🎾  PadelCost - Sport is Good\n');

  const raw = CONFIG.feedFile ? readFeedFile(CONFIG.feedFile) : await fetchFeed(buildFeedUrl());
  const rows = await parseCsv(raw);
  console.log(`📦  Total de linhas no feed: ${rows.length.toLocaleString('pt-PT')}`);

  const offers = [];
  const seen = new Set();
  let coreRows = 0;
  let clothingRows = 0;

  for (const row of rows) {
    const category = mapCategory(row);
    if (category === 'roupa') {
      clothingRows++;
      continue;
    }
    if (!category) continue;
    coreRows++;

    const offer = toOffer(row);
    if (!offer) continue;

    const dedupeKey = `${offer.category}::${offer.ean || ''}::${offer.mpn || ''}::${slugify(offer.name)}::${offer.price}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    offers.push(offer);
    if (CONFIG.maxProducts > 0 && offers.length >= CONFIG.maxProducts) break;
  }

  const outputPath = path.resolve(__dirname, CONFIG.outputDir, 'sport-is-good-data.js');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  const content = [
    `// PadelCost - Sport is Good`,
    `// Gerado em: ${new Date().toISOString()}`,
    `window.PADELCOST_SPORT_IS_GOOD_PRODUCTS = ${JSON.stringify(offers, null, 2)};`,
  ].join('\n');

  fs.writeFileSync(outputPath, content, 'utf8');

  const summary = offers.reduce((acc, offer) => {
    acc[offer.category] = (acc[offer.category] || 0) + 1;
    return acc;
  }, {});

  console.log(`🎯  Linhas core encontradas antes da normalização: ${coreRows.toLocaleString('pt-PT')}`);
  console.log(`👕  Linhas de roupa excluídas: ${clothingRows.toLocaleString('pt-PT')}`);
  console.log(`✅  Ficheiro gerado: ${outputPath}`);
  console.log('📊  Resumo por categoria:');
  Object.entries(summary)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([category, count]) => {
      console.log(`   ${category.padEnd(12)} ${count} produtos`);
    });
  console.log('\n🧩  Próximo passo: rever amostras e só depois fazer merge com o catálogo principal.');
}

main().catch(error => {
  console.error(`❌  Erro: ${error.message}`);
  process.exit(1);
});
