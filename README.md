# Notion Markdown Import

Uma ferramenta para importar arquivos Markdown para o Notion, mantendo a estrutura de diretórios e transformando os arquivos em páginas hierárquicas.

## Características

- ✅ Mantém a estrutura de diretórios como hierarquia de páginas
- ✅ Converte diagramas Mermaid para blocos de código Mermaid no Notion
- ✅ Converte tabelas, listas, código e outros elementos Markdown para seus equivalentes no Notion
- ✅ Usa o conteúdo dos arquivos README.md como conteúdo das páginas de pastas
- ✅ Suporta frontmatter YAML
- ✅ Interface de linha de comando completa com opções configuráveis
- ✅ Processamento robusto com controle de erros

## Instalação

```bash
# Clonar o repositório
git clone [url-do-repositorio]
cd notion-md-import

# Instalar dependências
npm install

# Instalar globalmente (opcional)
npm link
```

## Configuração

1. Crie uma integração no Notion em [https://www.notion.so/my-integrations](https://www.notion.so/my-integrations)
2. Copie a chave de API da integração
3. Compartilhe a página raiz onde deseja criar a documentação com a integração (usando o botão "Share" no Notion)
4. Copie o ID da página raiz (a parte após notion.so/ na URL)
5. Crie um arquivo `.env` com base no arquivo `env.example`:

```
NOTION_API_KEY=your_notion_api_key
NOTION_ROOT_PAGE_ID=your_notion_page_id
DOCS_PATH=../docs
```

## Uso

### Linha de Comando

```bash
# Usando as configurações do arquivo .env
npm run import

# Especificando os parâmetros diretamente
npm run import -- --path ../docs --root-page your_notion_page_id --api-key your_notion_api_key

# Ou se instalado globalmente
notion-md-import --path ../docs --root-page your_notion_page_id --api-key your_notion_api_key
```

### Opções

```
Options:
  -p, --path <path>        Caminho para a pasta de documentação
  -r, --root-page <id>     ID da página raiz no Notion
  -k, --api-key <key>      Chave de API do Notion
  -d, --delay <ms>         Atraso entre requisições em milissegundos
  -c, --concurrent <num>   Número máximo de requisições concorrentes
  -m, --mermaid            Renderizar diagramas Mermaid
  -f, --preserve-frontmatter  Preservar frontmatter nos documentos
  -y, --yes                Pular confirmações
  -h, --help               Exibe informações de ajuda
  -V, --version            Exibe a versão
```

### Programaticamente

```javascript
const { processFiles } = require('notion-md-import')

async function importToNotion() {
  try {
    await processFiles('/caminho/para/docs', 'id_da_pagina_raiz_notion')
    console.log('Importação concluída!')
  } catch (error) {
    console.error('Erro:', error)
  }
}

importToNotion()
```

## Estrutura de Arquivos e Páginas

A ferramenta processa a estrutura de arquivos da seguinte forma:

1. Cada diretório se torna uma página no Notion
2. O conteúdo do arquivo `README.md` em cada diretório é usado como conteúdo da página do diretório
3. Cada arquivo Markdown se torna uma subpágina dentro da página do diretório
4. A hierarquia de diretórios é mantida como hierarquia de páginas no Notion

Exemplo:

```
docs/
├── README.md             # → Conteúdo da página raiz
├── architecture/
│   ├── README.md         # → Conteúdo da página "architecture"
│   ├── overview.md       # → Subpágina "overview" dentro de "architecture"
│   └── components.md     # → Subpágina "components" dentro de "architecture"
└── implementation/
    ├── README.md         # → Conteúdo da página "implementation"
    └── guide.md          # → Subpágina "guide" dentro de "implementation"
```

## Limitações

- Imagens locais não são automaticamente carregadas para o Notion
- O processamento de frontmatter é opcional (pode ser preservado ou omitido)
- A API do Notion tem limites de taxa que podem afetar importações grandes
- Alguns elementos Markdown complexos podem não ser perfeitamente convertidos

## Desenvolvimento

```bash
# Executar em modo de desenvolvimento
npm run dev

# Executar testes
npm test
```

## Licença

MIT
