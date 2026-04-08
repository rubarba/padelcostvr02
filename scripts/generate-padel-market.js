/**
 * PadelCost - Gerador Padel Market (AWIN)
 * ---------------------------------------
 * Lê o feed CSV do Padel Market na AWIN, filtra produtos relevantes e gera um
 * ficheiro normalizado com ofertas da loja.
 */

require('dotenv').config();
const https = require('https');
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse');

const CONFIG = {
  feedUrl: process.env.PADEL_MARKET_FEED_URL || '',
  maxProducts: parseInt(process.env.MAX_PRODUCTS_PADEL_MARKET || process.env.MAX_PRODUCTS || '0', 10),
  outputDir: process.env.OUTPUT_DIR || '../data',
};

const INCLUDE_KEYWORDS = ['padel', 'pádel'];
const EXCLUDE_KEYWORDS = [
  'pickleball',
  'beach tennis',
  'tenis de praia',
  'tênis de praia',
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

function cleanPrice(value) {
  if (value == null || value === '') return null;
  const normalized = String(value).replace(',', '.').replace(/[^0-9.]/g, '');
  const n = parseFloat(normalized);
  return Number.isNaN(n) ? null : Math.round(n * 100) / 100;
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
  else if (/\bredonda\b|\bredond\b|\bround\b/.test(text)) forma = 'Redonda';
  else if (/\bhibrida\b|\bhibrid\b|\bhybrid\b|\blagrima\b|\bteardrop\b/.test(text)) forma = 'Híbrida';

  let equilibrio = null;
  if (/\bequilibrio alto\b|\bbalance high\b|\bhigh balance\b/.test(text)) equilibrio = 'Alto';
  else if (/\bequilibrio medio\b|\bequilibrio médio\b|\bbalance medium\b|\bmedium balance\b/.test(text)) equilibrio = 'Médio';
  else if (/\bequilibrio baixo\b|\bbalance low\b|\blow balance\b/.test(text)) equilibrio = 'Baixo';

  let nivel = null;
  if (/\bprofission|\bcompetition\b|\bcompeti/.test(text)) nivel = 'Profissional';
  else if (/\bavancad|\bavançad|\bexpert|\badvanced/.test(text)) nivel = 'Avançado';
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
  if (/\bmulher\b|\bwoman\b|\bwomen\b|\bfeminin/.test(text)) genero = 'Mulher';
  else if (/\bhomem\b|\bman\b|\bmen\b|\bmasculin/.test(text)) genero = 'Homem';
  else if (/\bunissex\b/.test(text)) genero = 'Unissexo';

  let cor = null;
  if (/\bazul\b|\bblue\b/.test(lowerName)) cor = 'Azul';
  else if (/\brosa\b|\bpink\b/.test(lowerName)) cor = 'Rosa';
  else if (/\bbranco\b|\bwhite\b/.test(lowerName)) cor = 'Branco';
  else if (/\bpreto\b|\bblack\b/.test(lowerName)) cor = 'Preto';
  else if (/\bverde\b|\bgreen\b/.test(lowerName)) cor = 'Verde';
  else if (/\bvermelho\b|\bred\b/.test(lowerName)) cor = 'Vermelho';
  else if (/\bamarelo\b|\byellow\b/.test(lowerName)) cor = 'Amarelo';

  let uso = null;
  if (/\bcompeti|\bcompetition\b/.test(text)) uso = 'Competição';
  else if (/\bintens/.test(text)) uso = 'Intenso';
  else if (/\bpadel\b/.test(text)) uso = 'Pádel';

  let amortecimento = null;
  if (/\bboost\b|\blightstrike\b|\bcushion|\bfoam\b|\bamort/.test(text)) amortecimento = 'Alto';

  return { sola, genero, cor, uso, amortecimento };
}

function fetchFeed(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (!url) {
      return reject(new Error('PADEL_MARKET_FEED_URL não definida.'));
    }

    console.log('⬇️  A descarregar feed do Padel Market...');
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

function isPadelProduct(row) {
  const haystack = normalizeText([
    row.product_name,
    row.description,
    row.product_short_description,
    row.specifications,
    row.keywords,
    row.promotional_text,
    row.merchant_category,
    row.category_name,
    row.merchant_product_second_category,
    row.merchant_product_third_category,
    row.merchant_product_category_path,
    row.product_type,
  ].filter(Boolean).join(' | '));

  if (!includesAny(haystack, INCLUDE_KEYWORDS)) return false;
  if (includesAny(haystack, EXCLUDE_KEYWORDS)) return false;

  return true;
}

function mapCategory(row) {
  const combined = normalizeText([
    row.product_name,
    row.merchant_category,
    row.category_name,
    row.merchant_product_second_category,
    row.merchant_product_third_category,
    row.merchant_product_category_path,
    row.product_type,
  ].filter(Boolean).join(' | '));

  if (
    combined.includes('meia') ||
    combined.includes('meias') ||
    combined.includes('sock') ||
    combined.includes('sandalia') ||
    combined.includes('sandália') ||
    combined.includes('chinelo') ||
    combined.includes('slide') ||
    combined.includes('footgel')
  ) return 'acessorios';

  if (
    combined.includes('paletero') ||
    combined.includes('mochila') ||
    combined.includes('mala') ||
    combined.includes('bolsa') ||
    combined.includes('bag') ||
    combined.includes('backpack') ||
    combined.includes('duffle') ||
    combined.includes('weekend')
  ) return 'sacos';

  if (
    combined.includes('sapatilha') ||
    combined.includes('zapatilla') ||
    combined.includes('shoe') ||
    combined.includes('shoes') ||
    combined.includes('tenis')
  ) return 'sapatilhas';

  if (combined.includes('bola') || combined.includes('ball')) return 'bolas';

  if (
    combined.includes('camiseta') ||
    combined.includes('camisola') ||
    combined.includes('t-shirt') ||
    combined.includes('polo') ||
    combined.includes('saia') ||
    combined.includes('vestido') ||
    combined.includes('short') ||
    combined.includes('calcao') ||
    combined.includes('calcao') ||
    combined.includes('leggings') ||
    combined.includes('sweatshirt') ||
    combined.includes('hoodie')
  ) return 'roupa';

  if (combined.includes('raquete') || combined.includes('pala') || combined.includes('racket')) return 'raquetes';

  return 'acessorios';
}

function rowToOffer(row, id) {
  const price = cleanPrice(row.search_price || row.store_price || row.display_price || row.base_price);
  const oldPrice = cleanPrice(row.rrp_price || row.base_price || row.display_price);
  const category = mapCategory(row);
  const parsedSpecs = category === 'raquetes' ? extractRacketSpecs(row) : null;
  const parsedShoeSpecs = category === 'sapatilhas' ? extractShoeSpecs(row) : null;
  const rating = cleanPrice(row.average_rating || row.rating);

  return {
    id,
    slug: slugify(`${row.product_name}-${row.aw_product_id || row.merchant_product_id || id}`),
    name: row.product_name || '',
    brand: row.brand_name || '',
    category,
    price,
    oldPrice: oldPrice && oldPrice > price ? oldPrice : null,
    rating,
    badge: null,
    image: (row.large_image || row.aw_image_url || row.merchant_image_url || row.alternate_image || row.merchant_thumb_url || '').trim(),
    ean: row.ean || null,
    productGTIN: row.product_GTIN || null,
    mpn: row.mpn || row.model_number || null,
    source: 'padel-market',
    sourceProductId: row.aw_product_id || row.merchant_product_id || null,
    sourceCategory: row.merchant_product_category_path || row.merchant_category || row.category_name || null,
    specs: {
      peso: parsedSpecs?.peso ?? null,
      forma: parsedSpecs?.forma ?? null,
      equilibrio: parsedSpecs?.equilibrio ?? null,
      nivel: parsedSpecs?.nivel ?? null,
      material: parsedSpecs?.material ?? null,
      estilo: parsedSpecs?.estilo ?? null,
      sola: parsedShoeSpecs?.sola ?? null,
      genero: parsedShoeSpecs?.genero ?? null,
      cor: parsedShoeSpecs?.cor ?? null,
      uso: parsedShoeSpecs?.uso ?? null,
      amortecimento: parsedShoeSpecs?.amortecimento ?? null,
    },
    stores: [
      {
        key: 'padel-market',
        name: 'Padel Market',
        price,
        stock: row.stock_status || (String(row.in_stock).toLowerCase() === '1' || String(row.in_stock).toLowerCase() === 'true' ? 'Em stock' : 'Disponibilidade por confirmar'),
        url: row.aw_deep_link || row.merchant_deep_link || '',
      },
    ],
  };
}

async function main() {
  console.log('🎾  PadelCost - Padel Market\n');

  const raw = await fetchFeed(CONFIG.feedUrl);
  const rows = await parseCsv(raw);
  console.log(`📦  Total de linhas no feed: ${rows.length.toLocaleString()}`);

  const padelRows = rows.filter(isPadelProduct);
  console.log(`🎯  Produtos de padel válidos: ${padelRows.length.toLocaleString()}`);

  const seen = new Map();
  for (const row of padelRows) {
    const key = row.ean || row.product_GTIN || row.mpn || `${row.product_name}||${row.merchant_product_category_path || row.merchant_category}`;
    if (!seen.has(key)) seen.set(key, row);
  }

  let unique = Array.from(seen.values());
  if (CONFIG.maxProducts > 0) {
    unique = unique.slice(0, CONFIG.maxProducts);
    console.log(`✂️   Limitado a ${CONFIG.maxProducts} produtos`);
  }

  const offers = unique.map((row, i) => rowToOffer(row, i + 1)).filter(offer => offer.name && offer.price != null);

  const outputPath = path.resolve(__dirname, CONFIG.outputDir, 'padel-market-data.js');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  const now = new Date().toISOString();
  const content = [
    `// PadelCost - Padel Market normalizado automaticamente`,
    `// Gerado em: ${now}`,
    `// Produtos: ${offers.length}`,
    ``,
    `window.PADELCOST_PADEL_MARKET_PRODUCTS = ${JSON.stringify(offers, null, 2)};`,
  ].join('\n');

  fs.writeFileSync(outputPath, content, 'utf8');

  console.log(`\n✅  Ficheiro gerado: ${outputPath}`);
  const summary = {};
  for (const offer of offers) {
    summary[offer.category] = (summary[offer.category] || 0) + 1;
  }
  console.log('📊  Resumo por categoria:');
  for (const [cat, count] of Object.entries(summary)) {
    console.log(`     ${cat.padEnd(15)} ${count} produtos`);
  }
  console.log('\n🧩  Próximo passo: fazer merge destas ofertas com o catálogo principal.');
}

main().catch(err => {
  console.error('❌  Erro:', err.message);
  process.exit(1);
});
