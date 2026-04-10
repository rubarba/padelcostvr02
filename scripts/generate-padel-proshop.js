/**
 * PadelCost - Gerador Padel Proshop PT (Adtraction XML)
 * ----------------------------------------------------
 * Lê o feed XML da Padel Proshop PT, normaliza os produtos relevantes e gera
 * um ficheiro JS com a estrutura usada pelo catálogo.
 */

require('dotenv').config();
const https = require('https');
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const CONFIG = {
  feedUrl: process.env.PADEL_PROSHOP_FEED_URL || '',
  maxProducts: parseInt(process.env.MAX_PRODUCTS_PADEL_PROSHOP || process.env.MAX_PRODUCTS || '0', 10),
  outputDir: process.env.OUTPUT_DIR || '../data',
};

function normalizeText(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeSpaces(str) {
  return (str || '').replace(/\s+/g, ' ').trim();
}

function slugify(str) {
  return normalizeText(str).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function canonicalKey(str) {
  return String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function decodeXml(str) {
  return String(str || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

function stripTags(str) {
  return decodeXml(String(str || '').replace(/<[^>]+>/g, ' ')).trim();
}

function cleanPrice(value) {
  if (value == null || value === '') return null;
  const normalized = String(value).replace(',', '.').replace(/[^0-9.]/g, '');
  const n = parseFloat(normalized);
  return Number.isNaN(n) ? null : Math.round(n * 100) / 100;
}

function fetchFeed(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (!url) {
      return reject(new Error('PADEL_PROSHOP_FEED_URL não definida.'));
    }

    console.log('⬇️  A descarregar feed da Padel Proshop PT...');
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

function detectRecordTag(xml) {
  const candidates = ['product', 'item', 'entry', 'record', 'row'];
  let best = null;
  let bestCount = 0;

  for (const tag of candidates) {
    const regex = new RegExp(`<${tag}(?:\\s|>)`, 'gi');
    const count = (xml.match(regex) || []).length;
    if (count > bestCount) {
      best = tag;
      bestCount = count;
    }
  }

  if (!best) {
    const generic = xml.match(/<([A-Za-z0-9_:-]+)(?:\s|>)[\s\S]*?<\/\1>/g);
    if (!generic || generic.length === 0) {
      throw new Error('Não foi possível detetar os nós do XML.');
    }
  }

  return best || 'product';
}

function parseXmlRecords(xml) {
  const recordTag = detectRecordTag(xml);
  const recordRegex = new RegExp(`<${recordTag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${recordTag}>`, 'gi');
  const records = [];
  let recordMatch;

  while ((recordMatch = recordRegex.exec(xml)) !== null) {
    const block = recordMatch[1];
    const fieldRegex = /<([A-Za-z0-9_:-]+)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/g;
    const record = {};
    let fieldMatch;

    while ((fieldMatch = fieldRegex.exec(block)) !== null) {
      const rawKey = fieldMatch[1];
      const key = canonicalKey(rawKey);
      const value = normalizeSpaces(stripTags(fieldMatch[2]));
      if (!record[key]) {
        record[key] = value;
      }
    }

    if (Object.keys(record).length > 0) {
      records.push(record);
    }
  }

  return records;
}

function getField(row, ...keys) {
  for (const key of keys) {
    const value = row[canonicalKey(key)];
    if (value != null && value !== '') return value;
  }
  return null;
}

function extractRacketSpecs(row) {
  const textRaw = normalizeSpaces([
    getField(row, 'Name', 'title'),
    getField(row, 'Description', 'description'),
    getField(row, 'Category', 'g:product_type', 'product_type'),
    getField(row, 'Brand', 'g:brand', 'brand'),
  ].filter(Boolean).join(' '));
  const text = normalizeText(textRaw);

  const weightRangeMatch =
    text.match(/(\d{2,3})\s*(?:-|–|a|ate|to|e)\s*(\d{2,3})\s*(?:g|gr|grama|gramas)/);
  const weightSingleMatch = text.match(/(\d{2,3}(?:[.,]\d+)?)\s*(?:g|gr|grama|gramas)/);

  let peso = null;
  if (weightRangeMatch) peso = `${weightRangeMatch[1]}-${weightRangeMatch[2]}g`;
  else if (weightSingleMatch) peso = `${weightSingleMatch[1].replace(',', '.')}g`;

  let forma = null;
  if (/\bdiamante\b|\bdiamond\b/.test(text)) forma = 'Diamante';
  else if (/\bredonda\b|\bround\b/.test(text)) forma = 'Redonda';
  else if (/\bhibrida\b|\bhybrid\b|\blagrima\b|\bteardrop\b/.test(text)) forma = 'Híbrida';

  let equilibrio = null;
  if (/\bequilibrio alto\b|\bhigh balance\b/.test(text)) equilibrio = 'Alto';
  else if (/\bequilibrio medio\b|\bequilibrio medio\b|\bmedium balance\b/.test(text)) equilibrio = 'Médio';
  else if (/\bequilibrio baixo\b|\blow balance\b|\blow balance\b/.test(text)) equilibrio = 'Baixo';

  let nivel = null;
  if (/\bprofission|\bcompetition\b/.test(text)) nivel = 'Profissional';
  else if (/\bavancad|\bavançad|\badvanced\b|\bexpert\b/.test(text)) nivel = 'Avançado';
  else if (/\bintermed/.test(text)) nivel = 'Intermédio';
  else if (/\binician|\bbeginner|\bprincipiante/.test(text)) nivel = 'Iniciante';

  let material = null;
  if (/carbon/i.test(textRaw)) material = 'Carbono';
  else if (/fibra de vidro|fiberglass/i.test(textRaw)) material = 'Fibra de vidro';
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
    getField(row, 'Name', 'title'),
    getField(row, 'Description', 'description'),
    getField(row, 'Category', 'g:product_type', 'product_type'),
    getField(row, 'Brand', 'g:brand', 'brand'),
  ].filter(Boolean).join(' '));
  const text = normalizeText(textRaw);
  const lowerName = normalizeText(getField(row, 'Name', 'title'));

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

function mapCategory(row) {
  const combined = normalizeText([
    getField(row, 'Category', 'g:product_type', 'product_type'),
    getField(row, 'Name', 'title'),
    getField(row, 'Description', 'description'),
  ].filter(Boolean).join(' | '));

  if (
    combined.includes('overgrip') ||
    combined.includes('overgrips') ||
    combined.includes('grip ') ||
    combined.startsWith('grip ') ||
    combined.includes('hesacore') ||
    combined.includes('protector') ||
    combined.includes('antivibr') ||
    combined.includes('meia') ||
    combined.includes('meias') ||
    combined.includes('sock') ||
    combined.includes('sandalia') ||
    combined.includes('sandalia') ||
    combined.includes('chinelo') ||
    combined.includes('slide') ||
    combined.includes('wristband') ||
    combined.includes('pulseira') ||
    combined.includes('fita') ||
    combined.includes('tape')
  ) return 'acessorios';

  if (
    (combined.includes('tenis') || combined.includes('tennis')) &&
    !combined.includes('padel') &&
    (combined.includes('raquete') ||
      combined.includes('raquetas') ||
      combined.includes('racket') ||
      combined.includes('pala') ||
      combined.includes('palas'))
  ) return null;

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
    combined.includes('tenis') ||
    combined.includes('zapatos')
  ) return 'sapatilhas';

  if (
    combined.includes('bola') ||
    combined.includes('bolas') ||
    combined.includes('pelota') ||
    combined.includes('pelotas') ||
    combined.includes('ball')
  ) return 'bolas';

  if (
    combined.includes('camiseta') ||
    combined.includes('camisola') ||
    combined.includes('t shirt') ||
    combined.includes('polo') ||
    combined.includes('saia') ||
    combined.includes('vestido') ||
    combined.includes('short') ||
    combined.includes('calcas') ||
    combined.includes('calcoes') ||
    combined.includes('leggings') ||
    combined.includes('sweatshirt') ||
    combined.includes('hoodie') ||
    combined.includes('sudadera')
  ) return 'roupa';

  if (
    combined.includes('raquete') ||
    combined.includes('raquetas') ||
    combined.includes('pala') ||
    combined.includes('palas') ||
    combined.includes('racket')
  ) return 'raquetes';

  return 'acessorios';
}

function rowToOffer(row, id) {
  const price = cleanPrice(getField(row, 'SalePrice', 'g:sale_price', 'Price', 'CurrentPrice', 'g:price', 'price'));
  const originalPrice = cleanPrice(getField(row, 'OriginalPrice', 'OldPrice', 'g:price', 'price'));
  const category = mapCategory(row);
  const racketSpecs = category === 'raquetes' ? extractRacketSpecs(row) : null;
  const shoeSpecs = category === 'sapatilhas' ? extractShoeSpecs(row) : null;
  const stockValue = normalizeText(getField(row, 'Instock', 'InStock', 'g:availability', 'availability'));
  const isInStock =
    stockValue === 'yes' ||
    stockValue === 'true' ||
    stockValue === '1' ||
    stockValue === 'sim' ||
    stockValue === 'instock' ||
    stockValue === 'in stock' ||
    stockValue === 'available' ||
    stockValue === 'disponivel' ||
    stockValue === 'disponivel agora';

  return {
    id,
    slug: slugify(`${getField(row, 'Name', 'title') || 'produto'}-${getField(row, 'ItemGroupId', 'g:item_group_id', 'SKU', 'g:id', 'Ean', 'g:gtin', 'ManufacturerArticleNumber', 'g:mpn') || id}`),
    name: getField(row, 'Name', 'title') || '',
    brand: getField(row, 'Brand', 'g:brand', 'brand') || '',
    category,
    price,
    oldPrice: originalPrice && price != null && originalPrice > price ? originalPrice : null,
    rating: null,
    badge: null,
    image: getField(row, 'ImageUrl', 'g:image_link', 'image_link') || '',
    ean: getField(row, 'Ean', 'g:gtin', 'gtin') || null,
    productGTIN: getField(row, 'GTIN', 'ProductGTIN', 'g:gtin', 'gtin', 'Ean') || null,
    mpn: getField(row, 'ManufacturerArticleNumber', 'ManufacturerArticle', 'g:mpn', 'mpn', 'SKU', 'g:id') || null,
    source: 'padel-proshop',
    sourceProductId: getField(row, 'ItemGroupId', 'g:item_group_id', 'SKU', 'g:id', 'ManufacturerArticleNumber') || null,
    sourceCategory: getField(row, 'Category', 'g:product_type', 'product_type') || null,
    specs: {
      peso: racketSpecs?.peso ?? null,
      forma: racketSpecs?.forma ?? null,
      equilibrio: racketSpecs?.equilibrio ?? null,
      nivel: racketSpecs?.nivel ?? null,
      material: racketSpecs?.material ?? null,
      estilo: racketSpecs?.estilo ?? null,
      sola: shoeSpecs?.sola ?? null,
      genero: shoeSpecs?.genero ?? null,
      cor: shoeSpecs?.cor ?? null,
      uso: shoeSpecs?.uso ?? null,
      amortecimento: shoeSpecs?.amortecimento ?? null,
    },
    stores: [
      {
        key: 'padel-proshop',
        name: 'Padel Proshop PT',
        price,
        stock: isInStock ? 'Em stock' : 'Disponibilidade por confirmar',
        url: getField(row, 'TrackingUrl', 'link', 'ProductUrl') || '',
      },
    ],
  };
}

async function main() {
  console.log('🎾  PadelCost - Padel Proshop PT\n');

  const raw = await fetchFeed(CONFIG.feedUrl);
  const rows = parseXmlRecords(raw);
  console.log(`📦  Total de linhas no feed: ${rows.length.toLocaleString()}`);

  const seen = new Map();
  for (const row of rows) {
    const itemGroupId = getField(row, 'ItemGroupId', 'g:item_group_id');
    const productUrl = getField(row, 'ProductUrl', 'link');
    const cleanedUrl = productUrl ? productUrl.split('?')[0] : null;
    const key =
      itemGroupId ||
      cleanedUrl ||
      getField(row, 'Ean', 'g:gtin', 'gtin') ||
      getField(row, 'ManufacturerArticleNumber', 'g:mpn', 'mpn', 'SKU', 'g:id') ||
      `${getField(row, 'Name', 'title')}||${getField(row, 'Category', 'g:product_type', 'product_type')}`;

    if (!seen.has(key)) {
      seen.set(key, row);
      continue;
    }

    const current = seen.get(key);
    const currentHasEan = !!getField(current, 'Ean', 'g:gtin', 'gtin');
    const nextHasEan = !!getField(row, 'Ean', 'g:gtin', 'gtin');
    const currentHasImage = !!getField(current, 'ImageUrl', 'g:image_link', 'image_link');
    const nextHasImage = !!getField(row, 'ImageUrl', 'g:image_link', 'image_link');
    const currentPrice = cleanPrice(getField(current, 'SalePrice', 'g:sale_price', 'Price', 'CurrentPrice', 'g:price', 'price'));
    const nextPrice = cleanPrice(getField(row, 'SalePrice', 'g:sale_price', 'Price', 'CurrentPrice', 'g:price', 'price'));

    const shouldReplace =
      (!currentHasEan && nextHasEan) ||
      (!currentHasImage && nextHasImage) ||
      (currentPrice == null && nextPrice != null) ||
      (currentPrice != null && nextPrice != null && nextPrice < currentPrice);

    if (shouldReplace) {
      seen.set(key, row);
    }
  }

  let uniqueRows = Array.from(seen.values());
  if (CONFIG.maxProducts > 0) {
    uniqueRows = uniqueRows.slice(0, CONFIG.maxProducts);
    console.log(`✂️   Limitado a ${CONFIG.maxProducts} produtos`);
  }

  const offers = uniqueRows
    .map((row, i) => rowToOffer(row, i + 1))
    .filter(offer => ['raquetes', 'sapatilhas', 'sacos'].includes(offer.category))
    .filter(offer => offer.name && offer.price != null);

  const outputPath = path.resolve(__dirname, CONFIG.outputDir, 'padel-proshop-data.js');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  const now = new Date().toISOString();
  const content = [
    `// PadelCost - Padel Proshop PT normalizado automaticamente`,
    `// Gerado em: ${now}`,
    `// Produtos: ${offers.length}`,
    ``,
    `window.PADELCOST_PADEL_PROSHOP_PRODUCTS = ${JSON.stringify(offers, null, 2)};`,
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
