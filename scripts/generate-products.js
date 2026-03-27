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
  'equipamento desportivo > pá':        'raquetes',
  'equipamento desportivo > raquete':   'raquetes',
  'equipamento desportivo > bolas':     'bolas',
  'acessórios > bolas':                 'bolas',
  'acessórios > paletero':              'acessorios',
  'acessórios > mochila':               'acessorios',
  'acessórios > overgrip':              'acessorios',
  'acessórios > pega':                  'acessorios',
  'acessórios > tampa':                 'acessorios',
  'acessórios > antivibrador':          'acessorios',
  'acessórios > saco de desporto':      'acessorios',
  'acessórios > pulverizar':            'acessorios',
  'sapatilhas > sapatilhas':            'sapatilhas',
  'sapatilhas > sandálias':             'sapatilhas',
  'vestuário > t-shirt':                'vestuario',
  'vestuário > calças':                 'vestuario',
  'vestuário > saia':                   'vestuario',
  'vestuário > sweatshirt':             'vestuario',
  'vestuário > pólo':                   'vestuario',
  'vestuário > conjunto':               'vestuario',
  'vestuário > casaco':                 'vestuario',
  'vestuário > vestido':                'vestuario',
  'vestuário > soutien desportivo':     'vestuario',
  'vestuário > rede':                   'vestuario',
};

// Só incluímos produtos com estas palavras no nome OU tipo
const PADEL_KEYWORDS = ['padel', 'pádel'];

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

function mapCategory(productType) {
  const key = (productType || '').toLowerCase();
  return CATEGORY_MAP[key] || 'acessorios';
}

function cleanPrice(val) {
  const n = parseFloat(val);
  return isNaN(n) ? null : Math.round(n * 100) / 100;
}

function bestImage(row) {
  // Preferir imagem do merchant (maior resolução)
  const merch = (row.merchant_image_url || '').trim();
  const awin  = (row.aw_image_url       || '').trim();
  return merch || awin || '';
}

// ─── Transformação de linha CSV → produto ────────────────────────────────────

function rowToProduct(row, id) {
  const price = cleanPrice(row.search_price) || cleanPrice(row.store_price);
  const category = mapCategory(row.product_type);

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
    specs: {
      // Campos que o feed não fornece ficam a null
      // O UI mostra '-' quando o valor é null/undefined
      peso:       null,
      forma:      null,
      equilibrio: null,
      nivel:      null,
      material:   null,
      estilo:     null,
    },
    stores: [
      {
        name:  'Atmosfera Sport',
        price,
        stock: 'Em stock',
        url:   row.aw_deep_link || row.merchant_deep_link || '',
      },
    ],
  };
}

// ─── Download do feed ─────────────────────────────────────────────────────────

function buildFeedUrl() {
  const cols = [
    'aw_deep_link', 'product_name', 'aw_product_id', 'merchant_product_id',
    'merchant_image_url', 'description', 'merchant_category', 'search_price',
    'merchant_name', 'merchant_id', 'category_name', 'category_id',
    'aw_image_url', 'currency', 'store_price', 'merchant_deep_link',
    'language', 'last_updated', 'display_price', 'data_feed_id',
    'brand_name', 'product_model', 'product_type',
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
  return new Promise((resolve, reject) => {
    console.log('⬇️  A descarregar feed da Awin...');
    https.get(url, (res) => {
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
  const CATEGORY_ORDER = ['raquetes', 'bolas', 'sapatilhas', 'acessorios', 'vestuario'];
  unique.sort((a, b) => {
    const catA = CATEGORY_ORDER.indexOf(mapCategory(a.product_type));
    const catB = CATEGORY_ORDER.indexOf(mapCategory(b.product_type));
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
