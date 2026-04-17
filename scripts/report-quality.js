/**
 * PadelCost - Relatorio de qualidade dos dados
 * --------------------------------------------
 * Analisa data/products-data.js e imprime uma vistoria rapida antes de publicar.
 */

const fs = require('fs');
const path = require('path');
const { CORE_CATEGORIES, isCategoryIntruder } = require('./category-rules');

const DATA_FILE = path.resolve(__dirname, '../data/products-data.js');

function extractWindowData(filePath, variableName) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const prefix = `window.${variableName} = `;
  const chunk = raw.split(prefix)[1];
  if (!chunk) throw new Error(`Variavel ${variableName} nao encontrada em ${filePath}`);
  return JSON.parse(chunk.replace(/;\s*$/, ''));
}

function extractUpdatedAt(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const match = raw.match(/window\.PADELCOST_UPDATED_AT\s*=\s*(".*?");/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString('pt-PT');
}

function formatBytes(bytes) {
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeCatalogText(value) {
  return normalizeText(value)
    .replace(/\b(tamanho|tam|size)\s*\d+(?:\.\d+)?\b/g, ' ')
    .replace(/\b\d{2}(?:\.\d+)?\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getShoeGroupKey(product) {
  const brand = normalizeCatalogText(product?.brand);
  const name = normalizeCatalogText(product?.name);
  return `${brand}::${name}`;
}

function aggregateCatalogProducts(products) {
  const groupedShoes = new Map();
  const result = [];

  for (const product of products) {
    if (product.category !== 'sapatilhas') {
      result.push(product);
      continue;
    }

    const key = getShoeGroupKey(product);
    if (!groupedShoes.has(key)) groupedShoes.set(key, []);
    groupedShoes.get(key).push(product);
  }

  for (const variants of groupedShoes.values()) {
    result.push(variants[0]);
  }

  return result;
}

function countBy(items, getKey) {
  const counts = new Map();
  for (const item of items) {
    const key = getKey(item) || 'Sem valor';
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function top(items, limit = 10) {
  return items.slice(0, limit);
}

function hasValidPrice(product) {
  return Number.isFinite(product.price) && product.price > 0;
}

function hasValidImage(product) {
  const image = String(product.image || '').trim();
  return image && !image.startsWith('data:image/svg+xml');
}

function hasStores(product) {
  return Array.isArray(product.stores) && product.stores.length > 0;
}

function getSuspiciousNameReason(product) {
  const name = normalizeText(product.name);
  const sourceCategory = normalizeText(product.sourceCategory);
  const combined = `${name} ${sourceCategory}`;

  const checks = [
    ['termo espanhol "pala/palas"', /\bpalas?\b/, name],
    ['termo espanhol "zapatilla"', /\bzapatill/, name],
    ['padel com acento', /\bpadel\b/.test(name) ? null : /\bpádel\b/],
    ['roupa/acessorio em categoria core', /\b(calcas|calca|camiseta|vestido|saia|polo|manga|cotoveleira|overgrip|pendente|joyas|spray)\b/, combined],
    ['bola em categoria core', /\b(bola|bolas|pote de bolas|pelotas)\b/, combined],
    ['badminton', /\bbadminton\b/, combined],
    ['tenis sem padel', /\btenis\b(?!.*\bpadel\b)/, combined],
  ];

  for (const [reason, regex, target = combined] of checks) {
    if (regex && regex.test(target)) return reason;
  }

  return null;
}

function printSection(title) {
  console.log(`\n${title}`);
  console.log('-'.repeat(title.length));
}

function printTopList(title, entries, limit = 10) {
  printSection(title);
  if (entries.length === 0) {
    console.log('Sem ocorrencias.');
    return;
  }
  for (const [label, count] of top(entries, limit)) {
    console.log(`${label}: ${formatNumber(count)}`);
  }
}

function printExamples(title, products, limit = 12) {
  printSection(title);
  if (products.length === 0) {
    console.log('Sem exemplos encontrados.');
    return;
  }
  for (const product of products.slice(0, limit)) {
    console.log(`- [${product.category}] ${product.brand || 'Sem marca'} - ${product.name || 'Sem nome'}`);
  }
  if (products.length > limit) {
    console.log(`... mais ${formatNumber(products.length - limit)}.`);
  }
}

function main() {
  const stat = fs.statSync(DATA_FILE);
  const updatedAt = extractUpdatedAt(DATA_FILE);
  const products = extractWindowData(DATA_FILE, 'PADELCOST_PRODUCTS');

  const coreProducts = products.filter(product => CORE_CATEGORIES.has(product.category));
  const nonCoreProducts = products.filter(product => !CORE_CATEGORIES.has(product.category));
  const intruders = coreProducts.filter(product => isCategoryIntruder(product, product.category));
  const visibleCoreRaw = coreProducts.filter(product => !isCategoryIntruder(product, product.category));
  const visibleCore = aggregateCatalogProducts(visibleCoreRaw);

  const noImage = visibleCore.filter(product => !hasValidImage(product));
  const noPrice = visibleCore.filter(product => !hasValidPrice(product));
  const noStores = visibleCore.filter(product => !hasStores(product));
  const suspiciousNames = visibleCore
    .map(product => ({ ...product, suspiciousReason: getSuspiciousNameReason(product) }))
    .filter(product => product.suspiciousReason);

  console.log('PadelCost - Relatorio de qualidade dos dados');
  console.log('============================================');
  console.log(`Ficheiro: ${path.relative(path.resolve(__dirname, '..'), DATA_FILE)}`);
  console.log(`Tamanho: ${formatBytes(stat.size)}`);
  console.log(`Ultima geracao: ${updatedAt || 'Sem data'}`);

  printSection('Resumo');
  console.log(`Produtos totais no ficheiro: ${formatNumber(products.length)}`);
  console.log(`Produtos core brutos: ${formatNumber(coreProducts.length)}`);
  console.log(`Produtos core visiveis/agregados: ${formatNumber(visibleCore.length)}`);
  console.log(`Produtos fora do core: ${formatNumber(nonCoreProducts.length)}`);
  console.log(`Intrusos core detetados: ${formatNumber(intruders.length)}`);
  console.log(`Sem imagem: ${formatNumber(noImage.length)}`);
  console.log(`Sem preco: ${formatNumber(noPrice.length)}`);
  console.log(`Sem lojas: ${formatNumber(noStores.length)}`);
  console.log(`Nomes suspeitos: ${formatNumber(suspiciousNames.length)}`);

  printTopList('Produtos core por categoria', countBy(visibleCore, product => product.category), 10);
  printTopList('Produtos por categoria bruta', countBy(products, product => product.category), 12);
  printTopList('Top marcas core', countBy(visibleCore, product => product.brand), 15);
  printTopList(
    'Ofertas por loja',
    countBy(visibleCore.flatMap(product => product.stores || []), store => store.name),
    10,
  );
  printTopList('Produtos por origem', countBy(products, product => product.source), 10);

  printExamples('Intrusos core detetados', intruders);
  printExamples('Produtos core sem imagem', noImage);
  printExamples('Produtos core sem preco', noPrice);
  printExamples('Produtos core sem lojas', noStores);

  printSection('Nomes suspeitos');
  if (suspiciousNames.length === 0) {
    console.log('Sem nomes suspeitos encontrados.');
  } else {
    for (const product of suspiciousNames.slice(0, 12)) {
      console.log(`- [${product.suspiciousReason}] [${product.category}] ${product.brand || 'Sem marca'} - ${product.name}`);
    }
    if (suspiciousNames.length > 12) {
      console.log(`... mais ${formatNumber(suspiciousNames.length - 12)}.`);
    }
  }

  const hasBlockingIssues = intruders.length > 0 || noPrice.length > 0 || noStores.length > 0;
  printSection('Estado');
  if (hasBlockingIssues) {
    console.log('Rever antes de publicar.');
    process.exitCode = 1;
  } else {
    console.log('OK para publicar, sem problemas bloqueantes detetados.');
  }
}

main();
