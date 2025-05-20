require('dotenv').config()

module.exports = {
  notionApiKey: process.env.NOTION_API_KEY,
  notionRootPageId: process.env.NOTION_ROOT_PAGE_ID,
  docsPath: process.env.DOCS_PATH || '../docs',

  // Opções de log
  logLevel: process.env.LOG_LEVEL || 'info',

  // Configurações de processamento
  maxConcurrentRequests: parseInt(process.env.MAX_CONCURRENT_REQUESTS || '3', 10),
  requestDelayMs: parseInt(process.env.REQUEST_DELAY_MS || '500', 10),

  // URLs de referência da API Notion
  notionApiUrl: 'https://api.notion.com/v1',

  // Lista de extensões de arquivo permitidas
  allowedExtensions: ['.md'],

  // Opções de renderização
  renderMermaidDiagrams: true,
  convertTablesToNotion: true,
  convertCodeBlocksToNotion: true,
  preserveFrontmatter: false,

  // Opções de criação de páginas
  createEmptyParentPages: true
}
