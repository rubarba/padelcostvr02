/**
 * PadelCost - Relatorio de possiveis duplicados
 * ------------------------------------------------
 * Gera um CSV para revisao manual de produtos que parecem ser o mesmo artigo,
 * mas que nao foram unidos pelo merge automatico.
 *
 * Uso:
 *   node report-duplicate-candidates.js
 */

const fs = require('fs');
const path = require('path');

const DATA_FILE = path.resolve(__dirname, '../data/products-data.js');
const OUTPUT_FILE = path.resolve(__dirname, '../duplicados-revisao.csv');
const PRODUCT_VAR = 'window.PADELCOST_PRODUCTS = ';

const CORE_CATEGORIES = new Set(['raquetes', 'sapatilhas', 'sacos', 'acessorios']);
const REVIEW_CATEGORIES = new Set((process.env.DUPLICATE_CATEGORIES || 'raquetes,sacos,acessorios')
  .split(',')
  .map(value => value.trim())
  .filter(Boolean));

const STOPWORDS = new Set([
  'a', 'o', 'os', 'as', 'de', 'do', 'da', 'dos', 'das', 'e', 'em', 'com', 'para', 'por',
  'the', 'by', 'of', 'for', 'unisex', 'adulto', 'adult', 'homem', 'mulher',
  'padel', 'pa', 'padelcost', 'raquete', 'raquetes', 'racket', 'rackets', 'pala', 'palas',
  'saco', 'sacos', 'bolsa', 'mochila', 'paletero', 'bag', 'backpack',
  'acessorio', 'acessorios', 'accessory', 'accessories',
]);

const VARIANT_WORDS = new Set([
  'technical', 'soft', 'counter', 'air', 'veron', 'vertuo', 'team', 'light', 'ctrl', 'control',
  'carbon', 'hrd', 'hybrid', 'attack', 'comfort', 'pro', 'elite', 'motion', 'junior',
  'azul', 'blue', 'vermelho', 'red', 'preto', 'black', 'branco', 'white', 'verde', 'green',
  'laranja', 'orange', 'rosa', 'pink', 'amarelo', 'yellow', 'prata', 'silver', 'cinza', 'grey',
]);

function extractProducts() {
  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  const jsonText = raw.split(PRODUCT_VAR)[1].replace(/;\s*$/, '');
  return JSON.parse(jsonText);
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/(\d)\.(\d)/g, '$1x$2')
    .replace(/\+/g, ' plus ')
    .replace(/[^a-z0-9x]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(product) {
  const text = normalizeText(`${product.brand || ''} ${product.name || ''}`);
  return text
    .split(' ')
    .filter(token => token.length > 1)
    .filter(token => !STOPWORDS.has(token))
    .filter(token => !/^\d+$/.test(token) || /^\d{4}$/.test(token) || /^\d+x\d+$/.test(token));
}

function jaccard(a, b) {
  const setA = new Set(a);
  const setB = new Set(b);
  const intersection = [...setA].filter(token => setB.has(token)).length;
  const union = new Set([...setA, ...setB]).size;
  return union ? intersection / union : 0;
}

function variantPenalty(aTokens, bTokens) {
  const aVariants = new Set(aTokens.filter(token => VARIANT_WORDS.has(token)));
  const bVariants = new Set(bTokens.filter(token => VARIANT_WORDS.has(token)));
  const onlyA = [...aVariants].filter(token => !bVariants.has(token));
  const onlyB = [...bVariants].filter(token => !aVariants.has(token));
  let penalty = (onlyA.length + onlyB.length) * 0.04;

  const aModels = new Set(aTokens.filter(token => /^\d+x\d+$/.test(token)));
  const bModels = new Set(bTokens.filter(token => /^\d+x\d+$/.test(token)));
  if (aModels.size && bModels.size && ![...aModels].some(token => bModels.has(token))) {
    penalty += 0.45;
  }

  const aYears = new Set(aTokens.filter(token => /^20\d{2}$/.test(token)));
  const bYears = new Set(bTokens.filter(token => /^20\d{2}$/.test(token)));
  if (aYears.size && bYears.size && ![...aYears].some(token => bYears.has(token))) {
    penalty += 0.25;
  }

  return penalty;
}

function stores(product) {
  return (product.stores || []).map(store => store.name).filter(Boolean).join(' | ');
}

function sharedStore(a, b) {
  const aStores = new Set((a.stores || []).map(store => store.name));
  return (b.stores || []).some(store => aStores.has(store.name));
}

function csvEscape(value) {
  const text = value == null ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function firstIdentifier(product, field) {
  return product[field] || (product.stores || []).map(store => store[field]).find(Boolean) || '';
}

function main() {
  const products = extractProducts()
    .filter(product => CORE_CATEGORIES.has(product.category))
    .filter(product => REVIEW_CATEGORIES.has(product.category));

  const rows = [];
  const groups = new Map();

  for (const product of products) {
    const brand = normalizeText(product.brand || product.name.split(' ')[0] || 'sem marca');
    const key = `${product.category}::${brand}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ product, tokens: tokens(product) });
  }

  for (const group of groups.values()) {
    for (let i = 0; i < group.length; i += 1) {
      for (let j = i + 1; j < group.length; j += 1) {
        const a = group[i];
        const b = group[j];
        if (sharedStore(a.product, b.product)) continue;

        const similarity = jaccard(a.tokens, b.tokens);
        const score = Math.max(0, similarity - variantPenalty(a.tokens, b.tokens));
        if (score < 0.58) continue;

        rows.push({
          score,
          category: a.product.category,
          brand: a.product.brand || b.product.brand || '',
          idA: a.product.id,
          nameA: a.product.name,
          storesA: stores(a.product),
          priceA: a.product.price,
          eanA: firstIdentifier(a.product, 'ean'),
          gtinA: firstIdentifier(a.product, 'productGTIN'),
          mpnA: firstIdentifier(a.product, 'mpn'),
          idB: b.product.id,
          nameB: b.product.name,
          storesB: stores(b.product),
          priceB: b.product.price,
          eanB: firstIdentifier(b.product, 'ean'),
          gtinB: firstIdentifier(b.product, 'productGTIN'),
          mpnB: firstIdentifier(b.product, 'mpn'),
          action: '',
          notes: '',
        });
      }
    }
  }

  rows.sort((a, b) => b.score - a.score || a.category.localeCompare(b.category));

  const header = [
    'score',
    'categoria',
    'marca',
    'id_a',
    'nome_a',
    'lojas_a',
    'preco_a',
    'ean_a',
    'gtin_a',
    'mpn_a',
    'id_b',
    'nome_b',
    'lojas_b',
    'preco_b',
    'ean_b',
    'gtin_b',
    'mpn_b',
    'acao_manual',
    'notas',
  ];

  const lines = [
    header.map(csvEscape).join(','),
    ...rows.map(row => [
      row.score.toFixed(2),
      row.category,
      row.brand,
      row.idA,
      row.nameA,
      row.storesA,
      row.priceA,
      row.eanA,
      row.gtinA,
      row.mpnA,
      row.idB,
      row.nameB,
      row.storesB,
      row.priceB,
      row.eanB,
      row.gtinB,
      row.mpnB,
      row.action,
      row.notes,
    ].map(csvEscape).join(',')),
  ];

  fs.writeFileSync(OUTPUT_FILE, `${lines.join('\n')}\n`);

  console.log(`Relatorio gerado: ${OUTPUT_FILE}`);
  console.log(`Candidatos encontrados: ${rows.length}`);
  console.log(`Categorias analisadas: ${[...REVIEW_CATEGORIES].join(', ')}`);
  for (const row of rows.slice(0, 10)) {
    console.log(`${row.score.toFixed(2)} | ${row.category} | ${row.nameA} <> ${row.nameB}`);
  }
}

main();
