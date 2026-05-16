/**
 * PadelCost - Pagina visual de revisao de duplicados
 * --------------------------------------------------
 * Gera uma pagina HTML local para marcar candidatos como MERGE ou NAO.
 *
 * Uso:
 *   node generate-duplicate-review-page.js
 */

const fs = require('fs');
const path = require('path');

const DATA_FILE = path.resolve(__dirname, '../data/products-data.js');
const OUTPUT_FILE = path.resolve(__dirname, '../duplicados-revisao.html');
const DUPLICATE_DECISIONS_FILE = path.resolve(__dirname, '../data/duplicate-decisions.json');
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

function loadDuplicateDecisions() {
  if (!fs.existsSync(DUPLICATE_DECISIONS_FILE)) return [];
  return JSON.parse(fs.readFileSync(DUPLICATE_DECISIONS_FILE, 'utf8'));
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

function sharedStore(a, b) {
  const aStores = new Set((a.stores || []).map(store => store.name));
  return (b.stores || []).some(store => aStores.has(store.name));
}

function firstIdentifier(product, field) {
  return product[field] || (product.stores || []).map(store => store[field]).find(Boolean) || '';
}

function publicProductUrl(product) {
  if (!product.slug) return '';
  return `produto/${product.slug}.html`;
}

function productSummary(product) {
  return {
    id: product.id,
    name: product.name,
    brand: product.brand || '',
    category: product.category,
    price: product.price,
    image: product.image || '',
    ean: firstIdentifier(product, 'ean'),
    gtin: firstIdentifier(product, 'productGTIN'),
    mpn: firstIdentifier(product, 'mpn'),
    productUrl: publicProductUrl(product),
    stores: (product.stores || []).map(store => ({
      name: store.name,
      price: store.price,
      stock: store.stock || '',
      url: store.url || '',
    })),
  };
}

function buildCandidates(products) {
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
          key: `${a.product.id}-${b.product.id}`,
          score: Number(score.toFixed(2)),
          category: a.product.category,
          brand: a.product.brand || b.product.brand || '',
          a: productSummary(a.product),
          b: productSummary(b.product),
        });
      }
    }
  }

  return rows.sort((a, b) => b.score - a.score || a.category.localeCompare(b.category));
}

function pairDecisionKey(aName, bName) {
  return [normalizeText(aName), normalizeText(bName)].sort().join(' <> ');
}

function candidateWasReviewed(candidate, decisions) {
  const candidateIdKeys = new Set([
    `${candidate.a.id}-${candidate.b.id}`,
    `${candidate.b.id}-${candidate.a.id}`,
  ]);
  const candidateNameKey = pairDecisionKey(candidate.a.name, candidate.b.name);

  return decisions.some(decision => {
    if (candidateIdKeys.has(decision.key)) return true;
    return pairDecisionKey(decision.nameA, decision.nameB) === candidateNameKey;
  });
}

function htmlEscapeJson(data) {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

function buildHtml(candidates) {
  return `<!doctype html>
<html lang="pt">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>PadelCost - revisão de duplicados</title>
  <style>
    :root {
      --bg: #0f172a;
      --panel: #111827;
      --panel-soft: #0b1220;
      --ink: #f8fafc;
      --muted: #94a3b8;
      --line: #243044;
      --blue: #0ea5e9;
      --green: #10b981;
      --red: #ef4444;
      --amber: #f59e0b;
      --shadow: 0 22px 70px rgba(0, 0, 0, .28);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--ink);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    header {
      position: sticky;
      top: 0;
      z-index: 10;
      background: rgba(15, 23, 42, .92);
      color: white;
      padding: 20px 30px;
      border-bottom: 1px solid var(--line);
      backdrop-filter: blur(18px);
    }
    .top {
      max-width: 1560px;
      margin: 0 auto;
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 20px;
      align-items: center;
    }
    h1 {
      margin: 0;
      font-size: 30px;
      line-height: 1.2;
    }
    .subtitle {
      margin: 4px 0 0;
      color: rgba(255, 255, 255, .72);
      font-size: 13px;
    }
    .stats {
      display: flex;
      gap: 10px;
      align-items: center;
      flex-wrap: wrap;
      justify-content: flex-end;
    }
    .stat {
      min-width: 104px;
      padding: 8px 12px;
      border: 1px solid var(--line);
      border-radius: 12px;
      background: rgba(255, 255, 255, .04);
      font-size: 12px;
    }
    .stat b { display: block; font-size: 18px; }
    main {
      max-width: 1560px;
      margin: 0 auto;
      padding: 28px 30px 60px;
    }
    .toolbar {
      display: grid;
      grid-template-columns: minmax(320px, 1fr) auto auto auto auto;
      gap: 12px;
      margin-bottom: 18px;
      align-items: center;
    }
    input, select, button {
      font: inherit;
    }
    input, select {
      width: 100%;
      border: 1px solid #334155;
      border-radius: 999px;
      background: #111827;
      color: white;
      padding: 11px 14px;
      outline: none;
    }
    input::placeholder { color: #64748b; }
    button, .btn {
      border: 0;
      border-radius: 999px;
      background: var(--blue);
      color: white;
      padding: 11px 15px;
      font-weight: 800;
      cursor: pointer;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      white-space: nowrap;
    }
    .btn-muted { background: #1e293b; color: #cbd5e1; }
    .btn-merge { background: var(--green); }
    .btn-reject { background: var(--red); }
    .btn-reset { background: #475569; }
    .btn-danger { background: #7f1d1d; }
    .btn-file input { display: none; }
    .review-board {
      display: grid;
      grid-template-columns: 260px minmax(760px, 1fr) 260px;
      gap: 16px;
      align-items: start;
    }
    .side-panel {
      position: sticky;
      top: 114px;
      max-height: calc(100vh - 134px);
      overflow: auto;
      background: #0b1220;
      border: 1px solid var(--line);
      border-radius: 18px;
      padding: 12px;
      box-shadow: var(--shadow);
    }
    .side-panel h2 {
      margin: 0 0 4px;
      font-size: 16px;
      line-height: 1.2;
    }
    .side-panel p {
      margin: 0 0 12px;
      color: var(--muted);
      font-size: 12px;
      line-height: 1.35;
    }
    .side-list {
      display: grid;
      gap: 10px;
    }
    .mini-card {
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: 10px;
      background: #111827;
    }
    .mini-card[data-decision="merge"] { border-color: rgba(16, 185, 129, .55); }
    .mini-card[data-decision="reject"] { border-color: rgba(239, 68, 68, .55); }
    .mini-title {
      font-size: 12px;
      font-weight: 900;
      line-height: 1.25;
      color: #e2e8f0;
    }
    .mini-meta {
      margin-top: 6px;
      color: var(--muted);
      font-size: 11px;
      line-height: 1.35;
    }
    .mini-actions {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      margin-top: 8px;
    }
    .mini-actions button {
      padding: 7px 9px;
      font-size: 11px;
    }
    textarea.reason {
      width: 100%;
      min-height: 72px;
      margin-top: 8px;
      border: 1px solid #334155;
      border-radius: 10px;
      background: #0b1220;
      color: white;
      padding: 9px;
      resize: vertical;
      font: inherit;
      font-size: 12px;
      outline: none;
    }
    textarea.reason::placeholder { color: #64748b; }
    .list {
      display: grid;
      gap: 16px;
    }
    .candidate {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 18px;
      box-shadow: var(--shadow);
      overflow: hidden;
    }
    .candidate[data-decision="merge"] { border-color: rgba(16, 185, 129, .8); box-shadow: 0 0 0 1px rgba(16, 185, 129, .18), var(--shadow); }
    .candidate[data-decision="reject"] { border-color: rgba(239, 68, 68, .65); opacity: .68; }
    .candidate-head {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 14px;
      align-items: center;
      padding: 16px 18px;
      border-bottom: 1px solid var(--line);
      background: #0b1220;
    }
    .score {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      color: var(--muted);
      font-weight: 700;
    }
    .pill {
      border-radius: 999px;
      background: #0ea5e9;
      color: white;
      padding: 5px 9px;
      font-size: 12px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: .02em;
    }
    .decision {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }
    .pair {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 64px minmax(0, 1fr);
      gap: 14px;
      padding: 18px;
      align-items: stretch;
    }
    .product {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 14px;
      min-width: 0;
      background: var(--panel-soft);
      border: 1px solid var(--line);
      border-radius: 16px;
    }
    .vs {
      align-self: center;
      justify-self: center;
      display: grid;
      place-items: center;
      width: 58px;
      height: 58px;
      border-radius: 999px;
      background: #082f49;
      color: #38bdf8;
      border: 1px solid #075985;
      font-size: 22px;
      font-weight: 950;
    }
    .image-wrap {
      border: 1px solid var(--line);
      border-radius: 12px;
      background: white;
      height: 220px;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    .image-wrap img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      display: block;
    }
    .brand {
      color: #8da0ba;
      text-transform: uppercase;
      font-size: 12px;
      font-weight: 900;
      margin-bottom: 5px;
    }
    .product-body {
      min-width: 0;
      display: grid;
      gap: 8px;
    }
    .name {
      font-weight: 900;
      line-height: 1.22;
      font-size: 17px;
      margin-bottom: 0;
      overflow-wrap: anywhere;
    }
    .price {
      font-size: 22px;
      font-weight: 950;
      margin-bottom: 0;
    }
    .meta {
      display: flex;
      gap: 7px;
      flex-wrap: wrap;
      margin: 10px 0;
      color: var(--muted);
      font-size: 12px;
    }
    .meta span {
      border: 1px solid var(--line);
      background: #101a2b;
      border-radius: 999px;
      padding: 5px 8px;
    }
    .meta b { color: #e2e8f0; }
    .stores {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin: 10px 0;
    }
    .store {
      border: 1px solid var(--line);
      border-radius: 999px;
      padding: 6px 9px;
      font-size: 12px;
      font-weight: 800;
      color: #e2e8f0;
      background: #111827;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .links {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 12px;
    }
    .empty {
      padding: 28px;
      background: var(--panel);
      border-radius: 12px;
      border: 1px solid var(--line);
      color: var(--muted);
      text-align: center;
    }
    @media (max-width: 900px) {
      .top,
      .toolbar,
      .review-board,
      .pair,
      .product {
        grid-template-columns: 1fr;
      }
      .side-panel {
        position: static;
        max-height: none;
      }
      .vs { width: 100%; height: 46px; }
      .image-wrap { height: 220px; }
      .candidate-head { grid-template-columns: 1fr; }
      .decision { justify-content: flex-start; }
    }
    @media (max-width: 1240px) {
      .review-board {
        grid-template-columns: 1fr;
      }
      .side-panel {
        position: static;
        max-height: none;
      }
    }
  </style>
</head>
<body>
  <header>
    <div class="top">
      <div>
        <h1>Revisão de possíveis duplicados</h1>
        <p class="subtitle">Marca pares como "Juntar" ou "Não juntar". As decisões ficam guardadas neste browser.</p>
      </div>
      <div class="stats">
        <div class="stat"><span>Total</span><b id="stat-total">0</b></div>
        <div class="stat"><span>Juntar</span><b id="stat-merge">0</b></div>
        <div class="stat"><span>Não juntar</span><b id="stat-reject">0</b></div>
      </div>
    </div>
  </header>

  <main>
    <div class="toolbar">
      <input id="search" type="search" placeholder="Pesquisar por marca, produto, loja, EAN ou MPN">
      <select id="decision-filter" aria-label="Filtrar por decisão">
        <option value="pending">Por decidir</option>
        <option value="all">Todos</option>
        <option value="merge">Juntar</option>
        <option value="reject">Não juntar</option>
      </select>
      <label class="btn btn-muted btn-file">Importar histórico<input id="import" type="file" accept="application/json"></label>
      <button id="export">Exportar decisões</button>
      <button id="clear-all" class="btn-danger">Limpar dados</button>
    </div>
    <div class="review-board">
      <aside class="side-panel">
        <h2>Não juntar</h2>
        <p>Os pares rejeitados ficam aqui. Escreve o motivo para não voltares a rever o mesmo caso amanhã.</p>
        <div id="reject-list" class="side-list"></div>
      </aside>
      <section>
        <div id="list" class="list"></div>
      </section>
      <aside class="side-panel">
        <h2>Juntar</h2>
        <p>Os pares aprovados ficam aqui. Depois exportas isto e eu transformo em regras seguras de merge.</p>
        <div id="merge-list" class="side-list"></div>
      </aside>
    </div>
  </main>

  <script>
    const CANDIDATES = ${htmlEscapeJson(candidates)};
    const STORAGE_KEY = 'padelcost-duplicate-review-v2';
    const decisions = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');

    function euro(value) {
      if (value == null || value === '') return '-';
      return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(Number(value));
    }

    function save() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(decisions));
      render();
    }

    function setDecision(key, value) {
      decisions[key] = {
        ...(decisions[key] || {}),
        decision: value,
        updatedAt: new Date().toISOString()
      };
      save();
    }

    function setNote(key, note) {
      decisions[key] = {
        ...(decisions[key] || {}),
        decision: decisions[key]?.decision || 'reject',
        note,
        updatedAt: new Date().toISOString()
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(decisions));
      updateStats();
    }

    function clearDecision(key) {
      delete decisions[key];
      save();
    }

    function productCard(product) {
      const stores = product.stores.map(store => '<span class="store">' + store.name + ' ' + euro(store.price) + '</span>').join('');
      const storeLinks = product.stores
        .filter(store => store.url)
        .map(store => '<a class="btn btn-muted" href="' + store.url + '" target="_blank" rel="noreferrer">Abrir ' + store.name + '</a>')
        .join('');
      const productLink = product.productUrl
        ? '<a class="btn btn-muted" href="' + product.productUrl + '" target="_blank" rel="noreferrer">Página PadelCost</a>'
        : '';
      const imageSearch = '<a class="btn btn-muted" href="https://www.google.com/search?tbm=isch&q=' + encodeURIComponent(product.name) + '" target="_blank" rel="noreferrer">Ver imagens</a>';

      return '<article class="product">' +
        '<div class="image-wrap"><img src="' + product.image + '" alt=""></div>' +
        '<div class="product-body">' +
          '<div class="brand">' + product.brand + '</div>' +
          '<div class="name">' + product.name + '</div>' +
          '<div class="price">' + euro(product.price) + '</div>' +
          '<div class="stores">' + stores + '</div>' +
          '<div class="meta">' +
            '<span>ID <b>' + product.id + '</b></span>' +
            '<span>EAN <b>' + (product.ean || '-') + '</b></span>' +
            '<span>GTIN <b>' + (product.gtin || '-') + '</b></span>' +
            '<span>MPN <b>' + (product.mpn || '-') + '</b></span>' +
          '</div>' +
          '<div class="links">' + productLink + imageSearch + storeLinks + '</div>' +
        '</div>' +
      '</article>';
    }

    function textForCandidate(candidate) {
      return [
        candidate.category,
        candidate.brand,
        candidate.a.name,
        candidate.b.name,
        candidate.a.ean,
        candidate.b.ean,
        candidate.a.mpn,
        candidate.b.mpn,
        ...candidate.a.stores.map(store => store.name),
        ...candidate.b.stores.map(store => store.name),
      ].join(' ').toLowerCase();
    }

    function visibleCandidates() {
      const query = document.getElementById('search').value.trim().toLowerCase();
      const filter = document.getElementById('decision-filter').value;
      return CANDIDATES.filter(candidate => {
        const decision = decisions[candidate.key]?.decision || 'pending';
        if (filter !== 'all' && decision !== filter) return false;
        if (filter === 'pending' && decision !== 'pending') return false;
        if (query && !textForCandidate(candidate).includes(query)) return false;
        return true;
      });
    }

    function sideCandidates(type) {
      return CANDIDATES.filter(candidate => decisions[candidate.key]?.decision === type);
    }

    function updateStats() {
      document.getElementById('stat-total').textContent = CANDIDATES.length;
      document.getElementById('stat-merge').textContent = Object.values(decisions).filter(item => item.decision === 'merge').length;
      document.getElementById('stat-reject').textContent = Object.values(decisions).filter(item => item.decision === 'reject').length;
    }

    function miniCard(candidate, type) {
      const decision = decisions[candidate.key] || {};
      const note = decision.note || '';
      const reason = type === 'reject'
        ? '<textarea class="reason" data-action="note" data-key="' + candidate.key + '" placeholder="Motivo para não juntar">' + note.replace(/</g, '&lt;') + '</textarea>'
        : '';
      return '<article class="mini-card" data-decision="' + type + '">' +
        '<div class="mini-title">' + candidate.a.name + '</div>' +
        '<div class="mini-meta">VS<br>' + candidate.b.name + '<br>Score ' + candidate.score + ' | ' + candidate.brand + '</div>' +
        reason +
        '<div class="mini-actions">' +
          '<button class="btn-reset" data-action="clear" data-key="' + candidate.key + '">Voltar</button>' +
          '<button class="btn-muted" data-action="focus" data-key="' + candidate.key + '">Ver</button>' +
        '</div>' +
      '</article>';
    }

    function renderSideLists() {
      const mergeItems = sideCandidates('merge');
      const rejectItems = sideCandidates('reject');
      document.getElementById('merge-list').innerHTML = mergeItems.length
        ? mergeItems.map(candidate => miniCard(candidate, 'merge')).join('')
        : '<div class="empty">Ainda nada aprovado.</div>';
      document.getElementById('reject-list').innerHTML = rejectItems.length
        ? rejectItems.map(candidate => miniCard(candidate, 'reject')).join('')
        : '<div class="empty">Ainda nada rejeitado.</div>';
    }

    function render() {
      const list = document.getElementById('list');
      const visible = visibleCandidates();
      updateStats();
      renderSideLists();

      if (!visible.length) {
        list.innerHTML = '<div class="empty">Nada para mostrar com estes filtros.</div>';
        return;
      }

      list.innerHTML = visible.map(candidate => {
        const decision = decisions[candidate.key]?.decision || 'pending';
        return '<section class="candidate" data-key="' + candidate.key + '" data-decision="' + decision + '">' +
          '<div class="candidate-head">' +
            '<div class="score"><span class="pill">' + candidate.category + '</span><span>Score ' + candidate.score + '</span><span>' + candidate.brand + '</span></div>' +
            '<div class="decision">' +
              '<button class="btn-merge" data-action="merge" data-key="' + candidate.key + '">Juntar</button>' +
              '<button class="btn-reject" data-action="reject" data-key="' + candidate.key + '">Não juntar</button>' +
              '<button class="btn-reset" data-action="clear" data-key="' + candidate.key + '">Limpar</button>' +
            '</div>' +
          '</div>' +
          '<div class="pair">' + productCard(candidate.a) + '<div class="vs">VS</div>' + productCard(candidate.b) + '</div>' +
        '</section>';
      }).join('');
    }

    function exportDecisions() {
      const rows = Object.entries(decisions).map(([key, value]) => {
        const candidate = CANDIDATES.find(item => item.key === key);
        return {
          key,
          decision: value.decision,
          note: value.note || '',
          updatedAt: value.updatedAt,
          idA: candidate?.a.id,
          nameA: candidate?.a.name,
          idB: candidate?.b.id,
          nameB: candidate?.b.name,
        };
      });
      const blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'duplicados-decisoes.json';
      link.click();
      URL.revokeObjectURL(url);
    }

    function importDecisions(file) {
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const imported = JSON.parse(reader.result);
          if (!Array.isArray(imported)) throw new Error('Formato invalido');
          for (const item of imported) {
            if (!item.key || !item.decision) continue;
            decisions[item.key] = {
              ...(decisions[item.key] || {}),
              decision: item.decision,
              note: item.note || decisions[item.key]?.note || '',
              updatedAt: item.updatedAt || new Date().toISOString()
            };
          }
          save();
        } catch (error) {
          alert('Não consegui importar esse histórico. Confirma que é o duplicados-decisoes.json.');
        }
      };
      reader.readAsText(file);
    }

    function clearAllDecisions() {
      if (!confirm('Limpar todo o histórico desta revisão?')) return;
      for (const key of Object.keys(decisions)) {
        delete decisions[key];
      }
      localStorage.removeItem(STORAGE_KEY);
      render();
    }

    function focusCandidate(key) {
      document.getElementById('decision-filter').value = 'all';
      const candidate = CANDIDATES.find(item => item.key === key);
      if (candidate) {
        document.getElementById('search').value = candidate.a.id + ' ' + candidate.b.id;
      }
      render();
      setTimeout(() => {
        const el = document.querySelector('.candidate[data-key="' + key + '"]');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 0);
    }

    document.getElementById('search').addEventListener('input', render);
    document.getElementById('decision-filter').addEventListener('change', render);
    document.getElementById('export').addEventListener('click', exportDecisions);
    document.getElementById('import').addEventListener('change', event => importDecisions(event.target.files[0]));
    document.getElementById('clear-all').addEventListener('click', clearAllDecisions);
    document.body.addEventListener('click', event => {
      const button = event.target.closest('button[data-action]');
      if (!button) return;
      const key = button.dataset.key;
      const action = button.dataset.action;
      if (action === 'clear') clearDecision(key);
      else if (action === 'focus') focusCandidate(key);
      else setDecision(key, action);
    });
    document.body.addEventListener('input', event => {
      const field = event.target.closest('textarea[data-action="note"]');
      if (!field) return;
      setNote(field.dataset.key, field.value);
    });

    render();
  </script>
</body>
</html>`;
}

function main() {
  const products = extractProducts()
    .filter(product => CORE_CATEGORIES.has(product.category))
    .filter(product => REVIEW_CATEGORIES.has(product.category));
  const decisions = loadDuplicateDecisions();
  const candidates = buildCandidates(products)
    .filter(candidate => !candidateWasReviewed(candidate, decisions));
  fs.writeFileSync(OUTPUT_FILE, buildHtml(candidates));
  console.log(`Pagina gerada: ${OUTPUT_FILE}`);
  console.log(`Candidatos incluidos: ${candidates.length}`);
}

main();
