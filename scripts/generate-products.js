/**
 * PadelCost - Gerador de Catálogo
 * --------------------------------
 * Lê o feed CSV da Awin (Atmosfera Sport), filtra produtos de padel,
 * elimina duplicados e gera /data/products-data.js pronto para o site.
 *
 * Uso:
 *   npm install
 *   npm run generate
 *
 * Pré-requisitos:
 *   - Copia .env.example para .env e preenche com os teus dados
 *   - npm install
 */

require('dotenv').config();
const https = require('https');
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse');

// ─── Configuração ──────────────────────────────────────────────────────────────

const CONFIG = {
  apiKey:      process.env.AWIN_API_KEY,
  feedUrl:     process.env.AWIN_FEED_URL || '',
  feedId:      process.env.AWIN_FEED_ID      || '108048',
  publisherId: process.env.AWIN_PUBLISHER_ID || '2816502',
  maxProducts: parseInt(process.env.MAX_PRODUCTS || '0'),
  outputDir:   process.env.OUTPUT_DIR || '../data',
};

if (!CONFIG.apiKey) {
  console.error('❌  AWIN_API_KEY não definida. Cria o ficheiro .env a partir de .env.example');
  process.exit(1);
}

// ─── Mapeamento de categorias ──────────────────────────────────────────────────
// product_type do feed → categoria do PadelCost

const CATEGORY_MAP = {
  'equipamento desportivo > pa':        'raquetes',
  'equipamento desportivo > raquete':   'raquetes',
  'equipamento desportivo > bolas':     'bolas',
  'acessorios > bolas':                 'bolas',
  'acessorios > paletero':              'sacos',
  'acessorios > mochila':               'sacos',
  'acessorios > overgrip':              'acessorios',
  'acessorios > pega':                  'acessorios',
  'acessorios > tampa':                 'acessorios',
  'acessorios > antivibrador':          'acessorios',
  'acessorios > saco de desporto':      'sacos',
  'acessorios > pulverizar':            'acessorios',
  'sapatilhas > sapatilhas':            'sapatilhas',
  'sapatilhas > sandalias':             'sapatilhas',
  'vestuario > t-shirt':                'roupa',
  'vestuario > calcas':                 'roupa',
  'vestuario > saia':                   'roupa',
  'vestuario > sweatshirt':             'roupa',
  'vestuario > polo':                   'roupa',
  'vestuario > conjunto':               'roupa',
  'vestuario > casaco':                 'roupa',
  'vestuario > vestido':                'roupa',
  'vestuario > soutien desportivo':     'roupa',
  'vestuario > rede':                   'roupa',
};

// Só incluímos produtos com estas palavras no nome OU tipo
const PADEL_KEYWORDS = ['padel', 'pádel'];

const CATEGORY_KEYWORDS = {
  raquetes: [
    'raquete', 'raquetes', 'pá', 'pás', 'pala', 'palas',
  ],
  sapatilhas: [
    'sapatilha', 'sapatilhas', 'shoe', 'shoes', 'zapatilla', 'zapatillas',
    'sandália', 'sandalias', 'sandálias',
  ],
  sacos: [
    'paletero', 'mochila', 'backpack', 'racket bag', 'padel bag', 'duffle',
    'duffel', 'bag', 'bolsa', 'saco de desporto', 'saco para padel', 'saco para pádel',
    'mochila multigame', 'mochila protour', 'tour bag',
  ],
  roupa: [
    'polo', 'pólo', 't-shirt', 'camiseta', 'camisola', 'saia', 'vestido',
    'legging', 'leggings', 'calção', 'calções', 'short', 'shorts',
    'sweatshirt', 'hoodie', 'top', 'casaco', 'soutien desportivo',
  ],
  bolas: [
    'bola', 'bolas', 'ball', 'balls', 'pelota', 'pelotas', 'tubo de bolas',
  ],
  acessorios: [
    'overgrip', 'grip', 'pega', 'munhequeira', 'munhequeiras', 'boné', 'bone',
    'viseira', 'garrafa', 'toalha', 'toalhas', 'protetor', 'protector',
    'paletero', 'mochila', 'saco de desporto', 'antivibrador', 'tampa',
    'pulseira', 'pulseiras', 'visera', 'contrapeso', 'contrapesos',
    'custom weight', 'fire damp', 'shockout', 'wallet', 'shoe bag',
    'accessory bag', 'pick up ball', 'meias', 'meia', 'sock', 'socks',
    'sandalia', 'sandália', 'chinelo', 'chinelos', 'slide', 'slides',
    'footgel', 'gel',
  ],
};

// ─── Utilitários ───────────────────────────────────────────────────────────────

function slugify(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function isPadelProduct(row) {
  const name  = (row.product_name   || '').toLowerCase();
  const type  = (row.product_type   || '').toLowerCase();
  return PADEL_KEYWORDS.some(kw => name.includes(kw) || type.includes(kw));
}

function normalizeText(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function includesAnyKeyword(text, keywords) {
  return keywords.some(keyword => text.includes(keyword));
}

function mapCategory(row) {
  const productType = normalizeText(row.product_type);
  const merchantCategory = normalizeText(row.merchant_category);
  const categoryName = normalizeText(row.category_name);
  const name = normalizeText(row.product_name);
  const description = normalizeText(row.description);

  for (const source of [productType, merchantCategory, categoryName]) {
    if (CATEGORY_MAP[source]) return CATEGORY_MAP[source];
  }

  const combined = [productType, merchantCategory, categoryName, name, description]
    .filter(Boolean)
    .join(' | ');

  // Prioridade alta: roupa tem de ganhar logo para não cair em acessórios.
  if (includesAnyKeyword(combined, CATEGORY_KEYWORDS.roupa)) return 'roupa';
  if (includesAnyKeyword(combined, CATEGORY_KEYWORDS.sacos)) return 'sacos';
  if (includesAnyKeyword(combined, CATEGORY_KEYWORDS.acessorios)) return 'acessorios';
  if (includesAnyKeyword(combined, CATEGORY_KEYWORDS.raquetes)) return 'raquetes';
  if (includesAnyKeyword(combined, CATEGORY_KEYWORDS.sapatilhas)) return 'sapatilhas';
  if (includesAnyKeyword(combined, CATEGORY_KEYWORDS.bolas)) return 'bolas';

  return 'acessorios';
}

function cleanPrice(val) {
  const n = parseFloat(val);
  return isNaN(n) ? null : Math.round(n * 100) / 100;
}

function bestImage(row) {
  // Preferir imagem do merchant (maior resolução)
  const large = (row.large_image       || '').trim();
  const merch = (row.merchant_image_url || '').trim();
  const awin  = (row.aw_image_url       || '').trim();
  return large || merch || awin || '';
}

function normalizeSpaces(str) {
  return (str || '').replace(/\s+/g, ' ').trim();
}

function extractRacketSpecs(row) {
  const textRaw = normalizeSpaces([
    row.description,
    row.product_name,
    row.product_model,
    row.product_type,
    row.specifications,
  ].filter(Boolean).join(' '));
  const text = normalizeText(textRaw);

  const weightRangeMatch =
    text.match(/(\d{2,3})\s*(?:-|–|a|ate|to|e)\s*(\d{2,3})\s*(?:g|gr|grama|gramas)/);
  const weightSingleMatch = text.match(/(\d{2,3}(?:[.,]\d+)?)\s*(?:g|gr|grama|gramas)/);

  let peso = null;
  if (weightRangeMatch) {
    peso = `${weightRangeMatch[1]}-${weightRangeMatch[2]}g`;
  } else if (weightSingleMatch) {
    peso = `${weightSingleMatch[1].replace(',', '.')}g`;
  }

  let forma = null;
  if (/\bdiamante\b/.test(text)) forma = 'Diamante';
  else if (/\b(redond|round)\b/.test(text)) forma = 'Redonda';
  else if (/\blagrima\b|\bteardrop\b|\bhybrid\b|\bhibrid/.test(text)) forma = 'Híbrida';

  let equilibrio = null;
  if (/\b(balance|equilibrio|balanco)\s+(alto|high)\b|\balto\b/.test(text)) equilibrio = 'Alto';
  else if (/\b(balance|equilibrio|balanco)\s+(medio|médio|mid|medium)\b|\bmedio\b|\bmédio\b/.test(text)) equilibrio = 'Médio';
  else if (/\b(balance|equilibrio|balanco)\s+(baixo|low)\b|\bbaixo\b/.test(text)) equilibrio = 'Baixo';

  let nivel = null;
  if (/\bprofission|\bcompeti/.test(text)) nivel = 'Profissional';
  else if (/\bavancad|\bexpert|\bexperient|\bexigent/.test(text)) nivel = 'Avançado';
  else if (/\bintermed/.test(text)) nivel = 'Intermédio';
  else if (/\binician|\bbeginner|\bprincipiante/.test(text)) nivel = 'Iniciante';

  let material = null;
  const carbonMatch = textRaw.match(/\bcarbon(?:o)?\s*(24k|18k|16k|12k|6k|3k)?/i);
  if (carbonMatch) {
    material = carbonMatch[1] ? `Carbono ${carbonMatch[1].toUpperCase()}` : 'Carbono';
  } else if (/fibra de vidro|fiberglass|fiber glass/i.test(textRaw)) {
    material = 'Fibra de vidro';
  } else if (/kevlar/i.test(textRaw)) {
    material = 'Kevlar';
  }

  let estilo = null;
  const controlPct = text.match(/controlo?\s*(?:de)?\s*(\d{1,3})%/);
  const powerPct = text.match(/potencia\s*(?:de)?\s*(\d{1,3})%/);
  if (controlPct && powerPct) {
    const c = parseInt(controlPct[1], 10);
    const p = parseInt(powerPct[1], 10);
    if (Math.abs(c - p) <= 10) estilo = 'Equilibrado';
    else estilo = c > p ? 'Controlo' : 'Potência';
  } else if (/controlo|control/.test(text) && /potencia/.test(text)) {
    estilo = 'Equilibrado';
  } else if (/controlo|control/.test(text)) {
    estilo = 'Controlo';
  } else if (/potencia|power/.test(text)) {
    estilo = 'Potência';
  }

  return {
    peso,
    forma,
    equilibrio,
    nivel,
    material,
    estilo,
  };
}

function extractShoeSpecs(row) {
  const textRaw = normalizeSpaces([
    row.description,
    row.product_name,
    row.product_type,
    row.merchant_product_category_path,
  ].filter(Boolean).join(' '));
  const text = normalizeText(textRaw);

  let sola = null;
  if (/\bclay\b|\bespiga\b|\bspiga\b/.test(text)) sola = 'Clay / Espiga';
  else if (/\bomni\b|\ball court\b|\btodo tipo de pista\b/.test(text)) sola = 'Omni / All Court';
  else if (/\bpadel\b/.test(text)) sola = 'Pádel';

  let genero = null;
  const suitableFor = normalizeText(row['Fashion:suitable_for']);
  if (suitableFor === 'male') genero = 'Homem';
  else if (suitableFor === 'female') genero = 'Mulher';
  else if (/\bhomem\b|\bmasculin/.test(text)) genero = 'Homem';
  else if (/\bmulher\b|\bfeminin/.test(text)) genero = 'Mulher';
  else if (/\bunissex\b/.test(text)) genero = 'Unissexo';

  const cor = normalizeSpaces(row.colour) || null;

  let uso = null;
  if (/\bcompeticao\b|\bcompetitiv/.test(text)) uso = 'Competição';
  else if (/\bintenso\b|\balta intensidade\b/.test(text)) uso = 'Intenso';
  else if (/\beventual\b|\bocasional\b|\bcasual\b/.test(text)) uso = 'Eventual';
  else if (/\bpista de padel\b|\bpádel\b|\bpadel\b/.test(text)) uso = 'Pádel';

  let amortecimento = null;
  if (/\bboost\b|\benerzy\b|\bfoam\b|\bamortec/.test(text)) amortecimento = 'Alto';
  else if (/\bacolchoad/.test(text)) amortecimento = 'Médio';

  return {
    sola,
    genero,
    cor,
    uso,
    amortecimento,
  };
}

// ─── Transformação de linha CSV → produto ────────────────────────────────────

function rowToProduct(row, id) {
  const price = cleanPrice(row.search_price) || cleanPrice(row.store_price);
  const category = mapCategory(row);
  const ean = row.ean || row.product_GTIN || row.upc || null;
  const mpn = row.mpn || row.model_number || row.product_model || null;
  const parsedSpecs = category === 'raquetes' ? extractRacketSpecs(row) : null;
  const parsedShoeSpecs = category === 'sapatilhas' ? extractShoeSpecs(row) : null;
  const stock =
    (row.stock_status || '').trim() ||
    ((row.in_stock || '').toString().toLowerCase() === '1' ? 'Em stock' : '') ||
    ((row.in_stock || '').toString().toLowerCase() === 'yes' ? 'Em stock' : '') ||
    'Em stock';

  return {
    id,
    name:     row.product_name || '',
    brand:    row.brand_name   || '',
    category,
    price,
    oldPrice: null,
    rating:   null,       // feed não tem rating; podes preencher manualmente
    badge:    null,
    image:    bestImage(row),
    ean,
    productGTIN: row.product_GTIN || null,
    mpn,
    source:   'atmosfera-sport',
    sourceProductId: row.merchant_product_id || row.aw_product_id || null,
    sourceCategory: row.merchant_category || row.category_name || row.product_type || null,
    specs: {
      peso:       parsedSpecs?.peso ?? null,
      forma:      parsedSpecs?.forma ?? null,
      equilibrio: parsedSpecs?.equilibrio ?? null,
      nivel:      parsedSpecs?.nivel ?? null,
      material:   parsedSpecs?.material ?? null,
      estilo:     parsedSpecs?.estilo ?? null,
      sola:       parsedShoeSpecs?.sola ?? null,
      genero:     parsedShoeSpecs?.genero ?? null,
      cor:        parsedShoeSpecs?.cor ?? null,
      uso:        parsedShoeSpecs?.uso ?? null,
      amortecimento: parsedShoeSpecs?.amortecimento ?? null,
    },
    stores: [
      {
        key:   'atmosfera-sport',
        name:  'Atmosfera Sport',
        price,
        stock,
        url:   row.aw_deep_link || row.merchant_deep_link || '',
        deliveryCost: cleanPrice(row.delivery_cost),
      },
    ],
  };
}

// ─── Download do feed ─────────────────────────────────────────────────────────

function buildFeedUrl() {
  if (CONFIG.feedUrl) {
    return CONFIG.feedUrl;
  }

  const cols = [
    'aw_deep_link', 'product_name', 'aw_product_id', 'merchant_product_id',
    'merchant_image_url', 'description', 'merchant_category', 'search_price',
    'merchant_name', 'merchant_id', 'category_name', 'category_id',
    'aw_image_url', 'currency', 'store_price', 'delivery_cost', 'merchant_deep_link',
    'language', 'last_updated', 'display_price', 'data_feed_id',
    'brand_name', 'brand_id', 'colour', 'specifications', 'product_model',
    'model_number', 'product_type', 'merchant_product_category_path',
    'rrp_price', 'saving', 'base_price', 'base_price_text', 'product_price_old',
    'ean', 'isbn', 'upc', 'mpn', 'parent_product_id', 'product_GTIN',
    'in_stock', 'stock_status', 'savings_percent', 'base_price_amount',
    'delivery_time', 'large_image', 'basket_link',
  ].join(',');

  return [
    'https://productdata.awin.com/datafeed/download',
    `apikey/${CONFIG.apiKey}`,
    'language/pt',
    `fid/${CONFIG.feedId}`,
    'rid/0',
    'hasEnhancedFeeds/0',
    `columns/${cols}`,
    'format/csv',
    'delimiter/%2C',
    'compression/gzip',
    'adultcontent/1',
  ].join('/');
}

function downloadFeed(url) {
  return downloadFeedWithRedirects(url, 0);
}

function downloadFeedWithRedirects(url, depth) {
  return new Promise((resolve, reject) => {
    console.log('⬇️  A descarregar feed da Awin...');
    https.get(url, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        if (depth >= 5) {
          return reject(new Error('Demasiados redirecionamentos ao descarregar o feed'));
        }
        const nextUrl = new URL(res.headers.location, url).toString();
        res.resume();
        return resolve(downloadFeedWithRedirects(nextUrl, depth + 1));
      }

      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const chunks = [];
      const gunzip = zlib.createGunzip();
      res.pipe(gunzip);
      gunzip.on('data', chunk => chunks.push(chunk));
      gunzip.on('end',  () => resolve(Buffer.concat(chunks)));
      gunzip.on('error', reject);
      res.on('error', reject);
    }).on('error', reject);
  });
}

// ─── Parse CSV ────────────────────────────────────────────────────────────────

function parseCsv(buffer) {
  return new Promise((resolve, reject) => {
    parse(buffer, {
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true,
    }, (err, records) => {
      if (err) return reject(err);
      resolve(records);
    });
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🎾  PadelCost - Gerador de Catálogo\n');

  // 1. Download
  const url    = buildFeedUrl();
  const buffer = await downloadFeed(url);
  console.log(`✅  Feed descarregado (${(buffer.length / 1024 / 1024).toFixed(1)} MB)`);

  // 2. Parse
  const rows = await parseCsv(buffer);
  console.log(`📦  Total de linhas no feed: ${rows.length.toLocaleString()}`);

  // 3. Filtrar padel
  const padelRows = rows.filter(isPadelProduct);
  console.log(`🎯  Produtos de padel encontrados: ${padelRows.length.toLocaleString()}`);

  // 4. Deduplicar por nome + marca (variantes de cor/tamanho ficam como 1 produto)
  const seen = new Map();
  for (const row of padelRows) {
    const key = `${row.product_name}||${row.brand_name}`;
    if (!seen.has(key)) seen.set(key, row);
  }
  let unique = Array.from(seen.values());
  console.log(`🔁  Após deduplicação: ${unique.length} produtos únicos`);

  // 5. Ordenar: raquetes primeiro, depois resto por nome
  const CATEGORY_ORDER = ['raquetes', 'bolas', 'sapatilhas', 'sacos', 'roupa', 'acessorios'];
  unique.sort((a, b) => {
    const catA = CATEGORY_ORDER.indexOf(mapCategory(a));
    const catB = CATEGORY_ORDER.indexOf(mapCategory(b));
    if (catA !== catB) return catA - catB;
    return a.product_name.localeCompare(b.product_name, 'pt');
  });

  // 6. Limitar se configurado
  if (CONFIG.maxProducts > 0) {
    unique = unique.slice(0, CONFIG.maxProducts);
    console.log(`✂️   Limitado a ${CONFIG.maxProducts} produtos`);
  }

  // 7. Transformar para estrutura do PadelCost
  const products = unique.map((row, i) => rowToProduct(row, i + 1));

  // 8. Gerar ficheiro JS
  const outputPath = path.resolve(__dirname, CONFIG.outputDir, 'products-data.js');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  const now = new Date().toISOString();
  const content = [
    `// PadelCost - Catálogo gerado automaticamente`,
    `// Gerado em: ${now}`,
    `// Produtos: ${products.length}`,
    `// NÃO EDITES ESTE FICHEIRO MANUALMENTE - é gerado pelo script generate-products.js`,
    `// NÃO COMMITAS chaves de API - este ficheiro apenas contém dados públicos`,
    ``,
    `window.PADELCOST_PRODUCTS = ${JSON.stringify(products, null, 2)};`,
  ].join('\n');

  fs.writeFileSync(outputPath, content, 'utf8');

  console.log(`\n✅  Ficheiro gerado: ${outputPath}`);
  console.log(`📊  Resumo por categoria:`);

  // Sumário
  const summary = {};
  for (const p of products) {
    summary[p.category] = (summary[p.category] || 0) + 1;
  }
  for (const [cat, count] of Object.entries(summary)) {
    console.log(`     ${cat.padEnd(15)} ${count} produtos`);
  }
  console.log(`\n🚀  Passo seguinte: faz commit de /data/products-data.js para o repositório de teste`);
}

main().catch(err => {
  console.error('❌  Erro:', err.message);
  process.exit(1);
});
