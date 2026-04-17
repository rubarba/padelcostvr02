function normalizeSpaces(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeProductName(name, category = '') {
  let normalized = normalizeSpaces(name);
  if (!normalized) return '';

  normalized = normalized
    .replace(/\bpádel\b/gi, 'padel')
    .replace(/\bpalas?\s+(?:de\s+)?padel\b/gi, 'raquete de padel')
    .replace(/\bpala\s+por\s+padel\b/gi, 'raquete de padel')
    .replace(/\bpala\s+padel\b/gi, 'raquete de padel')
    .replace(/\bpala\s+de\s+padel\b/gi, 'raquete de padel')
    .replace(/\bpala\b/gi, category === 'raquetes' ? 'raquete' : 'pala')
    .replace(/\bpalas\b/gi, category === 'raquetes' ? 'raquetes' : 'palas')
    .replace(/\bzapatillas?\s+de\s+padel\b/gi, 'sapatilhas de padel')
    .replace(/\bzapatillas?\b/gi, category === 'sapatilhas' ? 'sapatilhas' : 'zapatillas')
    .replace(/\btenis\s+de\s+padel\b/gi, 'sapatilhas de padel')
    .replace(/\bténis\s+de\s+padel\b/gi, 'sapatilhas de padel')
    .replace(/\braquetero\s+padel\b/gi, 'saco de padel')
    .replace(/\braquetero\b/gi, category === 'sacos' ? 'saco' : 'raquetero')
    .replace(/\bpaletero\s+de\s+padel\b/gi, 'saco de padel')
    .replace(/\bpaletero\b/gi, category === 'sacos' ? 'saco' : 'paletero')
    .replace(/\bniño\b/gi, 'infantil')
    .replace(/\badulto\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  return normalized ? `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}` : '';
}

module.exports = { normalizeProductName };
