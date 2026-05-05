function normalizeBrand(value) {
  const raw = String(value || '').replace(/\s+/g, ' ').trim();
  if (!raw) return '';

  const key = raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  const aliases = new Map([
    ['adidas padel', 'Adidas'],
    ['adidas t', 'Adidas'],
    ['bullpadel', 'Bullpadel'],
    ['bull padel', 'Bullpadel'],
    ['dropshot', 'Drop Shot'],
    ['drop shot', 'Drop Shot'],
    ['head padel', 'Head'],
    ['lok', 'LOK'],
    ['star vie', 'StarVie'],
    ['starvie', 'StarVie'],
    ['vibor a', 'Vibor-A'],
    ['vibora', 'Vibor-A'],
    ['wilson padel', 'Wilson'],
    ['asics padel', 'ASICS'],
    ['asics', 'ASICS'],
    ['k swiss', 'K-Swiss'],
    ['kswiss', 'K-Swiss'],
  ]);

  return aliases.get(key) || raw;
}

module.exports = { normalizeBrand };
