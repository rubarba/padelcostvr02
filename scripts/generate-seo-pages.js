const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA_FILE = path.join(ROOT, 'data', 'products-data.js');
const INDEX_FILE = path.join(ROOT, 'index.html');
const PRODUCT_DIR = path.join(ROOT, 'produto');
const CATEGORY_DIR = path.join(ROOT, 'categoria');
const SITEMAP_FILE = path.join(ROOT, 'sitemap.xml');
const SEO_DATA_FILE = path.join(ROOT, 'data', 'seo-pages-data.js');
const SITE_URL = 'https://padelcost.pt';
const TODAY = new Date().toISOString().slice(0, 10);

const CATEGORY_CONFIG = {
  raquetes: {
    slug: 'raquetes-de-padel',
    label: 'Raquetes de padel',
    singular: 'raquete de padel',
    title: 'Raquetes de Padel ao Melhor Preço | PadelCost',
    description: 'Compara preços de raquetes de padel em várias lojas. Encontra modelos Adidas, Bullpadel, Head, NOX, Wilson e outras marcas ao melhor preço disponível.',
    intro: 'Compara raquetes de padel disponiveis em lojas parceiras e encontra rapidamente onde esta o melhor preço.'
  },
  sapatilhas: {
    slug: 'sapatilhas-de-padel',
    label: 'Sapatilhas de padel',
    singular: 'sapatilha de padel',
    title: 'Sapatilhas de Padel ao Melhor Preço | PadelCost',
    description: 'Compara preços de sapatilhas de padel em várias lojas. Vê modelos por marca, preço e disponibilidade para encontrares a melhor oferta.',
    intro: 'Compara sapatilhas de padel e descobre modelos para jogar com mais conforto, estabilidade e aderência.'
  },
  sacos: {
    slug: 'sacos-de-padel',
    label: 'Sacos de padel',
    singular: 'saco de padel',
    title: 'Sacos de Padel ao Melhor Preço | PadelCost',
    description: 'Compara preços de sacos de padel em lojas parceiras. Encontra paleteros e sacos das principais marcas ao melhor preço disponível.',
    intro: 'Compara sacos de padel e paleteros para transportares raquetes, sapatilhas e equipamento com mais organização.'
  }
};

const STATIC_URLS = [
  '/',
  '/como-funciona.html',
  '/cookies.html',
  '/dados.html',
  '/privacidade.html',
  '/sobre.html',
  '/contacto.html',
  '/guia-raquetes.html',
  '/guia-sapatilhas.html',
  '/guia-formatos.html',
  '/quiz-jogador.html',
  '/lojas.html'
];

const STORE_LOGOS = {
  'Adidas Padel': '../logos/Logo_Adidas_10.svg',
  'Amazon ES': '../logos/amazon-logo.png',
  'Atmosfera Sport': '../logos/atmosfera-sport-logo.svg',
  'Forum Sport ES': '../logos/logo-forum-sport-es.webp',
  'Padel Market': '../logos/logo_padelmarket.svg',
  'Padel Proshop PT': '../logos/padel-proshop-pt-logo.png',
  'Zona de Padel': '../logos/zonadepadel.png'
};

const BRAND_LOGOS = {
  adidas: '../logos_marcas/palas-de-padel-adidas.jpg',
  'adidas padel': '../logos_marcas/palas-de-padel-adidas.jpg',
  asics: '../logos_marcas/zapatillas-de-padel-asics.jpg',
  babolat: '../logos_marcas/palas-de-padel-babolat.jpg',
  'black crown': '../logos_marcas/palas-de-padel-black-crown.jpg',
  bullpadel: '../logos_marcas/palas-de-padel-bullpadel-.jpg',
  dreampadel: '../logos_marcas/palas-de-padel-dreampadel.jpg',
  'drop shot': '../logos_marcas/palas-de-padel-drop-shot.jpg',
  dunlop: '../logos_marcas/palas-de-padel-dunlop.jpg',
  enebe: '../logos_marcas/palas-de-padel-enebe.jpg',
  head: '../logos_marcas/9-b-prod.png',
  joma: '../logos_marcas/palas-de-padel-joma.jpg',
  kombat: '../logos_marcas/palas-de-padel-kombat.jpg',
  lacoste: '../logos_marcas/zapatillas-lacoste.jpg',
  lok: '../logos_marcas/palas-de-padel-lok.jpg',
  mizuno: '../logos_marcas/zapatillas-mizuno.jpg',
  munich: '../logos_marcas/zapatillas-munich.jpg',
  nox: '../logos_marcas/palas-de-padel-nox.jpg',
  puma: '../logos_marcas/zapatillas-puma.jpg',
  'royal padel': '../logos_marcas/palas-de-padel-royal-padel.jpg',
  siux: '../logos_marcas/palas-de-padel-siux.jpg',
  'star vie': '../logos_marcas/palas-de-padel-star-vie.jpg',
  starvie: '../logos_marcas/palas-de-padel-star-vie.jpg',
  tecnifibre: '../logos_marcas/palas-de-padel-tecnifibre.jpg',
  vibora: '../logos_marcas/palas-de-padel-vibora.jpg',
  'vibor-a': '../logos_marcas/palas-de-padel-vibora.jpg',
  wilson: '../logos_marcas/palas-de-padel-wilson.jpg'
};

function readProducts() {
  const source = fs.readFileSync(DATA_FILE, 'utf8');
  const productsMatch = source.match(/window\.PADELCOST_PRODUCTS\s*=\s*(\[[\s\S]*?\]);/);
  const updatedMatch = source.match(/window\.PADELCOST_UPDATED_AT\s*=\s*"([^"]+)"/);
  if (!productsMatch) throw new Error('Nao foi possivel encontrar window.PADELCOST_PRODUCTS.');
  return {
    products: JSON.parse(productsMatch[1]),
    updatedAt: updatedMatch ? updatedMatch[1] : null
  };
}

let indexSourceCache = null;
function readIndexSource() {
  if (!indexSourceCache) indexSourceCache = fs.readFileSync(INDEX_FILE, 'utf8');
  return indexSourceCache;
}

function jsxSvgToHtml(svg) {
  return svg
    .replace(/className=/g, 'class=')
    .replace(/style=\{\{width:'40px',height:'40px',fill:'currentColor'\}\}/g, 'style="width:40px;height:40px;fill:currentColor"')
    .replace(/style=\{\{ height: '52px', width: 'auto' \}\}/g, 'style="height:52px;width:auto"')
    .replace(new RegExp('<style>\\{`([\\s\\S]*?)`\\}<\\/style>', 'g'), '<style>$1</style>');
}

function getHomeBodyBackgroundImage() {
  const source = readIndexSource();
  const match = source.match(/background-image:\s*url\("(data:image\/png;base64,[^"]+)"\);/);
  return match ? match[1] : '';
}

function getMainLogoSvg() {
  const source = readIndexSource();
  const match = source.match(/const LogoSVG = \(\) => \(\n\s*([\s\S]*?<\/svg>)\n\s*\);/);
  if (!match) throw new Error('Nao foi possivel encontrar LogoSVG no index.html.');
  return jsxSvgToHtml(match[1].trim());
}

function getCategoryIconHtml(category, pageContext) {
  const files = {
    raquetes: ['WHITE_RAQUETES_TRANSPARENT.png', 'COLOR_RAQUETES.png'],
    sapatilhas: ['WHITE_SAPATILHAS_TRANSPARENT.png', 'COLOR_SAPATILHAS.png'],
    sacos: ['WHITE_SACOS_TRANSPARENT.png', 'COLOR_SACOS.png']
  };
  const pair = files[category];
  if (!pair) return '';
  const white = getPageHref('logos/category-icons/' + pair[0], pageContext) + '?v=20260506-category-icons';
  const color = getPageHref('logos/category-icons/' + pair[1], pageContext) + '?v=20260506-category-icons';
  return '<span class="category-icon-stack" aria-hidden="true"><img class="category-icon-img category-icon-white" src="' + white + '" alt=""><img class="category-icon-img category-icon-color" src="' + color + '" alt=""></span>';
}

function stripDiacritics(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function slugify(value) {
  return stripDiacritics(value)
    .toLowerCase()
    .replace(/&/g, ' e ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 92) || 'produto';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/\n/g, ' ');
}

function formatPrice(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '';
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(number);
}

function asNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function stockToAvailability(stock) {
  const normalized = stripDiacritics(String(stock || '')).toLowerCase();
  if (normalized.includes('out') || normalized.includes('esgot') || normalized.includes('sem stock')) {
    return 'https://schema.org/OutOfStock';
  }
  return 'https://schema.org/InStock';
}

function getStoreLogo(store) {
  return STORE_LOGOS[store?.name] || null;
}

function getBrandLogo(product) {
  const key = stripDiacritics(product.brand || '').toLowerCase().trim();
  return BRAND_LOGOS[key] || '';
}

function formatSpecLabel(key) {
  const labels = {
    peso: 'Peso',
    forma: 'Forma',
    equilibrio: 'Equilíbrio',
    nivel: 'Nível',
    material: 'Material',
    estilo: 'Estilo',
    sola: 'Sola',
    genero: 'Género',
    cor: 'Cor',
    uso: 'Uso',
    amortecimento: 'Amortecimento',
    tipo: 'Tipo',
    tamanho: 'Tamanho'
  };
  return labels[String(key || '').toLowerCase()] || key;
}

function getSpecIconClass(key) {
  const icons = {
    peso: 'fa-weight-hanging',
    forma: 'fa-gem',
    equilibrio: 'fa-scale-balanced',
    nivel: 'fa-chart-line',
    material: 'fa-layer-group',
    estilo: 'fa-bolt',
    sola: 'fa-shoe-prints',
    genero: 'fa-user',
    cor: 'fa-palette',
    uso: 'fa-fire',
    amortecimento: 'fa-shield-halved',
    tipo: 'fa-briefcase',
    tamanho: 'fa-ruler'
  };
  return icons[String(key || '').toLowerCase()] || 'fa-circle-info';
}

function buildProductSummary(product) {
  const title = productTitle(product);
  const specs = product.specs || {};
  const level = specs.nivel ? String(specs.nivel).toLowerCase() : '';
  const style = specs.estilo || specs.uso || '';
  const shape = specs.forma ? String(specs.forma).toLowerCase() : '';
  const material = specs.material ? String(specs.material).toLowerCase() : '';
  const sole = specs.sola ? String(specs.sola).toLowerCase() : '';
  const cushioning = specs.amortecimento ? String(specs.amortecimento).toLowerCase() : '';
  const gender = specs.genero ? String(specs.genero).toLowerCase() : '';

  if (product.category === 'raquetes') {
    const profile = level ? `de nível ${level}` : 'para diferentes níveis de jogo';
    const intent = style ? `orientada para ${String(style).toLowerCase()}` : 'com boa combinação entre controlo e saída de bola';
    const details = [shape && `formato ${shape}`, material && `construção em ${material}`].filter(Boolean).join(' e ');
    return `${title} é uma raquete ${profile}, ${intent}${details ? `, com ${details}` : ''}.`;
  }

  if (product.category === 'sapatilhas') {
    const target = gender ? `para ${gender}` : 'para jogar padel';
    const details = [sole && `sola ${sole}`, cushioning && `amortecimento ${cushioning}`].filter(Boolean).join(' e ');
    return `${title} são sapatilhas de padel ${target}, pensadas para conforto, estabilidade e aderência${details ? `, com ${details}` : ''}.`;
  }

  if (product.category === 'sacos') {
    return `${title} é um saco de padel pensado para transportar raquetes, roupa e acessórios com organização e praticidade.`;
  }

  return `${title} é um artigo de padel pensado para apoiar o teu jogo com equipamento adequado.`;
}

function buildFallbackProductDescription(product, lowPrice, storeCount) {
  const title = productTitle(product);
  const specs = product.specs || {};
  const brand = product.brand || '';
  const category = product.category;
  const style = specs.estilo || specs.uso || '';
  const level = specs.nivel || '';
  const shape = specs.forma || '';
  const material = specs.material || '';
  const sole = specs.sola || '';
  const cushioning = specs.amortecimento || '';
  const gender = specs.genero || '';
  const color = specs.cor || '';
  const brandText = brand ? ` da ${brand}` : '';

  if (category === 'raquetes') {
    const profile = level ? `jogadores de nível ${String(level).toLowerCase()}` : 'jogadores que querem evoluir em pista';
    const intent = style ? `procuram ${String(style).toLowerCase()}` : 'procuram uma boa combinação entre controlo, saída de bola e estabilidade';
    const details = [shape && `formato ${String(shape).toLowerCase()}`, material && `construção em ${String(material).toLowerCase()}`].filter(Boolean).join(' e ');
    return `${title} é uma raquete de padel${brandText} pensada para ${profile} que ${intent}. ${details ? `Com ${details}, oferece uma resposta equilibrada para jogar com confiança em diferentes fases do ponto.` : 'É uma opção a considerar para quem procura rendimento consistente e boas sensações em jogo.'}`;
  }

  if (category === 'sapatilhas') {
    const target = gender ? `para ${String(gender).toLowerCase()}` : 'para jogar padel';
    const useText = style ? ` para ${String(style).toLowerCase() === 'intenso' ? 'uso intenso' : String(style).toLowerCase()}` : '';
    const details = [sole && `sola ${String(sole).toLowerCase()}`, cushioning && `amortecimento ${String(cushioning).toLowerCase()}`, color && `cor ${String(color).toLowerCase()}`].filter(Boolean).join(', ');
    return `${title} são sapatilhas de padel${brandText} ${target}, indicadas para quem procura conforto, estabilidade e aderência em campo${useText}. ${details ? `Destacam-se por ${details}, ajudando a manter segurança nos apoios e mudanças de direção.` : 'Foram pensadas para acompanhar movimentos rápidos, travagens e mudanças de direção típicas do padel.'}`;
  }

  if (category === 'sacos') {
    const details = [color && `cor ${String(color).toLowerCase()}`, specs.tipo && `tipo ${String(specs.tipo).toLowerCase()}`].filter(Boolean).join(', ');
    return `${title} é um saco de padel${brandText} pensado para transportar o equipamento de forma prática e organizada. ${details ? `Com ${details}, é uma opção útil para levar raquetes, roupa e acessórios para treinos ou jogos.` : 'É uma opção útil para levar raquetes, roupa e acessórios para treinos ou jogos.'}`;
  }

  return `${title} é um artigo de padel${brandText} pensado para quem procura equipamento fiável e adequado ao seu jogo.`;
}

function getStoreInitials(name) {
  return String(name || 'Loja')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part.charAt(0).toUpperCase())
    .join('');
}

function cleanDescription(value) {
  const text = String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text || text.length < 40) return '';
  return text.slice(0, 900);
}

function getProductFeedDescription(product) {
  return cleanDescription(product.description || product.shortDescription || product.productDescription || product.longDescription);
}

function getProductUrl(product) {
  return `/produto/${product.seoSlug}.html`;
}

function getCategoryUrl(category) {
  return `/categoria/${CATEGORY_CONFIG[category].slug}.html`;
}

function getCategoryHref(category, from = 'root') {
  const slug = CATEGORY_CONFIG[category].slug;
  if (from === 'product') return `../categoria/${slug}.html`;
  if (from === 'category') return `./${slug}.html`;
  return `./categoria/${slug}.html`;
}

function getHomeCategoryHref(category, from = 'root') {
  return `${getRootHref(from)}?categoria=${encodeURIComponent(category)}`;
}

function getProductHref(product, from = 'root') {
  if (from === 'category') return `../produto/${product.seoSlug}.html`;
  return `./produto/${product.seoSlug}.html`;
}

function getRootHref(from = 'root') {
  return from === 'root' ? './index.html' : '../index.html';
}

function getPageHref(file, from = 'root') {
  return from === 'root' ? `./${file}` : `../${file}`;
}

function categoryLabel(category) {
  return CATEGORY_CONFIG[category]?.label || category;
}

function productTitle(product) {
  const name = String(product.name || '').trim();
  if (!name) return 'Produto de padel';
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function productMetaTitle(product) {
  const title = productTitle(product);
  return `${title} - Comparar Preços | PadelCost`;
}

function productDescription(product) {
  const title = productTitle(product);
  const storeCount = (product.stores || []).length;
  const price = formatPrice(product.price);
  return `Compara preços de ${title}${product.brand ? ` da ${product.brand}` : ''} em ${storeCount} lojas. Melhor preço encontrado: ${price}. Atualizado no PadelCost.`;
}

function jsonLd(data) {
  return `<script type="application/ld+json">${JSON.stringify(data, null, 2).replace(/</g, '\\u003c')}</script>`;
}

function jsonScriptValue(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function layout({ title, description, canonicalPath, body, extraHead = '', pageContext = 'root', activeCategory = 'all', showCategoryNav = true }) {
  const canonical = `${SITE_URL}${canonicalPath}`;
  const categoryNav = showCategoryNav ? `
  <nav class="categories-bar" aria-label="Categorias principais">
    <div class="container categories-inner">
      <div class="categories-container">
        <a class="category-btn ${activeCategory === 'raquetes' ? 'active' : ''}" href="${getHomeCategoryHref('raquetes', pageContext)}"><span class="category-icon">${getCategoryIconHtml('raquetes', pageContext)}</span><span>Raquetes</span></a>
        <a class="category-btn ${activeCategory === 'sapatilhas' ? 'active' : ''}" href="${getHomeCategoryHref('sapatilhas', pageContext)}"><span class="category-icon">${getCategoryIconHtml('sapatilhas', pageContext)}</span><span>Sapatilhas</span></a>
        <a class="category-btn ${activeCategory === 'sacos' ? 'active' : ''}" href="${getHomeCategoryHref('sacos', pageContext)}"><span class="category-icon">${getCategoryIconHtml('sacos', pageContext)}</span><span>Sacos de padel</span></a>
      </div>
      <a class="category-help-link" href="${getPageHref('como-funciona.html', pageContext)}"><span>ⓘ</span><span>Como funciona?</span></a>
    </div>
  </nav>` : '';
  return `<!doctype html>
<html lang="pt-PT">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="icon" type="image/png" sizes="48x48" href="${getPageHref('favicon-48.png', pageContext)}">
  <link rel="icon" type="image/png" sizes="192x192" href="${getPageHref('favicon-192.png', pageContext)}">
  <link rel="apple-touch-icon" sizes="192x192" href="${getPageHref('favicon-192.png', pageContext)}">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeAttr(description)}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${canonical}">
  <meta property="og:title" content="${escapeAttr(title)}">
  <meta property="og:description" content="${escapeAttr(description)}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${canonical}">
  <meta property="og:site_name" content="PadelCost">
  <meta property="og:image" content="${SITE_URL}/favicon-192.png">
  ${extraHead}
  <style>
    :root { color-scheme: light; --blue:#0077cc; --green:#00c985; --green-dark:#00a66d; --navy:#0f1f35; --text:#132033; --muted:#66758a; --line:#dfe7f1; --bg:#f2f6fb; --soft:#eef4fb; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Manrope, Arial, sans-serif; color: var(--text); background-color: var(--bg); background-image:url("${getHomeBodyBackgroundImage()}"); background-repeat:repeat; background-attachment:scroll; line-height: 1.55; }
    a { color: inherit; }
    .container { width: min(1120px, calc(100% - 32px)); margin: 0 auto; }
    .header { background: linear-gradient(135deg, #0c141d 0%, #163047 48%, #1f6ead 100%); border-bottom:1px solid rgba(255,255,255,.08); box-shadow:0 24px 60px rgba(9,16,25,.24); position:sticky; top:0; z-index:100; padding:1.3rem 0; }
    .header-top { display:flex; justify-content:space-between; align-items:center; gap:2rem; padding:.5rem 0; }
    .brand { display:flex; align-items:center; text-decoration:none; flex-shrink:0; }
    .brand svg { height:62px; width:auto; display:block; }
    .header-tagline { flex-shrink:0; border-left:1px solid rgba(255,255,255,.15); padding-left:1.5rem; margin-left:.5rem; }
    .header-tagline p { margin:0; color:rgba(255,255,255,.85); font-size:.82rem; font-weight:500; line-height:1.5; }
    .header-tagline p:first-child { color:#fff; font-weight:800; }
    .search-wrapper { flex:1; max-width:650px; }
    .search-inner { position:relative; display:flex; align-items:center; }
    .search-icon { position:absolute; left:1.1rem; color:#9ca3af; font-size:.86rem; pointer-events:none; }
    .search-input { width:100%; padding:.85rem 1.4rem .85rem 2.6rem; background:rgba(255,255,255,.95); border:0; border-radius:30px; color:var(--text); font-family:Manrope, Arial, sans-serif; font-size:.95rem; box-shadow:0 4px 12px rgba(0,0,0,.1); }
    .search-input:focus { outline:none; box-shadow:0 6px 20px rgba(0,119,204,.2); }
    .search-input::placeholder { color:#9ca3af; }
    .header-actions { display:flex; align-items:center; gap:.85rem; flex-shrink:0; }
    .favorites-trigger { display:inline-flex; align-items:center; gap:.55rem; color:#fff; text-decoration:none; font-size:.85rem; font-weight:800; white-space:nowrap; }
    .favorites-trigger-count { min-width:22px; height:22px; padding:0 .35rem; border-radius:999px; background:#fff; color:var(--blue); display:inline-flex; align-items:center; justify-content:center; font-size:.74rem; font-weight:900; }
    .categories-bar { background:#ffffff; border-bottom:1px solid rgba(19,32,44,.08); }
    .categories-inner { display:flex; align-items:center; gap:1rem; }
    .categories-container { flex:1; display:flex; gap:0; overflow-x:auto; scroll-behavior:smooth; min-width:0; }
    .categories-container::-webkit-scrollbar { display:none; }
    .category-btn { display:flex; align-items:center; gap:.6rem; padding:.45rem 1.6rem; background:transparent; border:0; border-bottom:3px solid transparent; color:#66758a; font-family:Manrope, Arial, sans-serif; font-weight:700; font-size:1.05rem; text-decoration:none; white-space:nowrap; position:relative; }
    .category-btn:hover, .category-btn.active { color:var(--text); }
    .category-btn::after { content:""; position:absolute; left:1.2rem; right:1.2rem; bottom:-1px; height:3px; border-radius:999px; background:linear-gradient(90deg, #13202c 0%, #246fb2 100%); opacity:0; transform:scaleX(.7); transition:opacity .25s ease, transform .25s ease; }
    .category-btn:hover::after, .category-btn.active::after { opacity:1; transform:scaleX(1); }
    .category-icon { width:75px; height:75px; display:flex; align-items:center; justify-content:center; flex-shrink:0; transition:transform .25s ease; }
    .category-icon-stack { position:relative; width:71px; height:71px; display:block; }
    .category-icon-img { position:absolute; inset:0; width:100%; height:100%; object-fit:contain; transition:opacity .22s ease, transform .22s ease; }
    .category-icon-white { opacity:.98; filter:none; }
    .category-icon-color { opacity:0; transform:scale(.96); }
    .category-btn:hover .category-icon, .category-btn.active .category-icon { transform:translateY(-1px); }
    .category-btn:hover .category-icon-white, .category-btn.active .category-icon-white { opacity:0; }
    .category-btn:hover .category-icon-color, .category-btn.active .category-icon-color { opacity:1; transform:scale(1); }
    .category-help-link { display:inline-flex; align-items:center; gap:.5rem; color:#51627a; font-size:.95rem; font-weight:700; text-decoration:none; white-space:nowrap; flex-shrink:0; }
    .hero { padding: 2rem 0 1.3rem; background: white; border-bottom:1px solid var(--line); }
    .breadcrumb { display:flex; flex-wrap:wrap; gap:.4rem; color:var(--muted); font-size:.9rem; margin-bottom:.8rem; }
    .breadcrumb a { color:var(--blue); text-decoration:none; font-weight:800; }
    h1 { margin:.2rem 0 .8rem; font-size:1.28rem; font-weight:700; line-height:1.2; letter-spacing:0; }
    .lead { color:var(--muted); max-width:760px; font-size:1.08rem; margin:0; }
    .section { padding: 2rem 0; }
    .grid { display:grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap:1rem; }
    .card { background:white; border:1px solid var(--line); border-radius:8px; padding:1rem; box-shadow:0 8px 24px rgba(15,31,53,.06); text-decoration:none; display:flex; flex-direction:column; min-height:100%; }
    .card img { width:100%; aspect-ratio:1/1; object-fit:contain; background:white; border:1px solid var(--line); border-radius:8px; margin-bottom:.8rem; }
    .eyebrow { text-transform:uppercase; letter-spacing:.05em; font-weight:900; font-size:.75rem; color:#8aa0bb; }
    .card h2, .card h3 { font-size:1.02rem; line-height:1.25; margin:.25rem 0 .75rem; }
    .price { font-size:1.4rem; font-weight:900; margin-top:auto; }
    .meta { color:var(--muted); font-size:.92rem; }
    .button { display:inline-flex; justify-content:center; align-items:center; min-height:46px; padding:.75rem 1.15rem; border-radius:999px; background:var(--blue); color:white; text-decoration:none; font-weight:900; border:0; white-space:nowrap; }
    .stores { display:grid; gap:.78rem; margin-top:1.2rem; }
    .store { display:grid; grid-template-columns:160px 1fr auto auto; align-items:center; gap:1rem; background:#f8fafc; border:1px solid transparent; border-radius:12px; padding:.9rem 1rem; }
    .store-best { background:#f7fffb; border:2px solid var(--green); }
    .store-logo { width:160px; height:80px; border:1px solid var(--line); border-radius:8px; background:white; display:flex; align-items:center; justify-content:center; padding:.35rem; overflow:hidden; }
    .store-logo img { width:100%; height:100%; object-fit:contain; }
    .store-logo-fallback { color:var(--muted); font-weight:900; font-size:1.25rem; }
    .store strong { display:block; font-size:1rem; }
    .store-stock { display:flex; align-items:center; gap:.25rem; color:var(--green-dark); font-size:.9rem; font-weight:700; }
    .store-stock::before { content:'✓'; display:inline-flex; align-items:center; justify-content:center; width:14px; height:14px; border-radius:50%; color:white; background:var(--green); font-size:.62rem; }
    .store-price-wrap { display:flex; align-items:center; gap:.65rem; justify-content:flex-end; }
    .store-price { font-size:1.28rem; font-weight:900; white-space:nowrap; }
    .best-badge { display:inline-flex; align-items:center; min-height:26px; padding:.25rem .65rem; border-radius:7px; background:var(--green); color:white; font-size:.74rem; font-weight:900; text-transform:uppercase; white-space:nowrap; }
    .product-layout { display:grid; gap:1rem; align-items:start; }
    .product-overview { display:grid; grid-template-columns:minmax(280px, 420px) minmax(0, 1fr); gap:2rem; align-items:start; background:#fff; border:1px solid var(--line); border-radius:14px; padding:1.4rem; box-shadow:0 18px 42px rgba(15,31,53,.08); }
    .product-media { display:flex; flex-direction:column; gap:1rem; }
    .product-image { background:white; border:1px solid var(--line); border-radius:8px; padding:1rem; min-height:420px; display:flex; align-items:center; justify-content:center; }
    .product-image img { width:100%; aspect-ratio:1/1; object-fit:contain; }
    .product-info { padding:.2rem 0 0; }
    .product-info-head { display:block; }
    .product-brand { color:var(--blue); font-weight:700; text-transform:uppercase; letter-spacing:.06em; font-size:.78rem; margin-bottom:.3rem; }
    .brand-logo { min-height:92px; display:flex; justify-content:center; align-items:center; padding:.75rem; background:#fff; }
    .brand-logo img { max-width:260px; max-height:92px; object-fit:contain; }
    .product-summary { margin:.2rem 0 1rem; color:#51627a; font-size:.92rem; line-height:1.5; max-width:720px; }
    .facts { display:grid; grid-template-columns:repeat(2, minmax(130px, 1fr)); gap:.55rem .85rem; margin:.8rem 0 1rem; }
    .fact { background:transparent; border:0; border-radius:0; padding:0; display:grid; grid-template-columns:34px 1fr; align-items:center; gap:.5rem; }
    .spec-icon { width:32px; height:32px; border-radius:9px; background:#f2f6fb; color:var(--blue); display:inline-flex; align-items:center; justify-content:center; font-size:.86rem; box-shadow:inset 0 0 0 1px rgba(0,119,204,.06); }
    .fact span:not(.spec-icon) { display:block; color:#8aa0bb; font-size:.7rem; text-transform:uppercase; letter-spacing:.05em; font-weight:700; }
    .fact strong { display:block; color:var(--text); font-size:.82rem; font-weight:600; }
    .top-offer { margin:1.15rem 0 0; display:grid; grid-template-columns:150px 1fr auto; align-items:center; gap:1rem; border:1px solid var(--line); border-radius:10px; padding:.95rem; background:#fff; box-shadow:0 10px 28px rgba(15,31,53,.05); }
    .top-offer .store-logo { width:150px; height:76px; }
    .top-offer-price { display:flex; flex-direction:column; align-items:flex-start; gap:.35rem; }
    .top-offer-price strong { font-size:1.55rem; line-height:1; }
    .top-offer .button { min-width:160px; gap:.6rem; background:linear-gradient(135deg, #0a8be0 0%, #0056d6 100%); }
    .product-description { margin-top:1.3rem; max-width:none; }
    .product-description h2 { margin:0 0 .55rem; font-size:1rem; font-weight:700; }
    .product-description p { margin:0; color:#51627a; font-size:.92rem; line-height:1.65; }
    .product-actions { display:flex; align-items:center; gap:.85rem; flex-wrap:wrap; margin-top:1rem; }
    .save-product-btn { display:inline-flex; align-items:center; gap:.45rem; min-height:40px; padding:.62rem .9rem; border:1px solid var(--line); border-radius:999px; background:#fff; color:var(--text); font-weight:700; text-decoration:none; cursor:pointer; font-family:inherit; font-size:.82rem; transition:all .25s ease; }
    .save-product-btn:hover { border-color:rgba(32,111,220,.2); color:var(--blue); background:#eef7ff; }
    .save-product-btn.active { color:#dc2626; border-color:rgba(220,38,38,.14); background:#fff5f5; }
    .share-product-link { display:inline-flex; align-items:center; gap:.45rem; color:#8aa0bb; font-weight:700; text-decoration:none; background:transparent; border:0; cursor:pointer; font-family:inherit; font-size:.84rem; padding:0; transition:color .2s ease; }
    .share-product-link:hover { color:var(--blue); }
    .price-heading { margin:1.2rem 0 .4rem; font-size:1.1rem; }
    .footer { background:#0f1f35; color:rgba(255,255,255,.78); padding:2rem 0; margin-top:2rem; font-size:.92rem; }
    .footer a { color:white; font-weight:800; text-decoration:none; }
    @media (min-width: 761px) and (max-width: 1040px) { .header { padding:.82rem 0; } .header-top { display:grid; grid-template-columns:auto minmax(0,1fr) auto; gap:.85rem 1rem; } .brand svg { height:46px; } .header-tagline { padding-left:1rem; margin-left:0; } .header-tagline p { font-size:.72rem; line-height:1.35; } .header-tagline p:last-child { display:none; } .search-wrapper { grid-column:1 / -1; width:100%; max-width:none; } .category-btn { padding:.78rem 1rem; font-size:.88rem; } }
    @media (max-width: 760px) { .container { width:min(100% - 24px, 1120px); } .header { padding:.72rem 0 .62rem; } .header-top { flex-direction:column; align-items:stretch; gap:.68rem; padding:0; } .brand { align-self:center; } .brand svg { height:32px; } .header-tagline { border-left:0; padding-left:0; margin-left:0; text-align:center; } .header-tagline p { font-size:.66rem; line-height:1.25; } .header-tagline p:last-child { display:none; } .search-wrapper { width:70%; max-width:70%; margin:0 auto; } .header-actions { position:absolute; top:.8rem; right:12px; } .favorites-trigger span:first-of-type { display:none; } .categories-inner { align-items:stretch; } .category-help-link { display:none; } .category-btn { padding:.55rem .9rem; font-size:.88rem; } .category-icon { width:53px; height:53px; } .category-icon-stack { width:53px; height:53px; } .product-overview { grid-template-columns:1fr; padding:1rem; } .product-info-head { display:block; } .brand-logo { min-height:76px; justify-content:flex-start; } .brand-logo img { max-width:170px; max-height:76px; } .facts { grid-template-columns:1fr; } .top-offer { grid-template-columns:1fr; } .top-offer .store-logo { width:160px; max-width:100%; } .top-offer .button { width:100%; } .product-image { min-height:280px; } .store { grid-template-columns:1fr; } .store-logo { width:160px; max-width:100%; } .store-price-wrap { justify-content:flex-start; flex-wrap:wrap; } }
  </style>
</head>
<body>
  <header class="header">
    <div class="container">
      <div class="header-top">
        <a class="brand" href="${getRootHref(pageContext)}" aria-label="PadelCost">${getMainLogoSvg()}</a>
        <div class="header-tagline">
          <p>Compara preços de artigos de padel.</p>
          <p>Encontra a melhor oferta entre várias lojas</p>
        </div>
        <form class="search-wrapper" action="${getRootHref(pageContext)}" method="get">
          <div class="search-inner">
            <span class="search-icon">⌕</span>
            <input class="search-input" type="search" name="q" placeholder="Procurar produto, marca ou categoria">
          </div>
        </form>
        <div class="header-actions">
          <a class="favorites-trigger" href="${getRootHref(pageContext)}#favoritos"><span>♡</span><span>Favoritos</span><span class="favorites-trigger-count">0</span></a>
        </div>
      </div>
    </div>
  </header>
  ${categoryNav}
  ${body}
  <footer class="footer">
    <div class="container">
      <p><strong>PadelCost</strong> compara preços de artigos de padel em lojas parceiras. Os preços podem variar; confirma sempre na loja antes de comprar.</p>
      <p><a href="${getPageHref('dados.html', pageContext)}">Dados e transparência</a> · <a href="${getPageHref('privacidade.html', pageContext)}">Privacidade</a> · <a href="${getPageHref('contacto.html', pageContext)}">Contacto</a></p>
    </div>
  </footer>
</body>
</html>
`;
}

function productCard(product) {
  const title = productTitle(product);
  return `<a class="card" href="${getProductHref(product, 'category')}">
    ${product.image ? `<img src="${escapeAttr(product.image)}" alt="${escapeAttr(title)}" loading="lazy">` : ''}
    <span class="eyebrow">${escapeHtml(product.brand || categoryLabel(product.category))}</span>
    <h2>${escapeHtml(title)}</h2>
    <p class="meta">${escapeHtml((product.stores || []).length)} lojas encontradas</p>
    <div class="price">${escapeHtml(formatPrice(product.price))}</div>
  </a>`;
}

function renderCategoryPage(category, products) {
  const config = CATEGORY_CONFIG[category];
  const canonicalPath = getCategoryUrl(category);
  const sorted = [...products].sort((a, b) => (a.price || 0) - (b.price || 0));
  const brands = [...new Set(sorted.map(p => p.brand).filter(Boolean))].slice(0, 18);
  const body = `<main>
    <section class="hero">
      <div class="container">
        <nav class="breadcrumb"><a href="../index.html">Início</a><span>/</span><span>${escapeHtml(config.label)}</span></nav>
        <h1>${escapeHtml(config.label)} ao melhor preço</h1>
        <p class="lead">${escapeHtml(config.intro)} Nesta página encontras produtos com comparação entre várias lojas, ordenados para ajudar a encontrar oportunidades reais.</p>
      </div>
    </section>
    <section class="section">
      <div class="container">
        <div class="facts">
          <div class="fact"><span>Produtos comparaveis</span><strong>${sorted.length}</strong></div>
          <div class="fact"><span>Marcas</span><strong>${brands.length}+</strong></div>
          <div class="fact"><span>Atualizacao</span><strong>${TODAY}</strong></div>
        </div>
        <div class="text-block">
          <h2>Comparar ${escapeHtml(config.label.toLowerCase())}</h2>
          <p>O PadelCost junta preços de lojas parceiras para ajudar a perceber onde cada artigo está mais barato. Usa esta página como ponto de partida e confirma sempre preço, stock e portes na loja antes de comprar.</p>
          ${brands.length ? `<p class="meta">Marcas nesta categoria: ${escapeHtml(brands.join(', '))}.</p>` : ''}
        </div>
        <div class="grid" style="margin-top:1.2rem">
          ${sorted.map(productCard).join('\n')}
        </div>
      </div>
    </section>
  </main>`;
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Início', item: SITE_URL + '/' },
      { '@type': 'ListItem', position: 2, name: config.label, item: SITE_URL + canonicalPath }
    ]
  };
  return layout({
    title: config.title,
    description: config.description,
    canonicalPath,
    extraHead: jsonLd(breadcrumbLd),
    body,
    pageContext: 'category',
    activeCategory: category
  });
}

function renderProductPage(product) {
  const title = productTitle(product);
  const canonicalPath = getProductUrl(product);
  const category = CATEGORY_CONFIG[product.category];
  const prices = (product.stores || []).map(store => asNumber(store.price)).filter(price => price !== null);
  const lowPrice = prices.length ? Math.min(...prices) : asNumber(product.price);
  const highPrice = prices.length ? Math.max(...prices) : asNumber(product.price);
  const specs = product.specs || {};
  const usefulSpecs = Object.entries(specs).filter(([, value]) => value).slice(0, 8);
  const sortedStores = (product.stores || []).slice().sort((a, b) => (a.price || 0) - (b.price || 0));
  const productCopy = getProductFeedDescription(product);
  const brandLogo = getBrandLogo(product);
  const descriptionText = buildFallbackProductDescription(product, lowPrice, (product.stores || []).length);
  const summaryText = buildProductSummary(product);
  const bestStore = sortedStores[0] || null;
  const bestStoreLogo = bestStore ? getStoreLogo(bestStore) : null;
  const productFavoriteIds = [product.id, ...(product.variantIds || [])].filter(Boolean);
  const productShareUrl = SITE_URL + canonicalPath;
  const body = `<main>
    <section class="hero">
      <div class="container">
        <nav class="breadcrumb"><a href="../index.html">Início</a><span>/</span><a href="${getHomeCategoryHref(product.category, 'product')}">${escapeHtml(category.label)}</a><span>/</span><span>${escapeHtml(title)}</span></nav>
      </div>
    </section>
    <section class="section">
      <div class="container product-layout">
        <div class="product-overview">
          <div class="product-media">
            <div class="product-image">${product.image ? `<img src="${escapeAttr(product.image)}" alt="${escapeAttr(title)}">` : ''}</div>
            ${brandLogo ? `<div class="brand-logo"><img src="${escapeAttr(brandLogo)}" alt="${escapeAttr(product.brand || 'Marca')}"></div>` : ''}
          </div>
          <div class="product-info">
            <div class="product-info-head">
              ${product.brand ? `<div class="product-brand">${escapeHtml(product.brand)}</div>` : ''}
              <h1>${escapeHtml(title)}</h1>
              <p class="product-summary">${escapeHtml(summaryText)}</p>
              ${usefulSpecs.length ? `<div class="facts">${usefulSpecs.map(([key, value]) => `<div class="fact"><span class="spec-icon"><i class="fas ${escapeAttr(getSpecIconClass(key))}"></i></span><div><span>${escapeHtml(formatSpecLabel(key))}</span><strong>${escapeHtml(value)}</strong></div></div>`).join('')}</div>` : ''}
              <div class="product-description">
                <h2>Descrição do produto</h2>
                <p>${escapeHtml(descriptionText)}</p>
              </div>
              ${bestStore ? `<div class="top-offer">
                <div class="store-logo">${bestStoreLogo ? `<img src="${escapeAttr(bestStoreLogo)}" alt="${escapeAttr(bestStore.name || 'Loja parceira')}">` : `<span class="store-logo-fallback">${escapeHtml(getStoreInitials(bestStore.name))}</span>`}</div>
                <div class="top-offer-price"><strong>${escapeHtml(formatPrice(bestStore.price))}</strong><span class="best-badge">Melhor preço</span></div>
                <a class="button" href="${escapeAttr(bestStore.url || '#')}" target="_blank" rel="sponsored noopener">Ver loja <i class="fas fa-chevron-right"></i></a>
              </div>` : ''}
              <div class="product-actions">
                <button class="save-product-btn" type="button" data-product-save aria-label="Guardar produto"><i class="far fa-heart" data-save-icon></i><span data-save-label>Guardar produto</span></button>
                <button class="share-product-link" type="button" data-product-share><i class="fas fa-share-alt"></i><span>Partilhar</span></button>
              </div>
            </div>
          </div>
        </div>
        <div>
          <h2 class="price-heading">Compara preços em ${(product.stores || []).length} lojas</h2>
          <div class="stores">
            ${sortedStores.map((store, idx) => {
              const logo = getStoreLogo(store);
              const isBest = idx === 0;
              return `<div class="store${isBest ? ' store-best' : ''}">
              <div class="store-logo">${logo ? `<img src="${escapeAttr(logo)}" alt="${escapeAttr(store.name || 'Loja parceira')}">` : `<span class="store-logo-fallback">${escapeHtml(getStoreInitials(store.name))}</span>`}</div>
              <div><strong>${escapeHtml(store.name || 'Loja parceira')}</strong><span class="store-stock">${escapeHtml(store.stock || 'Ver disponibilidade na loja')}</span></div>
              <div class="store-price-wrap"><span class="store-price">${escapeHtml(formatPrice(store.price))}</span>${isBest ? '<span class="best-badge">Melhor preço</span>' : ''}</div>
              <a class="button" href="${escapeAttr(store.url || '#')}" target="_blank" rel="sponsored noopener">Ver loja</a>
            </div>`;
            }).join('\n')}
          </div>
        </div>
      </div>
    </section>
  </main>
  <script>
    (() => {
      const storageKey = 'padelcost-favorites';
      const productId = ${jsonScriptValue(product.id)};
      const productIds = ${jsonScriptValue(productFavoriteIds)};
      const shareUrl = ${jsonScriptValue(productShareUrl)};
      const shareTitle = ${jsonScriptValue(title)};
      const saveButton = document.querySelector('[data-product-save]');
      const saveIcon = document.querySelector('[data-save-icon]');
      const saveLabel = document.querySelector('[data-save-label]');
      const shareButton = document.querySelector('[data-product-share]');
      const headerCount = document.querySelector('.favorites-trigger-count');

      const readFavorites = () => {
        try {
          const parsed = JSON.parse(window.localStorage.getItem(storageKey) || '[]');
          return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
          return [];
        }
      };

      const writeFavorites = (ids) => {
        window.localStorage.setItem(storageKey, JSON.stringify(ids));
      };

      const isSaved = (ids) => productIds.some((id) => ids.includes(id));

      const renderFavorites = () => {
        const ids = readFavorites();
        const saved = isSaved(ids);
        if (saveButton) saveButton.classList.toggle('active', saved);
        if (saveIcon) saveIcon.className = saved ? 'fas fa-heart' : 'far fa-heart';
        if (saveLabel) saveLabel.textContent = saved ? 'Guardado' : 'Guardar produto';
        if (headerCount) headerCount.textContent = String(ids.length);
      };

      saveButton?.addEventListener('click', () => {
        const ids = readFavorites();
        const saved = isSaved(ids);
        const next = saved
          ? ids.filter((id) => !productIds.includes(id))
          : [productId, ...ids.filter((id) => !productIds.includes(id))];
        writeFavorites(next);
        renderFavorites();
      });

      shareButton?.addEventListener('click', async () => {
        const shareData = { title: shareTitle, text: "Vê este produto no PadelCost: " + shareTitle, url: shareUrl };
        try {
          if (navigator.share) {
            await navigator.share(shareData);
            return;
          }
          await navigator.clipboard.writeText(shareUrl);
          window.alert('Link copiado para partilhar.');
        } catch (error) {
          if (error?.name !== 'AbortError') {
            try {
              await navigator.clipboard.writeText(shareUrl);
              window.alert('Link copiado para partilhar.');
            } catch (copyError) {
              window.prompt('Copia este link:', shareUrl);
            }
          }
        }
      });

      renderFavorites();
    })();
  </script>`;

  const productLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: title,
    image: product.image ? [product.image] : undefined,
    brand: product.brand ? { '@type': 'Brand', name: product.brand } : undefined,
    category: category.label,
    sku: product.mpn || product.productGTIN || String(product.id),
    gtin: product.productGTIN || product.ean || undefined,
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'EUR',
      lowPrice: lowPrice ?? undefined,
      highPrice: highPrice ?? undefined,
      offerCount: (product.stores || []).length,
      offers: (product.stores || []).map(store => ({
        '@type': 'Offer',
        priceCurrency: 'EUR',
        price: asNumber(store.price) ?? undefined,
        availability: stockToAvailability(store.stock),
        seller: { '@type': 'Organization', name: store.name || 'Loja parceira' },
        url: store.url || `${SITE_URL}${canonicalPath}`
      }))
    }
  };
  Object.keys(productLd).forEach(key => productLd[key] === undefined && delete productLd[key]);

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Início', item: SITE_URL + '/' },
      { '@type': 'ListItem', position: 2, name: category.label, item: SITE_URL + getCategoryUrl(product.category) },
      { '@type': 'ListItem', position: 3, name: title, item: SITE_URL + canonicalPath }
    ]
  };

  return layout({
    title: productMetaTitle(product),
    description: productDescription(product),
    canonicalPath,
    extraHead: `${jsonLd(productLd)}\n  ${jsonLd(breadcrumbLd)}`,
    body,
    pageContext: 'product',
    activeCategory: product.category,
    showCategoryNav: false
  });
}

function ensureCleanDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

function writeSitemap(paths) {
  const urls = paths.map(urlPath => `  <url>\n    <loc>${SITE_URL}${urlPath}</loc>\n    <lastmod>${TODAY}</lastmod>\n  </url>`).join('\n');
  fs.writeFileSync(SITEMAP_FILE, `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
}

function writeSeoData(products) {
  const productUrls = {};
  for (const product of products) {
    productUrls[String(product.id)] = getProductHref(product, 'root');
  }
  const payload = {
    generatedAt: new Date().toISOString(),
    productCount: products.length,
    productUrls
  };
  fs.writeFileSync(SEO_DATA_FILE, `// PadelCost - mapa de paginas SEO gerado automaticamente\nwindow.PADELCOST_SEO_PAGES = ${JSON.stringify(payload, null, 2)};\nwindow.PADELCOST_SEO_PRODUCT_URLS = window.PADELCOST_SEO_PAGES.productUrls;\n`);
}

function main() {
  const { products } = readProducts();
  const usedSlugs = new Map();
  const rawCandidates = products
    .filter(product => CATEGORY_CONFIG[product.category])
    .filter(product => Array.isArray(product.stores) && product.stores.length >= 2)
    .filter(product => product.name && product.price && product.image);

  const uniqueProducts = new Map();
  for (const product of rawCandidates) {
    const key = [product.category, product.brand || '', slugify(product.name)].join('|');
    const current = uniqueProducts.get(key);
    if (!current) {
      uniqueProducts.set(key, product);
      continue;
    }
    const currentStores = Array.isArray(current.stores) ? current.stores.length : 0;
    const productStores = Array.isArray(product.stores) ? product.stores.length : 0;
    if (productStores > currentStores || (productStores === currentStores && Number(product.price) < Number(current.price))) {
      uniqueProducts.set(key, product);
    }
  }

  const candidates = [...uniqueProducts.values()];

  for (const product of candidates) {
    const base = slugify(product.name);
    const count = usedSlugs.get(base) || 0;
    usedSlugs.set(base, count + 1);
    product.seoSlug = count ? `${base}-${count + 1}` : base;
  }

  ensureCleanDir(PRODUCT_DIR);
  ensureCleanDir(CATEGORY_DIR);

  const categoryPaths = [];
  for (const category of Object.keys(CATEGORY_CONFIG)) {
    const categoryProducts = candidates.filter(product => product.category === category);
    const categoryPath = getCategoryUrl(category);
    categoryPaths.push(categoryPath);
    fs.writeFileSync(path.join(CATEGORY_DIR, `${CATEGORY_CONFIG[category].slug}.html`), renderCategoryPage(category, categoryProducts));
  }

  const productPaths = [];
  for (const product of candidates) {
    const productPath = getProductUrl(product);
    productPaths.push(productPath);
    fs.writeFileSync(path.join(PRODUCT_DIR, `${product.seoSlug}.html`), renderProductPage(product));
  }

  writeSeoData(candidates);
  writeSitemap([...STATIC_URLS, ...categoryPaths, ...productPaths]);

  console.log(`Mapa SEO atualizado: ${path.relative(ROOT, SEO_DATA_FILE)}`);
  console.log(`Paginas de categoria geradas: ${categoryPaths.length}`);
  console.log(`Paginas de produto geradas: ${productPaths.length}`);
  console.log(`Sitemap atualizado: ${STATIC_URLS.length + categoryPaths.length + productPaths.length} URLs`);
}

main();
