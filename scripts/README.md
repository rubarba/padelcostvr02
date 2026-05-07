# PadelCost Scripts

Scripts para gerar automaticamente o catálogo do site [PadelCost.pt](https://padelcost.pt).

## Como funciona

```
Feed CSV da Awin (privado, com API key)
        ↓
generate-products.js (corre localmente)
        ↓
/data/products-data.js (ficheiro público, sem chaves)
        ↓
Site GitHub Pages lê os dados
```

## Instalação

```bash
cd scripts
npm install
cp .env.example .env
# edita .env com a tua API key da Awin
```

Se criares um feed manual na Awin com colunas extra como `ean`, `product_GTIN`,
`mpn` ou `stock_status`, podes guardar o URL completo em `AWIN_FEED_URL` no
`.env`. Nesse caso, o script usa esse URL diretamente.

## Uso

```bash
npm run generate
```

O script gera automaticamente `../data/products-data.js`.

Depois é só fazer commit desse ficheiro para o repositório do site.

### Adidas Padel (TradeTracker)

```bash
npm run generate:adidas
```

Este script gera `../data/adidas-padel-data.js` com os produtos da loja já:
- filtrados para padel
- limpos de categorias não relevantes (pickleball, ténis de praia, etc.)
- mapeados para as categorias do PadelCost

Nota: este ficheiro ainda é uma camada normalizada por loja. O passo seguinte é
fazer merge das ofertas com o catálogo principal.

### Padel Market (AWIN)

```bash
npm run generate:padelmarket
```

Este script gera `../data/padel-market-data.js` com os produtos do Padel Market:
- filtrados para padel
- mapeados para as categorias do PadelCost
- preparados com `EAN`, `GTIN`, `MPN` e imagens para o merge


### Zona de Padel (Google Merchant XML)

```bash
npm run generate:zonadepadel
```

Este script gera `../data/zona-de-padel-data.js` com os produtos da Zona de Padel:
- lê o feed XML Google Merchant
- mapeia apenas `raquetes`, `sapatilhas` e `sacos` para o catálogo core
- aplica as regras globais contra packs, bolas, roupa e acessórios misturados
- permite acrescentar o sufixo/parâmetro de afiliado via `ZONA_DE_PADEL_AFFILIATE_SUFFIX`

### Merge de ofertas

```bash
npm run merge:offers
```

Este passo:
- lê `products-data.js`
- lê `adidas-padel-data.js`
- lê `padel-market-data.js` quando existir
- tenta casar produtos por `EAN`
- usa assinatura do nome como fallback seguro
- acrescenta a nova loja dentro de `stores[]`

### Nota sobre EAN

O gerador da Atmosfera já está preparado para guardar `ean` quando o feed o trouxer.
Depois de atualizares o catálogo com:

```bash
npm run generate
```

os próximos merges ganham matches mais seguros porque passam a poder usar `EAN`
antes de recorrer ao nome do produto.

## Segurança

- ✅ A API key fica apenas no `.env` (nunca vai para o GitHub)
- ✅ O `products-data.js` gerado só contém dados públicos
- ✅ O `.gitignore` exclui `.env`, CSVs e node_modules

## Adicionar novas lojas

Quando tiveres mais afiliados (ex: Decathlon, Sporzone), cria um script por loja:
- `generate-atmosfera.js`
- `generate-decathlon.js`
- `generate-adidas-padel.js`

E um script agregador `generate-all.js` que os chama a todos e faz merge dos `stores[]` por produto.

## Paginação (futuro)

Atualmente o site mostra todos os produtos de uma vez.  
Recomendado: **24 produtos por página** — implementar quando migrar para Next.js.

## Páginas SEO estáticas

Para gerar as páginas indexáveis de categorias e produtos comparáveis:

```bash
npm run generate:seo
```

Este comando lê `../data/products-data.js`, cria páginas em `../categoria/` e `../produto/` apenas para produtos das categorias principais com 2 ou mais lojas, remove duplicados por nome/marca/categoria e atualiza `../sitemap.xml`. A app principal continua a funcionar no `index.html`; estas páginas são uma camada SEO complementar.
