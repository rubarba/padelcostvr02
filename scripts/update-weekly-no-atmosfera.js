/**
 * PadelCost - Atualizacao semanal sem Atmosfera Sport
 * ---------------------------------------------------
 * Atualiza feeds das lojas que estao estaveis, refaz o merge, audita dados
 * e regenera paginas SEO. Nao corre generate-products.js porque esse script
 * substitui a base Atmosfera Sport e deve ficar fora da rotina ate ser revisto.
 */

const { spawnSync } = require('child_process');

const steps = [
  ['Zona de Padel', 'node', ['generate-zona-de-padel.js']],
  ['Adidas Padel', 'node', ['generate-adidas-padel.js']],
  ['Padel Market', 'node', ['generate-padel-market.js']],
  ['Padel Proshop PT', 'node', ['generate-padel-proshop.js']],
  ['Forum Sport ES', 'node', ['generate-forum-sport.js']],
  ['Merge de ofertas', 'node', ['merge-offers.js']],
  ['Relatorio de qualidade', 'node', ['report-quality.js']],
  ['Paginas SEO e sitemap', 'node', ['generate-seo-pages.js']],
];

function runStep(label, command, args) {
  console.log(`\n==> ${label}`);
  const result = spawnSync(command, args, {
    cwd: __dirname,
    stdio: 'inherit',
    env: process.env,
  });

  if (result.error) {
    console.error(`\nErro ao executar ${label}: ${result.error.message}`);
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error(`\nFalhou: ${label}`);
    process.exit(result.status || 1);
  }
}

console.log('PadelCost - atualizacao semanal sem Atmosfera Sport');
console.log('Nota: generate-products.js fica propositadamente fora desta rotina.');

for (const [label, command, args] of steps) {
  runStep(label, command, args);
}

console.log('\nAtualizacao concluida. Rever o relatorio acima antes de publicar no GitHub.');
