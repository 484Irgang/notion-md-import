# notion-md-import

Transforme arquivos Markdown em páginas do Notion com links internos resolvidos automaticamente.

## Uso Local do CLI

Para usar a CLI:

```sh
git clone https://github.com/484Irgang/notion-md-import.git
cd notion-md-import
npm install
npm run link-global
```

Adicione a env `NOTION_API_KEY` com a API KEY que o Notion libera para a integração em um arquivo `.env`
**Importante**
O script só terá possibilidade de adicionar as páginas e os conteúdos dos arquivos se houver permissão para acessar essa página via integração, mais informações em [Adicionar e gerenciar integração](https://www.notion.com/pt/help/add-and-manage-connections-with-the-api#add-connections-to-pages)

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
