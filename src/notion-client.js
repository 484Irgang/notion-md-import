const { Client } = require("@notionhq/client");
const config = require("./config");

// Inicializar o cliente Notion com a API Key das variáveis de ambiente
const notion = new Client({
  auth: config.notionApiKey,
});

// Função para delay entre as requisições para evitar rate limiting
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Função para criar uma página no Notion
async function createPage(
  parentId,
  title,
  blocks = [],
  icon = null,
  cover = null
) {
  try {
    // Sempre criar como filha de página, nunca de database
    const parent = { page_id: parentId };

    const pageData = {
      parent,
      properties: {
        title: {
          title: [
            {
              text: {
                content: title,
              },
            },
          ],
        },
      },
      children: blocks,
    };

    // Adicionar ícone se fornecido
    if (icon) {
      pageData.icon = icon;
    }

    // Adicionar capa se fornecida
    if (cover) {
      pageData.cover = cover;
    }

    const response = await notion.pages.create(pageData);
    await sleep(config.requestDelayMs);
    return response;
  } catch (error) {
    console.error(`Erro ao criar página "${title}":`, error.message);
    throw error;
  }
}

// Função para obter uma página no Notion
async function getPage(pageId) {
  try {
    const response = await notion.pages.retrieve({ page_id: pageId });
    await sleep(config.requestDelayMs);
    return response;
  } catch (error) {
    console.error(`Erro ao obter página ${pageId}:`, error.message);
    throw error;
  }
}

// Função para adicionar blocos a uma página existente
async function appendBlocks(pageId, blocks) {
  try {
    if (!blocks || blocks.length === 0) return;

    const response = await notion.blocks.children.append({
      block_id: pageId,
      children: blocks,
    });
    await sleep(config.requestDelayMs);
    return response;
  } catch (error) {
    console.error(
      `Erro ao adicionar blocos à página ${pageId}:`,
      error.message
    );
    throw error;
  }
}

// Função para criar um banco de dados no Notion
async function createDatabase(parentId, title, properties = {}) {
  try {
    const response = await notion.databases.create({
      parent: { page_id: parentId },
      title: [
        {
          text: {
            content: title,
          },
        },
      ],
      properties: properties,
    });
    await sleep(config.requestDelayMs);
    return response;
  } catch (error) {
    console.error(`Erro ao criar banco de dados "${title}":`, error.message);
    throw error;
  }
}

module.exports = {
  notion,
  createPage,
  getPage,
  appendBlocks,
  createDatabase,
  sleep,
};
