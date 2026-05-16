/**
 * PadelCost - Gerador Decathlon ES (AWIN)
 * ---------------------------------------
 * Lê o feed CSV da Decathlon ES na AWIN, filtra produtos relevantes para o
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
  feedUrl: process.env.DECATHLON_FEED_URL || '',
  feedFile: process.env.DECATHLON_FEED_FILE || '',
  feedId: process.env.DECATHLON_FEED_ID || '101665',
  apiKey: process.env.AWIN_API_KEY || '',
  maxProducts: parseInt(process.env.MAX_PRODUCTS_DECATHLON || process.env.MAX_PRODUCTS || '0', 10),
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
  'short',
  'falda',
  'sudadera',
  'chaqueta',
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
    throw new Error('Define DECATHLON_FEED_URL ou AWIN_API_KEY no ficheiro .env.');
  }

  const columns = [
    'data_feed_id',
    'merchant_id',
    'merchant_name',
    'aw_product_id',
    'aw_deep_link',
    'aw_image_url',
    'aw_thumb_url',
    'category_id',
    'category_name',
    'brand_id',
    'brand_name',
    'merchant_product_id',
    'ean',
    'model_number',
    'product_name',
    'description',
    'specifications',
    'merchant_deep_link',
    'merchant_image_url',
    'search_price',
    'delivery_cost',
    'custom_1',
    'custom_2',
    'custom_3',
    'custom_4',
    'stock_status',
  ].join('%2C');

  return `https://productdata.awin.com/datafeed/download/apikey/${CONFIG.apiKey}/fid/${CONFIG.feedId}/format/csv/language/es/delimiter/%2C/compression/gzip/columns/${columns}/`;
}

function fetchFeed(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    console.log('⬇️  A descarregar feed da Decathlon ES...');
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
    row.custom_1,
    row.custom_2,
    row.custom_3,
    row.custom_4,
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
    row.custom_1,
    row.custom_2,
    row.custom_3,
    row.custom_4,
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
  const combined = normalizeText([
    row.product_name,
    row.description,
    row.specifications,
    row.category_name,
    row.custom_1,
    row.custom_2,
    row.custom_3,
    row.custom_4,
  ].filter(Boolean).join(' | '));

  if (!name.includes('padel')) return null;
  if (containsAny(combined, EXCLUDE_MARKERS)) return null;
  if (containsAny(name, CLOTHING_MARKERS)) return 'roupa';

  if (
    name.includes('protector') ||
    name.includes('antivibrador') ||
    name.includes('cubregrip') ||
    name.includes('overgrip') ||
    name.includes('grip') ||
    /\bpelota\b|\bpelotas\b|\bbola\b|\bbolas\b/.test(name) ||
    name.includes('tripack') ||
    name.includes('bipack') ||
    name.includes('tubo')
  ) return 'acessorios';

  if (
    name.includes('bolsa') ||
    name.includes('mochila') ||
    name.includes('paletero') ||
    name.includes('saco')
  ) return 'sacos';

  if (name.includes('zapatilla') || name.includes('calzado') || name.includes('shoe')) return 'sapatilhas';

  if (name.includes('pala') || name.includes('raqueta')) return 'raquetes';

  if (name.includes('funda')) return 'acessorios';

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

  const name = normalizeProductName(row.product_name, category);
  const url = firstNonEmpty(row.aw_deep_link, row.merchant_deep_link);
  if (!name || !url) return null;

  const specs =
    category === 'raquetes' ? extractRacketSpecs(row) :
    category === 'sapatilhas' ? extractShoeSpecs(row) :
    {};

  const offer = {
    id: `decathlon-${slugify(name)}-${row.aw_product_id || row.merchant_product_id || slugify(row.ean || '')}`,
    name,
    brand: normalizeSpaces(row.brand_name || row.merchant_name || 'Decathlon'),
    category,
    price,
    oldPrice: null,
    rating: null,
    badge: null,
    image: firstNonEmpty(row.aw_image_url, row.merchant_image_url, row.aw_thumb_url) || '',
    ean: normalizeSpaces(row.ean || '') || null,
    productGTIN: null,
    mpn: normalizeSpaces(row.model_number || row.merchant_product_id || '') || null,
    source: 'decathlon-es',
    sourceProductId: row.aw_product_id || row.merchant_product_id || null,
    sourceCategory: row.category_name || null,
    description: normalizeSpaces(row.description || row.specifications || '') || null,
    specs,
    stores: [
      {
        key: 'decathlon-es',
        name: 'Decathlon ES',
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
  console.log('🎾  PadelCost - Decathlon ES\n');

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

  const outputPath = path.resolve(__dirname, CONFIG.outputDir, 'decathlon-data.js');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  const content = [
    `// PadelCost - Decathlon ES`,
    `// Gerado em: ${new Date().toISOString()}`,
    `window.PADELCOST_DECATHLON_PRODUCTS = ${JSON.stringify(offers, null, 2)};`,
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
