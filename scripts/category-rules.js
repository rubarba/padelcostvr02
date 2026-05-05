const CORE_CATEGORIES = new Set(['raquetes', 'sapatilhas', 'sacos']);

function normalizeRuleText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildProductText(product) {
  return normalizeRuleText([
    product?.name,
    product?.brand,
    product?.sourceCategory,
    product?.description,
  ].filter(Boolean).join(' | '));
}

function hasAny(text, terms) {
  return terms.some(term => text.includes(term));
}

function isCategoryIntruder(product, category = product?.category) {
  const text = buildProductText(product);

  if (category === 'raquetes') {
    if (
      hasAny(text, [
        'pack de',
        'pacote',
        'monedero',
        'neceser',
        'wallet',
        'toiletry',
        'overgrip',
        'overgrips',
        'punho',
        'punhos',
        'balanceador',
        'peso personalizado',
        'optiweight',
        'spray',
        'totalseco',
        'pendente',
        'joyas',
        'colar',
        'joia',
        'jewelry',
        'bola',
        'bolas',
        'pote de bolas',
        'tubo de bola',
        'tubo selecionador',
        'manga ',
        'mangas ',
        'cotoveleira',
        'joelheira',
        'calca',
        'calcas',
        'chaleco',
        'anorack',
        'anorak',
        'malla',
        'mallas',
        'legging',
        'leggings',
        'soft shell',
        'softshell',
        'funda',
        'polo',
        'camiseta',
        'camisa',
        't shirt',
        'vestido',
        'saia',
        'falda',
        'sudadera',
        'calcetin',
        'calcetines',
        'pantalon',
        'pantalones',
        'sack protour',
        'sck protour',
      ]) ||
      text.includes(' grip ') ||
      text.startsWith('grip ') ||
      text.includes('hesacore') ||
      text.includes('antivibr') ||
      text.includes('protector') ||
      text.includes('protetor') ||
      text.includes('protection') ||
      text.includes('aderencia') ||
      text.includes('adhesive') ||
      text.includes('tambor') ||
      text.includes('chaveiro') ||
      text.includes('porta chaves') ||
      text.includes('keyring') ||
      text.includes('keychain')
    ) {
      return true;
    }

    if (text.includes('fronton')) return true;
    if (text.includes('badminton') || text.includes('praia') || text.includes('beach') || text.includes('frescobol')) return true;
    if (text.includes('cuero') && !text.includes('padel')) return true;
    if (
      (text.includes('tenis') || text.includes('tennis')) &&
      !text.includes('padel') &&
      (text.includes('raqueta') || text.includes('raquete') || text.includes('racket') || text.includes('pala'))
    ) {
      return true;
    }
  }

  if (category === 'sapatilhas') {
    if (
      hasAny(text, [
        'ropa',
        'accesorios',
        'calcetin',
        'calcetines',
        'pelotas',
        'calca',
        'calcas',
        'calcoes',
        'shorts',
        'polo',
        'camiseta',
        'camisa',
        't shirt',
        'tee ',
        'vestido',
        'saia',
        'falda',
        'sudadera',
        'calcetin',
        'calcetines',
        'pantalon',
        'pantalones',
        'manga ',
        'mangas ',
        'cotoveleira',
        'joelheira',
        'meias',
        'sock',
        'socks',
        'overgrip',
        'grip ',
        'cheiro',
        'spray',
        'footgel',
        'bola',
        'bolas',
        'pote de bolas',
        'tubo de bola',
        'tubo selecionador',
        'raquete',
        'raqueta',
        'badminton',
        'pendente',
        'joyas',
        'colar',
        'saco ',
        'mochila',
        'paletero',
        'raquetero',
      ])
    ) {
      return true;
    }
  }


  if (category === 'sacos') {
    if (
      hasAny(text, [
        'pack de',
        'pacote',
        'monedero',
        'neceser',
        'wallet',
        'toiletry',
        'calcetin',
        'calcetines',
        'falda',
        'sudadera',
        'pantalon',
        'pantalones',
        'bundle',
        'conjunto raquete',
        'set raquete',
        'maquina de lanca bolas',
        'maquina de lancar bolas',
        'maquina lancabolas',
        'lanca bolas',
        'slinger',
        'carrinho dobravel',
        'carrinho de bolas',
        'cesta de bolas',
        'pote de bolas',
        'tubo de bolas',
        'tubos de bolas',
        'bolas de padel',
        'pelotas',
        'vestido',
        'calca',
        'calcas',
        'calcoes',
        'shorts',
        'polo',
        'camiseta',
        'camisa',
        't shirt',
        'saia',
        'manga ',
        'mangas ',
        'cotoveleira',
        'joelheira',
        'overgrip',
      ])
    ) {
      return true;
    }
  }

  return false;
}

function isCoreCatalogProduct(product) {
  return CORE_CATEGORIES.has(product?.category) && !isCategoryIntruder(product, product.category);
}

module.exports = { CORE_CATEGORIES, isCategoryIntruder, isCoreCatalogProduct };
