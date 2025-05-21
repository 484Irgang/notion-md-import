# notion-md-import

Transforme arquivos Markdown em páginas do Notion com links internos resolvidos automaticamente.

## Uso Local do CLI

Para testar o CLI localmente (sem publicar no npm):

```sh
git clone https://github.com/484Irgang/notion-md-import.git
cd notion-md-import
npm install
npm run link-global
```

Agora você pode rodar o comando de qualquer lugar:

```sh
notion-md-import <notionPageId> <docsPath>
```

## Uso Básico (Node.js)

```js
const { processMarkdownFile, setPageIdMap } = require("notion-md-import");

// Inicialize o pageIdMap global (recomendado para múltiplos arquivos)
const pageIdMap = new Map();
setPageIdMap(pageIdMap);

(async () => {
  const blocks = await processMarkdownFile(
    "caminho/para/arquivo.md",
    "notion-root-page-id"
  );
  console.log(blocks);
})();
```

## O que faz?

- Converte Markdown em blocos compatíveis com a API do Notion
- Resolve links internos para arquivos `.md` e cria páginas automaticamente
- Atualiza os links para apontar para as páginas criadas no Notion

## Contribuindo

Pull requests são bem-vindos! Abra uma issue para discutir mudanças.

## Licença

MIT
