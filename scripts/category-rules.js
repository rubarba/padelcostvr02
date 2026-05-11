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

function hasWord(text, word) {
  return text.split(' ').includes(word);
}

function isCategoryIntruder(product, category = product?.category) {
  const text = buildProductText(product);
  const nameText = normalizeRuleText(product?.name);

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
        'cordao',
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
        'polo',
        'camiseta',
        'camisa',
        't shirt',
        'vestido',
        'saia',
        'sudadera',
        'calcetin',
        'calcetines',
        'pantalon',
        'pantalones',
        'sack protour',
        'sck protour',
      ]) ||
      nameText.includes(' grip ') ||
      nameText.startsWith('grip ') ||
      nameText.includes('hesacore') ||
      nameText.includes('antivibr') ||
      nameText.includes('protector') ||
      nameText.includes('protetor') ||
      nameText.includes('protection') ||
      nameText.includes('aderencia') ||
      nameText.includes('adhesive') ||
      nameText.includes('tambor') ||
      nameText.includes('chaveiro') ||
      nameText.includes('porta chaves') ||
      nameText.includes('keyring') ||
      nameText.includes('keychain') ||
      nameText.includes('funda') ||
      nameText.includes('racket cover') ||
      nameText.includes('cover racket') ||
      nameText.includes('cover de raquete') ||
      nameText.includes('lanyard') ||
      hasWord(text, 'falda')
    ) {
      return true;
    }

    if (text.includes('fronton')) return true;
    if (text.includes('badminton') || text.includes('praia') || text.includes('beach') || text.includes('frescobol')) return true;
    if (text.includes('cuero') && !text.includes('padel')) return true;
    if (
      (nameText.includes('tenis') || nameText.includes('tennis')) &&
      !nameText.includes('padel') &&
      (nameText.includes('raqueta') || nameText.includes('raquete') || nameText.includes('racket') || nameText.includes('pala'))
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
      ]) ||
      hasWord(text, 'falda')
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
      ]) ||
      hasWord(text, 'falda')
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
