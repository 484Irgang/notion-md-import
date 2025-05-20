const fs = require("fs");
const path = require("path");
const { processMarkdownFile } = require("./markdown-processor");
const { createPage, appendBlocks } = require("./notion-client");
const config = require("./config");

// Mapear IDs de páginas criadas para evitar duplicações
const pageIdMap = new Map();

// Função para verificar se um arquivo deve ser processado
function shouldProcessFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return config.allowedExtensions.includes(ext);
}

// Função para processar um arquivo README.md
async function processReadmeFile(filePath, parentPageId, pageName) {
  try {
    const { blocks } = processMarkdownFile(filePath);

    // Se já existe uma página para este diretório, apenas adicionar os blocos
    if (pageIdMap.has(pageName)) {
      await appendBlocks(pageIdMap.get(pageName), blocks);
      return pageIdMap.get(pageName);
    }

    // Criar uma nova página com o conteúdo do README
    const page = await createPage(parentPageId, pageName, blocks);
    pageIdMap.set(pageName, page.id);
    console.log(`Página criada para README: ${pageName} (ID: ${page.id})`);
    return page.id;
  } catch (error) {
    console.error(`Erro ao processar README ${filePath}:`, error.message);
    throw error;
  }
}

// Função para processar um arquivo Markdown normal
async function processMarkdownFileToNotion(filePath, parentPageId) {
  try {
    const fileName = path.basename(filePath, path.extname(filePath));

    // Se já existe uma página para este arquivo, pular
    if (pageIdMap.has(filePath)) {
      console.log(`Página já existe para: ${fileName}`);
      return pageIdMap.get(filePath);
    }

    const { blocks } = processMarkdownFile(filePath);
    // Filtrar blocos inválidos
    const validBlocks = blocks.filter((b) => b && typeof b === "object");
    // Logar blocos para debug
    validBlocks.forEach((b, idx) => {
      if (!b || typeof b !== "object") {
        console.warn(
          `[DEBUG] Bloco inválido em ${fileName} na posição ${idx}:`,
          b
        );
      }
      if (idx === 35) {
        console.warn(
          `[DEBUG] Bloco na posição 35 em ${fileName}:`,
          JSON.stringify(b, null, 2)
        );
      }
    });
    // Dividir os blocos em lotes de até 100
    const firstBatch = validBlocks.slice(0, 100);
    const page = await createPage(parentPageId, fileName, firstBatch);
    pageIdMap.set(filePath, page.id);
    console.log(`Página criada para: ${fileName} (ID: ${page.id})`);

    // Adicionar blocos restantes, se houver
    let i = 100;
    while (i < validBlocks.length) {
      const batch = validBlocks.slice(i, i + 100);
      await appendBlocks(page.id, batch);
      i += 100;
    }

    return page.id;
  } catch (error) {
    console.error(`Erro ao processar arquivo ${filePath}:`, error.message);
    throw error;
  }
}

// Função para processar um diretório
async function processDirectory(dirPath, parentPageId) {
  try {
    const dirName = path.basename(dirPath);
    let currentPageId = parentPageId;
    let readmePath = null;

    // Primeiro, verificar se existe um README.md no diretório
    const readmeFile = path.join(dirPath, "README.md");
    if (fs.existsSync(readmeFile)) {
      readmePath = readmeFile;
    }

    // Se não existe um README mas devemos criar páginas vazias para diretórios
    if (!readmePath && config.createEmptyParentPages) {
      const page = await createPage(parentPageId, dirName);
      pageIdMap.set(dirPath, page.id);
      currentPageId = page.id;
      console.log(
        `Página vazia criada para diretório: ${dirName} (ID: ${page.id})`
      );
    }

    // Processar o README primeiro se existir
    if (readmePath) {
      currentPageId = await processReadmeFile(
        readmePath,
        parentPageId,
        dirName
      );
      pageIdMap.set(dirPath, currentPageId);
    }

    // Ler todos os arquivos e diretórios no diretório atual
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    // Processar diretórios primeiro
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const entryPath = path.join(dirPath, entry.name);
        await processDirectory(entryPath, currentPageId);
      }
    }

    // Processar arquivos depois (exceto README.md que já foi processado)
    for (const entry of entries) {
      if (entry.isFile() && entry.name.toLowerCase() !== "readme.md") {
        const entryPath = path.join(dirPath, entry.name);
        if (shouldProcessFile(entryPath)) {
          await processMarkdownFileToNotion(entryPath, currentPageId);
        }
      }
    }

    return currentPageId;
  } catch (error) {
    console.error(`Erro ao processar diretório ${dirPath}:`, error.message);
    throw error;
  }
}

// Função principal para processar toda a estrutura de arquivos
async function processFiles(rootPath, rootPageId) {
  try {
    console.log(`Iniciando processamento da estrutura em: ${rootPath}`);
    console.log(`Página raiz no Notion: ${rootPageId}`);

    // Verificar se o diretório existe
    if (!fs.existsSync(rootPath)) {
      throw new Error(`Diretório não encontrado: ${rootPath}`);
    }

    // Iniciar processamento a partir do diretório raiz
    await processDirectory(rootPath, rootPageId);

    console.log("Processamento concluído com sucesso!");
    return true;
  } catch (error) {
    console.error("Erro durante o processamento:", error.message);
    return false;
  }
}

module.exports = {
  processFiles,
  processDirectory,
  processMarkdownFileToNotion,
  processReadmeFile,
};
