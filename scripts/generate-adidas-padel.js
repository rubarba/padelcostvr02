/**
 * PadelCost - Gerador Adidas Padel (TradeTracker)
 * -----------------------------------------------
 * Lê o feed CSV da Adidas Padel (TradeTracker), filtra apenas produtos
 * relevantes de padel e gera um ficheiro normalizado com ofertas da loja.
 *
 * Este script NÃO substitui o catálogo principal. O objetivo é preparar
 * dados limpos por loja para depois fazermos merge das ofertas.
 */

require('dotenv').config();
const https = require('https');
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse');
const { normalizeProductName } = require('./name-normalization');
const { isCoreCatalogProduct } = require('./category-rules');

const CONFIG = {
  feedUrl:
    process.env.ADIDAS_PADEL_FEED_URL ||
    'https://pf.tradetracker.net/?aid=507738&encoding=utf-8&type=csv&fid=2238500&categoryType=2&additionalType=2&csvDelimiter=%3B&csvEnclosure=%22&filter_extended=1',
  maxProducts: parseInt(process.env.MAX_PRODUCTS_ADIDAS || process.env.MAX_PRODUCTS || '0', 10),
  outputDir: process.env.OUTPUT_DIR || '../data',
};

const INCLUDE_KEYWORDS = ['padel', 'pádel'];
const EXCLUDE_KEYWORDS = [
  'pickleball',
  'tênis de praia',
  'tenis de praia',
  'beach tennis',
  'sales',
  'caixa de presente',
  'gift box',
];

function normalizeText(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function includesAny(text, keywords) {
  return keywords.some(keyword => text.includes(keyword));
}

function cleanPrice(value) {
  const n = parseFloat(value);
  return Number.isNaN(n) ? null : Math.round(n * 100) / 100;
}

function slugify(str) {
  return normalizeText(str).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function normalizeSpaces(str) {
  return (str || '').replace(/\s+/g, ' ').trim();
}

function extractRacketSpecs(row) {
  const textRaw = normalizeSpaces([
    row.description,
    row.name,
    row.categories,
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
    row.name,
    row.categories,
  ].filter(Boolean).join(' '));
  const text = normalizeText(textRaw);

  let sola = null;
  if (/\bclay\b|\bespiga\b|\bspiga\b/.test(text)) sola = 'Clay / Espiga';
  else if (/\bomni\b|\ball court\b/.test(text)) sola = 'Omni / All Court';
  else if (/\bpadel\b/.test(text)) sola = 'Pádel';

  let genero = null;
  if (/\b ls w\b|\bmulher\b|\bfeminin|\bw\b/.test(` ${text} `)) genero = 'Mulher';
  else if (/\b ls m\b|\bhomem\b|\bmasculin|\bm\b/.test(` ${text} `)) genero = 'Homem';
  else if (/\bunissex\b/.test(text)) genero = 'Unissexo';

  let cor = null;
  const lowerName = normalizeText(row.name);
  if (/\bazul\b/.test(lowerName)) cor = 'Azul';
  else if (/\brosa\b/.test(lowerName)) cor = 'Rosa';
  else if (/\bbranco\b|\bblanco\b/.test(lowerName)) cor = 'Branco';
  else if (/\bpreto\b|\bnegro\b/.test(lowerName)) cor = 'Preto';
  else if (/\bverde\b/.test(lowerName)) cor = 'Verde';
  else if (/\bvermelho\b|\bred\b/.test(lowerName)) cor = 'Vermelho';

  let uso = null;
  if (/\bcompeticao\b|\bcompetitive/.test(text)) uso = 'Competição';
  else if (/\bacao rapida\b|\bacao alucinante\b|\bquick\b/.test(text)) uso = 'Intenso';
  else if (/\bpadel\b/.test(text)) uso = 'Pádel';

  let amortecimento = null;
  if (/\bboost\b|\blightstrike\b|\bcushion|\bfoam\b/.test(text)) amortecimento = 'Alto';

  return {
    sola,
    genero,
    cor,
    uso,
    amortecimento,
  };
}

function fetchFeed(url) {
  return new Promise((resolve, reject) => {
    console.log('⬇️  A descarregar feed da Adidas Padel...');
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
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
        delimiter: ';',
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
    row.name,
    row.description,
    row.categories,
  ].filter(Boolean).join(' | '));

  if (includesAny(haystack, EXCLUDE_KEYWORDS)) return false;

  if (includesAny(haystack, INCLUDE_KEYWORDS)) return true;

  const category = mapCategory(row);
  return isCoreCatalogProduct({ category, name: row.name || '' });
}

function mapCategory(row) {
  const cat = normalizeText(row.categories);
  const name = normalizeText(row.name);
  const combined = `${cat} | ${name}`;

  if (
    combined.includes('bolsa') ||
    combined.includes('paletero') ||
    combined.includes('mochila') ||
    combined.includes('sacos de padel') ||
    combined.includes('mala') ||
    combined.includes('bag') ||
    combined.includes('backpack')
  ) return 'sacos';
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
    combined.includes('sapatos de padel') ||
    combined.includes('sapatilha') ||
    combined.includes('zapatilla')
  ) return 'sapatilhas';
  if (combined.includes('raquete') || combined.includes('pala')) return 'raquetes';
  if (combined.includes('bola')) return 'bolas';

  return 'acessorios';
}

function rowToOffer(row, id) {
  const price = cleanPrice(row.price);
  const category = mapCategory(row);
  const parsedSpecs = category === 'raquetes' ? extractRacketSpecs(row) : null;
  const parsedShoeSpecs = category === 'sapatilhas' ? extractShoeSpecs(row) : null;
  const offer = {
    id,
    slug: slugify(`${row.name}-${row['product ID']}`),
    name: normalizeProductName(row.name || '', category),
    brand: 'Adidas',
    category,
    price,
    oldPrice: null,
    rating: null,
    badge: null,
    image: (row.imageURL || '').trim(),
    ean: row.EAN || null,
    source: 'adidas-padel',
    sourceProductId: row['product ID'] || null,
    sourceCategory: row.categories || null,
    description: normalizeSpaces(row.description || row.longDescription || row.shortDescription || '') || null,
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
        key: 'adidas-padel',
        name: 'Adidas Padel',
        price,
        stock: 'Em stock',
        url: row.productURL || '',
      },
    ],
  };

  return isCoreCatalogProduct(offer) ? offer : null;
}

async function main() {
  console.log('🎾  PadelCost - Adidas Padel\n');

  const raw = await fetchFeed(CONFIG.feedUrl);
  const rows = await parseCsv(raw);
  console.log(`📦  Total de linhas no feed: ${rows.length.toLocaleString()}`);

  const padelRows = rows.filter(isPadelProduct);
  console.log(`🎯  Produtos de padel válidos: ${padelRows.length.toLocaleString()}`);

  const seen = new Map();
  for (const row of padelRows) {
    const key = row.EAN || `${row.name}||${row.categories}`;
    if (!seen.has(key)) seen.set(key, row);
  }

  let unique = Array.from(seen.values());
  if (CONFIG.maxProducts > 0) {
    unique = unique.slice(0, CONFIG.maxProducts);
    console.log(`✂️   Limitado a ${CONFIG.maxProducts} produtos`);
  }

  const offers = unique.map((row, i) => rowToOffer(row, i + 1)).filter(Boolean);

  const outputPath = path.resolve(__dirname, CONFIG.outputDir, 'adidas-padel-data.js');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  const now = new Date().toISOString();
  const content = [
    `// PadelCost - Adidas Padel normalizado automaticamente`,
    `// Gerado em: ${now}`,
    `// Produtos: ${offers.length}`,
    ``,
    `window.PADELCOST_ADIDAS_PRODUCTS = ${JSON.stringify(offers, null, 2)};`,
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
