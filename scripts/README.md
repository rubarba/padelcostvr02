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

## Uso

```bash
npm run generate
```

O script gera automaticamente `../data/products-data.js`.

Depois é só fazer commit desse ficheiro para o repositório do site.

## Segurança

- ✅ A API key fica apenas no `.env` (nunca vai para o GitHub)
- ✅ O `products-data.js` gerado só contém dados públicos
- ✅ O `.gitignore` exclui `.env`, CSVs e node_modules

## Adicionar novas lojas

Quando tiveres mais afiliados (ex: Decathlon, Sporzone), cria um script por loja:
- `generate-atmosfera.js`
- `generate-decathlon.js`

E um script agregador `generate-all.js` que os chama a todos e faz merge dos `stores[]` por produto.

## Paginação (futuro)

Atualmente o site mostra todos os produtos de uma vez.  
Recomendado: **24 produtos por página** — implementar quando migrar para Next.js.
