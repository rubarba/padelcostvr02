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
  },
  acessorios: {
    slug: 'acessorios-de-padel',
    label: 'Acessórios de padel',
    singular: 'acessório de padel',
    title: 'Acessórios de Padel ao Melhor Preço | PadelCost',
    description: 'Compara preços de acessórios de padel como bolas, overgrips, protetores e antivibradores em várias lojas parceiras.',
    intro: 'Compara bolas, overgrips, protetores e pequenos acessórios de padel para encontrares rapidamente a melhor oferta.'
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
    sacos: ['WHITE_SACOS_TRANSPARENT.png', 'COLOR_SACOS.png'],
    acessorios: ['MONO_BOLAS.png', 'COR_BOLAS.png']
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

function normalizeCatalogText(value) {
  return stripDiacritics(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getCatalogSearchText(product) {
  return normalizeCatalogText([
    product?.name,
    product?.brand,
    product?.sourceCategory,
    product?.description
  ].filter(Boolean).join(' | '));
}

function catalogHasWord(text, terms) {
  return terms.some(term => new RegExp('(^| )' + term + '( |$)').test(text));
}

function catalogHasPhrase(text, terms) {
  return terms.some(term => text.includes(term));
}

const ACCESSORY_WORD_HINTS = [
  'bola', 'bolas', 'pelota', 'pelotas', 'ball', 'balls',
  'overgrip', 'overgrips', 'grip', 'hesacore',
  'protetor', 'protector', 'antivibrador', 'antivibradores',
  'amortecedor', 'amortecedores', 'cordao', 'cordon', 'cordones',
  'pressurizador', 'tubo', 'pote', 'cubo', 'gaveta', 'cesta'
];

const ACCESSORY_PHRASE_HINTS = [
  'custom weight', 'contrapeso', 'contrapesos', 'peso de padel',
  'protection tape', 'antishock', 'wrist cord', 'pick up ball',
  'pickup ball', 'pascal box', 'dry grip', 'crystal grip', 'power grip', 'gel grip'
];

const ACCESSORY_EXCLUDE_WORDS = [
  'meia', 'meias', 'sock', 'socks', 'bone', 'gorra', 'viseira', 'visor',
  'toalha', 'toalla', 'garrafa', 'botella', 'wallet', 'carteira', 'necessaire',
  'bolsa', 'mochila', 'paletero', 'raquetero', 'sandalia', 'sandal',
  'sapatilha', 'sapatilhas', 'sapato', 'sapatos', 'zapatilla', 'zapatillas', 'shoe', 'shoes',
  'camiseta', 'camisa', 'polo', 'short', 'shorts', 'calca', 'calcas', 'pants', 'trousers',
  'jacket', 'chaqueta', 'hood', 'sweat', 'sudadera', 'moletom', 'vestido', 'saia', 'falda',
  'legging', 'malla', 'mallas', 'cotovelo', 'cotoveleira', 'joelheira', 'bandana',
  'pendente', 'joia', 'joya', 'colar', 'raquete', 'raqueta', 'racket', 'pala'
];

const ACCESSORY_EXCLUDE_PHRASES = [
  't shirt', 'saco para acessorios', 'pack cross', 'red de mini padel',
  'carro de bola', 'carrinho', 'bola de praia', 'pingente'
];

function isCleanAccessoryProduct(product) {
  if (!product || !['acessorios', 'bolas'].includes(product.category)) return false;
  const text = getCatalogSearchText(product);
  if (catalogHasWord(text, ACCESSORY_EXCLUDE_WORDS) || catalogHasPhrase(text, ACCESSORY_EXCLUDE_PHRASES)) return false;
  return catalogHasWord(text, ACCESSORY_WORD_HINTS) || catalogHasPhrase(text, ACCESSORY_PHRASE_HINTS);
}

function getAccessoryProductType(product) {
  const text = getCatalogSearchText(product);
  if (catalogHasWord(text, ['overgrip', 'overgrips', 'grip', 'hesacore']) || catalogHasPhrase(text, ['dry grip', 'crystal grip', 'power grip', 'gel grip'])) return 'Overgrips';
  if (catalogHasWord(text, ['protetor', 'protector']) || catalogHasPhrase(text, ['protection tape', 'antishock'])) return 'Protetores';
  if (catalogHasWord(text, ['antivibrador', 'antivibradores', 'amortecedor', 'amortecedores'])) return 'Antivibradores';
  if (catalogHasWord(text, ['cordao', 'cordon', 'cordones']) || catalogHasPhrase(text, ['wrist cord'])) return 'Cordões';
  if (catalogHasPhrase(text, ['custom weight', 'contrapeso', 'contrapesos', 'peso de padel'])) return 'Pesos';
  if (catalogHasWord(text, ['pressurizador', 'tubo', 'pote', 'cubo', 'gaveta', 'cesta']) || catalogHasPhrase(text, ['pascal box'])) return 'Bolas e tubos';
  if (catalogHasWord(text, ['bola', 'bolas', 'pelota', 'pelotas', 'ball', 'balls'])) return 'Bolas';
  return 'Acessórios';
}

function normalizeProductCategory(product) {
  if (!product) return product;
  if (isCleanAccessoryProduct(product)) {
    return {
      ...product,
      category: 'acessorios',
      specs: { ...(product.specs || {}), tipo: product.specs?.tipo || getAccessoryProductType(product) }
    };
  }
  return product;
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

  if (product.category === 'acessorios') {
    const type = specs.tipo ? String(specs.tipo).toLowerCase() : 'acessório de padel';
    return `${title} é um ${type} pensado para completar o teu equipamento de padel com mais conforto e praticidade.`;
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

  if (category === 'acessorios') {
    const type = specs.tipo ? String(specs.tipo).toLowerCase() : 'acessório de padel';
    const detail = color ? ` em ${String(color).toLowerCase()}` : '';
    return `${title} é um ${type}${brandText}${detail} pensado para complementar o equipamento de padel. É uma opção útil para quem procura pequenos detalhes que ajudam no conforto, na manutenção ou na preparação para jogar.`;
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
  if (from === 'product') return `./${product.seoSlug}.html`;
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
        <a class="category-btn ${activeCategory === 'acessorios' ? 'active' : ''}" href="${getHomeCategoryHref('acessorios', pageContext)}"><span class="category-icon">${getCategoryIconHtml('acessorios', pageContext)}</span><span>Acessórios</span></a>
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
    .category-icon-fa { width:71px; height:71px; border-radius:999px; display:inline-flex; align-items:center; justify-content:center; color:#8fa0b5; background:linear-gradient(180deg,#fff 0%,#eef3f7 100%); font-size:2rem; box-shadow:0 10px 22px rgba(15,28,42,.08); transition:color .22s ease, transform .22s ease, background .22s ease; }
    .category-btn:hover .category-icon-fa, .category-btn.active .category-icon-fa { color:#0b7ed0; transform:scale(1.03); background:#eef7ff; }
    .category-btn:hover .category-icon, .category-btn.active .category-icon { transform:translateY(-1px); }
    .category-btn:hover .category-icon-white, .category-btn.active .category-icon-white { opacity:0; }
    .category-btn:hover .category-icon-color, .category-btn.active .category-icon-color { opacity:1; transform:scale(1); }
    .category-help-link { display:inline-flex; align-items:center; gap:.5rem; color:#51627a; font-size:.95rem; font-weight:700; text-decoration:none; white-space:nowrap; flex-shrink:0; }
    .hero { padding: 1.55rem 0 1.05rem; background: white; border-bottom:1px solid var(--line); }
    .breadcrumb { display:flex; flex-wrap:wrap; gap:.4rem; color:var(--muted); font-size:.9rem; margin-bottom:.8rem; }
    .breadcrumb a { color:var(--blue); text-decoration:none; font-weight:800; }
    h1 { margin:.2rem 0 .8rem; font-size:1.28rem; font-weight:700; line-height:1.2; letter-spacing:0; }
    .lead { color:var(--muted); max-width:760px; font-size:1.08rem; margin:0; }
    .section { padding: 1.45rem 0 2rem; }
    .category-seo-summary { display:grid; grid-template-columns:minmax(0, 1fr) 420px; gap:1.4rem; align-items:start; margin-bottom:1.25rem; }
    .category-seo-summary h2 { margin:.05rem 0 .55rem; font-size:1.22rem; line-height:1.25; }
    .category-seo-summary p { margin:.45rem 0 0; }
    .category-seo-summary .meta { font-size:.86rem; }
    .catalog-layout { display:grid; grid-template-columns:260px minmax(0, 1fr); gap:1.2rem; align-items:start; }
    .filters-panel { position:sticky; top:140px; background:#fff; border-radius:16px; padding:1.2rem; box-shadow:0 10px 30px rgba(15,31,53,.08); max-height:calc(100vh - 160px); overflow-y:auto; margin-top:.95rem; }
    .filters-panel::-webkit-scrollbar { width:5px; }
    .filters-panel::-webkit-scrollbar-thumb { background:var(--line); border-radius:10px; }
    .filters-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:1.2rem; padding-bottom:1rem; border-bottom:2px solid var(--line); }
    .filters-title { display:inline-flex; align-items:center; gap:.45rem; font-size:.95rem; font-weight:800; color:var(--text); text-transform:uppercase; letter-spacing:.05em; }
    .filters-title i { font-size:.82rem; color:var(--muted); }
    .filters-clear { padding:.32rem .6rem; background:var(--soft); color:#51627a; border:0; border-radius:6px; font-size:.7rem; font-weight:800; cursor:pointer; font-family:inherit; }
    .filters-clear:hover { background:#fee2e2; color:#b91c1c; }
    .filter-section { margin-bottom:1.2rem; padding-bottom:1.2rem; border-bottom:1px solid var(--line); }
    .filter-section:last-child { border-bottom:0; margin-bottom:0; padding-bottom:0; }
    .filter-header { display:flex; justify-content:space-between; align-items:center; cursor:pointer; margin-bottom:.8rem; }
    .filter-label { font-size:.8rem; font-weight:800; color:var(--text); text-transform:uppercase; letter-spacing:.03em; }
    .filter-toggle { color:#8aa0bb; font-size:.8rem; transition:transform .2s; }
    .filter-section.collapsed .filter-toggle { transform:rotate(-90deg); }
    .filter-options { display:flex; flex-direction:column; gap:.4rem; }
    .filter-section.collapsed .filter-options { display:none !important; }
    .filter-option { display:flex; align-items:center; gap:.5rem; padding:.4rem .6rem; border-radius:6px; cursor:pointer; transition:background .2s, color .2s; font-size:.8rem; color:#51627a; }
    .filter-option:hover { background:var(--soft); }
    .filter-option input { position:absolute; opacity:0; pointer-events:none; }
    .filter-checkbox { width:14px; height:14px; border:2px solid var(--line); border-radius:3px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
    .filter-checkbox i { display:none; font-size:.58rem; color:#fff; }
    .filter-option:has(input:checked) { background:#eef7ff; color:var(--blue); font-weight:800; }
    .filter-option:has(input:checked) .filter-checkbox { background:var(--blue); border-color:var(--blue); }
    .filter-option:has(input:checked) .filter-checkbox i { display:block; }
    .filter-count { margin-left:auto; color:#8aa0bb; font-size:.74rem; font-weight:800; }
    .price-value { display:inline-block; padding:.3rem .6rem; background:#eef7ff; color:var(--blue); border-radius:6px; font-weight:800; font-size:.75rem; margin-bottom:.3rem; }
    .price-slider { width:100%; height:5px; border-radius:3px; background:var(--soft); outline:none; -webkit-appearance:none; margin:.55rem 0 .2rem; }
    .price-slider::-webkit-slider-thumb { -webkit-appearance:none; width:16px; height:16px; border-radius:50%; background:var(--blue); cursor:pointer; }
    .price-slider::-moz-range-thumb { width:16px; height:16px; border-radius:50%; background:var(--blue); cursor:pointer; border:0; }
    .products-area { min-width:0; }
    .products-toolbar { display:flex; align-items:center; justify-content:space-between; gap:.9rem; flex-wrap:wrap; margin-bottom:1rem; }
    .results-count { color:#8aa0bb; font-size:.86rem; font-weight:800; }
    .sort-select { padding:.5rem 1rem; border:1px solid var(--line); border-radius:30px; font-family:Manrope, Arial, sans-serif; font-size:.85rem; font-weight:700; color:var(--text); background:white; cursor:pointer; outline:0; min-width:210px; }
    .sort-select:hover { border-color:var(--blue); }
    .mobile-filters-btn { display:none; align-items:center; justify-content:center; gap:.5rem; min-height:42px; padding:.7rem 1rem; border:0; border-radius:999px; background:var(--blue); color:white; font-family:inherit; font-weight:900; cursor:pointer; box-shadow:0 8px 24px rgba(0,119,204,.28); }
    .filters-overlay { display:none; position:fixed; inset:0; background:rgba(0,0,0,.45); z-index:180; }
    .filters-empty { display:none; padding:1.4rem; border:1px dashed var(--line); border-radius:14px; background:rgba(255,255,255,.72); color:#51627a; font-weight:700; }
    .grid { display:grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap:1rem; align-items:stretch; }
    .card { background:white; border:0; border-radius:16px; padding:1rem; box-shadow:0 10px 30px rgba(15,31,53,.08); display:flex; flex-direction:column; min-height:100%; position:relative; overflow:hidden; transition:transform .25s ease, box-shadow .25s ease; }
    .card:hover { transform:translateY(-3px); box-shadow:0 16px 40px rgba(15,31,53,.14); }
    .card-main-link { color:inherit; text-decoration:none; display:flex; flex-direction:column; flex:1; min-width:0; }
    .favorite-static { position:absolute; top:1.12rem; left:1.12rem; z-index:2; width:32px; height:32px; border:0; background:transparent; color:#7d8896; display:inline-flex; align-items:center; justify-content:center; font-size:1.18rem; pointer-events:none; }
    .card-image { width:100%; height:208px; background:white; border:1px solid var(--line); border-radius:10px; padding:.5rem; display:flex; align-items:center; justify-content:center; margin-bottom:.9rem; overflow:hidden; }
    .card-image img { width:100%; height:100%; object-fit:contain; transform:scale(1.08); transition:transform .25s ease; }
    .card:hover .card-image img { transform:scale(1.13); }
    .card-info { display:flex; flex-direction:column; flex:1; min-width:0; }
    .eyebrow { text-transform:uppercase; letter-spacing:.05em; font-weight:900; font-size:.75rem; color:#8aa0bb; }
    .card h2, .card h3 { font-size:1.02rem; line-height:1.25; margin:.25rem 0 .85rem; min-height:3.9em; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden; }
    .price { font-size:1.4rem; font-weight:900; margin-top:auto; }
    .card-price { display:flex; align-items:baseline; gap:.55rem; margin-top:auto; padding-top:.25rem; }
    .current-price { font-size:1.35rem; font-weight:900; color:var(--text); line-height:1; white-space:nowrap; }
    .meta { color:var(--muted); font-size:.92rem; }
    .card-actions { display:flex; flex-direction:column-reverse; gap:.55rem; margin-top:.9rem; }
    .btn-small { display:inline-flex; align-items:center; justify-content:center; gap:.45rem; min-height:42px; padding:.62rem .85rem; border-radius:999px; font-size:.86rem; font-weight:900; text-decoration:none; border:0; transition:transform .2s ease, background .2s ease, color .2s ease; }
    .btn-small:hover { transform:translateY(-1px); }
    .btn-buy { width:100%; background:#087ed0; color:white; }
    .btn-buy:hover { background:#006fbd; }
    .btn-compare { min-height:34px; border-radius:0; border-top:1px solid var(--line); color:#66758a; background:transparent; padding:.58rem 0 0; }
    .btn-compare:hover { color:var(--blue); transform:none; }
    .category-stats { display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:.65rem; }
    .category-stat { background:rgba(255,255,255,.72); border:1px solid rgba(223,231,241,.95); border-radius:10px; padding:.85rem 1rem; box-shadow:0 8px 24px rgba(15,31,53,.05); }
    .category-stat span { display:block; color:#8aa0bb; font-size:.72rem; text-transform:uppercase; letter-spacing:.05em; font-weight:900; line-height:1.15; margin-bottom:.18rem; }
    .category-stat strong { display:block; color:var(--text); font-size:1.1rem; font-weight:900; line-height:1.1; }
    .related-section { margin-top:1.4rem; }
    .related-head { display:flex; align-items:end; justify-content:space-between; gap:1rem; margin-bottom:.75rem; }
    .related-head h2 { margin:0; font-size:1.08rem; }
    .related-head a { color:var(--blue); font-weight:900; text-decoration:none; font-size:.9rem; white-space:nowrap; }
    .related-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(230px, 1fr)); gap:1rem; }
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
    @media (min-width: 761px) and (max-width: 1040px) { .header { padding:.82rem 0; } .header-top { display:grid; grid-template-columns:auto minmax(0,1fr) auto; gap:.85rem 1rem; } .brand svg { height:46px !important; } .header-tagline { padding-left:1rem; margin-left:0; } .header-tagline p { font-size:.72rem; line-height:1.35; } .header-tagline p:last-child { display:none; } .search-wrapper { grid-column:1 / -1; width:100%; max-width:none; } .category-btn { padding:.78rem 1rem; font-size:.88rem; } }
    @media (max-width: 760px) {
      .container { width:min(100% - 24px, 1120px); }
      .header { padding:.54rem 0 .58rem; }
      .header-top { flex-direction:column; align-items:stretch; gap:.5rem; padding:0; position:relative; }
      .brand { align-self:center; max-width:210px; }
      .brand svg { height:42px !important; max-width:210px; }
      .header-tagline { border-left:0; padding-left:0; margin-left:0; text-align:center; }
      .header-tagline p { font-size:.64rem; line-height:1.22; }
      .header-tagline p:last-child { display:none; }
      .search-wrapper { width:100%; max-width:100%; margin:0 auto; }
      .search-input { padding:.78rem 1rem .78rem 2.35rem; font-size:.88rem; }
      .search-icon { left:.95rem; }
      .header-actions { position:absolute; top:.16rem; right:0; }
      .favorites-trigger { gap:.35rem; }
      .favorites-trigger span:not(.favorites-trigger-count) { display:none; }
      .favorites-trigger-count { min-width:21px; height:21px; font-size:.72rem; }
      .categories-inner { align-items:stretch; }
      .category-help-link { display:none; }
      .category-btn { padding:.5rem .85rem; font-size:.86rem; }
      .category-icon { width:48px; height:48px; }
      .category-icon-stack { width:48px; height:48px; }
      .hero { padding:1.05rem 0 .82rem; }
      .breadcrumb { font-size:.82rem; line-height:1.35; margin-bottom:.55rem; }
      h1 { font-size:1.08rem; line-height:1.28; margin:.15rem 0 0; }
      .section { padding:1rem 0 1.25rem; }
      .category-seo-summary { grid-template-columns:1fr; gap:.75rem; margin-bottom:1rem; }
      .category-seo-summary h2 { font-size:1.05rem; margin:0 0 .4rem; }
      .category-seo-summary p { font-size:.88rem; line-height:1.5; }
      .catalog-layout { display:block; }
      .mobile-filters-btn { display:inline-flex; }
      .filters-overlay.active { display:block; }
      .filters-panel { position:fixed; top:0; left:0; bottom:0; width:min(84vw, 320px); z-index:190; border-radius:0 16px 16px 0; margin:0; max-height:none; transform:translateX(-105%); transition:transform .25s ease; }
      .filters-panel.open { transform:translateX(0); }
      .products-toolbar { margin-bottom:.8rem; }
      .sort-select { min-width:0; flex:1; }
      .category-stats { grid-template-columns:repeat(3, minmax(0, 1fr)); gap:.45rem; }
      .category-stat { padding:.72rem .85rem; }
      .category-stat span { font-size:.56rem; }
      .category-stat strong { font-size:.82rem; }
      .grid { grid-template-columns:1fr; gap:.8rem; }
      .card { border-radius:14px; padding:.82rem; }
      .card-image { height:190px; margin-bottom:.75rem; }
      .card h2, .card h3 { font-size:.95rem; min-height:auto; margin:.2rem 0 .75rem; }
      .current-price { font-size:1.2rem; }
      .btn-small { min-height:38px; font-size:.82rem; }
      .product-overview { grid-template-columns:1fr; padding:.82rem; gap:1rem; border-radius:12px; }
      .product-info-head { display:block; }
      .product-image { min-height:0; aspect-ratio:1/1; padding:.65rem; }
      .product-image img { max-height:300px; }
      .brand-logo { min-height:58px; justify-content:flex-start; padding:.35rem .15rem; }
      .brand-logo img { max-width:132px; max-height:58px; }
      .product-brand { font-size:.76rem; }
      .product-summary { font-size:.9rem; line-height:1.5; }
      .facts { grid-template-columns:repeat(2, minmax(0, 1fr)); gap:.42rem .55rem; margin:.65rem 0 .8rem; }
      .fact { grid-template-columns:26px 1fr; gap:.38rem; min-width:0; }
      .spec-icon { width:26px; height:26px; border-radius:8px; font-size:.72rem; }
      .fact span:not(.spec-icon) { font-size:.58rem; line-height:1.05; }
      .fact strong { font-size:.72rem; line-height:1.15; overflow-wrap:anywhere; }
      .top-offer { grid-template-columns:76px 1fr auto; gap:.58rem; padding:.65rem; margin-top:.85rem; align-items:center; }
      .top-offer .store-logo { width:76px; max-width:100%; height:42px; border-radius:7px; }
      .top-offer-price { gap:.18rem; }
      .top-offer-price strong { font-size:1.18rem; }
      .top-offer .best-badge { font-size:.58rem; min-height:20px; padding:.18rem .42rem; border-radius:6px; }
      .top-offer .button { width:auto; min-height:38px; min-width:92px; padding:.55rem .75rem; font-size:.82rem; }
      .product-description { margin-top:1rem; }
      .product-actions { gap:.65rem; margin-top:.85rem; }
      .price-heading { margin:1rem 0 .35rem; font-size:1.02rem; }
      .related-section { margin-top:1.15rem; }
      .related-head { align-items:flex-start; margin-bottom:.65rem; }
      .related-head h2 { font-size:1rem; }
      .related-head a { font-size:.8rem; }
      .related-grid { grid-template-columns:1fr; gap:.55rem; }
      .stores { gap:.55rem; margin-top:.8rem; }
      .store { grid-template-columns:72px 1fr; gap:.55rem .65rem; padding:.62rem; border-radius:10px; align-items:center; }
      .store-logo { width:72px; max-width:100%; height:42px; border-radius:7px; padding:.25rem; grid-row:1 / span 2; }
      .store strong { font-size:.86rem; line-height:1.15; }
      .store-stock { font-size:.74rem; line-height:1.15; }
      .store-stock::before { width:12px; height:12px; font-size:.52rem; }
      .store-price-wrap { justify-content:flex-start; flex-wrap:wrap; gap:.4rem; }
      .store-price { font-size:1.05rem; }
      .store .best-badge { font-size:.56rem; min-height:20px; padding:.17rem .4rem; border-radius:6px; }
      .store .button { grid-column:2; width:100%; min-height:36px; padding:.5rem .8rem; font-size:.82rem; }
    }
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
  <script>
    (() => {
      const page = document.querySelector('[data-seo-category-page]');
      if (!page) return;

      const grid = page.querySelector('[data-products-grid]');
      const cards = Array.from(page.querySelectorAll('.card'));
      const filters = Array.from(page.querySelectorAll('.seo-filter'));
      const priceFilter = page.querySelector('[data-price-filter]');
      const priceValue = page.querySelector('[data-price-value]');
      const sortSelect = page.querySelector('[data-sort-select]');
      const countEl = page.querySelector('[data-results-count]');
      const emptyEl = page.querySelector('[data-empty-state]');
      const filtersPanel = page.querySelector('[data-filters-panel]');
      const overlay = page.querySelector('[data-filters-overlay]');

      const selectedValues = (type) => filters
        .filter(input => input.dataset.filter === type && input.checked)
        .map(input => input.value);

      const hasAny = (haystack, selected) => selected.length === 0 || selected.some(value => haystack.includes(value));

      function cardMatches(card) {
        const price = Number(card.dataset.price || 0);
        if (priceFilter && price > Number(priceFilter.value || 0)) return false;

        const brands = selectedValues('brand');
        if (brands.length && !brands.includes(card.dataset.brand || '')) return false;

        const stores = selectedValues('store');
        if (!hasAny((card.dataset.stores || '').split('||').filter(Boolean), stores)) return false;

        for (const type of ['forma', 'nivel', 'genero', 'tipo']) {
          const selected = selectedValues(type);
          if (selected.length && !selected.includes(card.dataset[type] || '')) return false;
        }

        return true;
      }

      function sortCards(visibleCards) {
        const sorted = visibleCards.slice();
        const mode = sortSelect?.value || 'relevancia';
        if (mode === 'preco-asc') sorted.sort((a, b) => Number(a.dataset.price) - Number(b.dataset.price));
        if (mode === 'preco-desc') sorted.sort((a, b) => Number(b.dataset.price) - Number(a.dataset.price));
        if (mode === 'lojas-desc') sorted.sort((a, b) => Number(b.dataset.storeCount) - Number(a.dataset.storeCount));
        if (mode === 'relevancia') sorted.sort((a, b) => Number(a.dataset.index) - Number(b.dataset.index));
        sorted.forEach(card => grid.appendChild(card));
      }

      function applyFilters() {
        if (priceFilter && priceValue) priceValue.textContent = '€' + priceFilter.value;
        const visibleCards = cards.filter(card => {
          const visible = cardMatches(card);
          card.style.display = visible ? '' : 'none';
          return visible;
        });
        sortCards(visibleCards);
        if (countEl) countEl.textContent = visibleCards.length + (visibleCards.length === 1 ? ' produto' : ' produtos');
        if (emptyEl) emptyEl.style.display = visibleCards.length ? 'none' : 'block';
      }

      filters.forEach(input => input.addEventListener('change', applyFilters));
      priceFilter?.addEventListener('input', applyFilters);
      sortSelect?.addEventListener('change', applyFilters);
      page.querySelector('[data-clear-filters]')?.addEventListener('click', () => {
        filters.forEach(input => { input.checked = false; });
        if (priceFilter) priceFilter.value = priceFilter.max;
        applyFilters();
      });
      page.querySelectorAll('[data-filter-toggle]').forEach(header => {
        header.addEventListener('click', () => header.closest('.filter-section')?.classList.toggle('collapsed'));
      });
      page.querySelector('[data-open-filters]')?.addEventListener('click', () => {
        filtersPanel?.classList.add('open');
        overlay?.classList.add('active');
      });
      overlay?.addEventListener('click', () => {
        filtersPanel?.classList.remove('open');
        overlay.classList.remove('active');
      });
      applyFilters();
    })();
  </script>
</body>
</html>
`;
}

function getSearchHref(product, from = 'root') {
  return `${getRootHref(from)}?q=${encodeURIComponent(productTitle(product))}`;
}

function getDataValue(value) {
  return value == null ? '' : String(value).trim();
}

function productCard(product, from = 'category', index = 0) {
  const title = productTitle(product);
  const href = getProductHref(product, from);
  const storeCount = (product.stores || []).length;
  const stores = (product.stores || []).map(store => store.name).filter(Boolean).join('||');
  const specs = product.specs || {};
  return `<article class="card" data-index="${index}" data-price="${escapeAttr(asNumber(product.price) || 0)}" data-store-count="${escapeAttr(storeCount)}" data-brand="${escapeAttr(getDataValue(product.brand))}" data-stores="${escapeAttr(stores)}" data-forma="${escapeAttr(getDataValue(specs.forma))}" data-nivel="${escapeAttr(getDataValue(specs.nivel))}" data-genero="${escapeAttr(getDataValue(specs.genero))}" data-tipo="${escapeAttr(getDataValue(specs.tipo))}">
    <a class="card-main-link" href="${href}">
      <span class="favorite-static" aria-hidden="true"><i class="far fa-heart"></i></span>
      <div class="card-image">${product.image ? `<img src="${escapeAttr(product.image)}" alt="${escapeAttr(title)}" loading="lazy">` : ''}</div>
      <div class="card-info">
        <span class="eyebrow">${escapeHtml(product.brand || categoryLabel(product.category))}</span>
        <h2>${escapeHtml(title)}</h2>
        <div class="card-price"><span class="current-price">${escapeHtml(formatPrice(product.price))}</span></div>
      </div>
    </a>
    <div class="card-actions">
      <a class="btn-small btn-compare" href="${escapeAttr(getSearchHref(product, from))}"><i class="fas fa-balance-scale"></i> Comparar</a>
      <a class="btn-small btn-buy" href="${href}">Ver ${escapeHtml(storeCount)} lojas</a>
    </div>
  </article>`;
}

function relatedProductCard(product) {
  return productCard(product, 'product');
}

function countValues(products, getter) {
  const counts = new Map();
  products.forEach(product => {
    const raw = getter(product);
    const values = Array.isArray(raw) ? raw : [raw];
    values.filter(Boolean).forEach(value => counts.set(value, (counts.get(value) || 0) + 1));
  });
  return counts;
}

function renderFilterSection(label, type, counts, collapsed = false, limit = 14) {
  const entries = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]), 'pt'))
    .slice(0, limit);
  if (!entries.length) return '';
  return `<div class="filter-section ${collapsed ? 'collapsed' : ''}">
    <div class="filter-header" data-filter-toggle>
      <div class="filter-label">${escapeHtml(label)}</div>
      <i class="fas fa-chevron-down filter-toggle"></i>
    </div>
    <div class="filter-options">
      ${entries.map(([value, count]) => `<label class="filter-option">
        <input class="seo-filter" type="checkbox" data-filter="${escapeAttr(type)}" value="${escapeAttr(value)}">
        <span class="filter-checkbox"><i class="fas fa-check"></i></span>
        <span>${escapeHtml(value)}</span>
        <span class="filter-count">${count}</span>
      </label>`).join('')}
    </div>
  </div>`;
}

function renderCategoryFilters(category, products) {
  const maxPrice = Math.max(...products.map(product => asNumber(product.price) || 0), 0);
  const priceMax = Math.max(5, Math.ceil(maxPrice / 5) * 5);
  const brandCounts = countValues(products, product => product.brand);
  const storeCounts = countValues(products, product => (product.stores || []).map(store => store.name));
  const sections = [
    renderFilterSection('Marca', 'brand', brandCounts, false, 18)
  ];

  if (category === 'raquetes') {
    sections.push(renderFilterSection('Forma', 'forma', countValues(products, product => product.specs?.forma), false));
    sections.push(renderFilterSection('Nível', 'nivel', countValues(products, product => product.specs?.nivel), false));
  }
  if (category === 'sapatilhas') {
    sections.push(renderFilterSection('Género', 'genero', countValues(products, product => product.specs?.genero), false));
  }
  if (category === 'acessorios') {
    sections.push(renderFilterSection('Tipo', 'tipo', countValues(products, product => product.specs?.tipo), false));
  }

  sections.push(`<div class="filter-section">
    <div class="filter-header" data-filter-toggle>
      <div class="filter-label">Preço máx.</div>
      <i class="fas fa-chevron-down filter-toggle"></i>
    </div>
    <div class="filter-options" style="display:block">
      <span class="price-value" data-price-value>€${priceMax}</span>
      <input class="price-slider" data-price-filter type="range" min="0" max="${priceMax}" step="5" value="${priceMax}">
    </div>
  </div>`);
  sections.push(renderFilterSection('Lojas', 'store', storeCounts, false, 12));

  return `<div class="filters-overlay" data-filters-overlay></div>
  <aside class="filters-panel" data-filters-panel>
    <div class="filters-header">
      <div class="filters-title"><i class="fas fa-sliders-h"></i> Filtros</div>
      <button class="filters-clear" type="button" data-clear-filters>Limpar</button>
    </div>
    ${sections.filter(Boolean).join('\n')}
  </aside>`;
}

function getRelatedProducts(product, products, limit = 4) {
  const productPrice = asNumber(product.price) || 0;
  const score = (candidate) => {
    let value = 0;
    if (candidate.category === product.category) value += 120;
    if (candidate.brand && product.brand && candidate.brand === product.brand) value += 70;
    value += Math.min((candidate.stores || []).length, 6) * 18;
    if (productPrice > 0) {
      const diffRatio = Math.abs((asNumber(candidate.price) || 0) - productPrice) / productPrice;
      value += Math.max(0, 42 - diffRatio * 70);
    }
    return value;
  };

  return products
    .filter(candidate => candidate.id !== product.id && candidate.category === product.category)
    .sort((a, b) => score(b) - score(a) || (a.price || Infinity) - (b.price || Infinity))
    .slice(0, limit);
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
        <div class="category-seo-summary">
          <div class="text-block">
            <h2>Comparar ${escapeHtml(config.label.toLowerCase())}</h2>
            <p>O PadelCost junta preços de lojas parceiras para ajudar a perceber onde cada artigo está mais barato. Usa esta página como ponto de partida e confirma sempre preço, stock e portes na loja antes de comprar.</p>
            ${brands.length ? `<p class="meta">Marcas nesta categoria: ${escapeHtml(brands.join(', '))}.</p>` : ''}
          </div>
          <div class="category-stats">
            <div class="category-stat"><span>Produtos comparáveis</span><strong>${sorted.length}</strong></div>
            <div class="category-stat"><span>Marcas</span><strong>${brands.length}+</strong></div>
            <div class="category-stat"><span>Atualização</span><strong>${TODAY}</strong></div>
          </div>
        </div>
        <div class="catalog-layout" data-seo-category-page>
          ${renderCategoryFilters(category, sorted)}
          <div class="products-area">
            <div class="products-toolbar">
              <button class="mobile-filters-btn" type="button" data-open-filters><i class="fas fa-sliders-h"></i> Filtros</button>
              <span class="results-count" data-results-count>${sorted.length} produtos</span>
              <select class="sort-select" data-sort-select aria-label="Ordenar produtos">
                <option value="relevancia">Relevância</option>
                <option value="preco-asc">Preço: menor primeiro</option>
                <option value="preco-desc">Preço: maior primeiro</option>
                <option value="lojas-desc">Mais lojas primeiro</option>
              </select>
            </div>
            <div class="filters-empty" data-empty-state>Não encontrei produtos com esses filtros. Experimenta limpar um filtro ou aumentar o preço máximo.</div>
            <div class="grid" data-products-grid>
              ${sorted.map((product, index) => productCard(product, 'category', index)).join('\n')}
            </div>
          </div>
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

function renderProductPage(product, allProducts = []) {
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
  const relatedProducts = getRelatedProducts(product, allProducts, 4);
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
        ${relatedProducts.length ? `<div class="related-section">
          <div class="related-head">
            <h2>Alternativas semelhantes</h2>
            <a href="${getHomeCategoryHref(product.category, 'product')}">Ver ${escapeHtml(category.label.toLowerCase())}</a>
          </div>
          <div class="related-grid">
            ${relatedProducts.map(relatedProductCard).join('\n')}
          </div>
        </div>` : ''}
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
    description: descriptionText,
    url: `${SITE_URL}${canonicalPath}`,
    mainEntityOfPage: `${SITE_URL}${canonicalPath}`,
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
  const normalizedProducts = products.map(normalizeProductCategory);
  const rawCandidates = normalizedProducts
    .filter(product => CATEGORY_CONFIG[product.category])
    .filter(product => product.category !== 'acessorios' || isCleanAccessoryProduct(product))
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
    fs.writeFileSync(path.join(PRODUCT_DIR, `${product.seoSlug}.html`), renderProductPage(product, candidates));
  }

  writeSeoData(candidates);
  writeSitemap([...STATIC_URLS, ...categoryPaths, ...productPaths]);

  console.log(`Mapa SEO atualizado: ${path.relative(ROOT, SEO_DATA_FILE)}`);
  console.log(`Paginas de categoria geradas: ${categoryPaths.length}`);
  console.log(`Paginas de produto geradas: ${productPaths.length}`);
  console.log(`Sitemap atualizado: ${STATIC_URLS.length + categoryPaths.length + productPaths.length} URLs`);
}

main();
