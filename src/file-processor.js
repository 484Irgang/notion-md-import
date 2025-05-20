const fs = require("fs");
const path = require("path");
const { processMarkdownFile, setPageIdMap } = require("./markdown-processor");
const { createPage, appendBlocks } = require("./notion-client");
const config = require("./config");

// Mapear IDs de páginas criadas para evitar duplicações
const pageIdMap = new Map(); // Map: caminho absoluto -> { id, isReference }

// Setar o pageIdMap globalmente para o parser
setPageIdMap(pageIdMap);

// Função para verificar se um arquivo deve ser processado
function shouldProcessFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return config.allowedExtensions.includes(ext);
}

// Função utilitária para verificar se um link é filho direto do diretório atual
function isDirectChildLink(currentDir, linkPath) {
  const resolved = path.resolve(currentDir, linkPath);
  const rel = path.relative(currentDir, resolved);
  if (rel.startsWith("..")) return false; // está fora do diretório
  const parts = rel.split(path.sep);
  return (
    parts.length === 1 ||
    (parts.length === 2 && parts[1].toLowerCase() === "readme.md")
  );
}

// Função utilitária para garantir que todas as páginas referenciadas por links internos já existem (apenas filhos diretos)
const linkRegex = /^\[([^\]]+)\]\((\.?\/?[^)]+\.md)\)/g;

async function ensureDirectChildPages(markdown, fileDir, parentPageId) {
  let match;
  let found = false;
  while ((match = linkRegex.exec(markdown)) !== null) {
    const nome = match[1];
    const href = match[2];
    found = true;
    if (isDirectChildLink(fileDir, href)) {
      const resolved = path.resolve(fileDir, href);
      if (!pageIdMap.has(resolved)) {
        const page = await createPage(parentPageId, nome);
        pageIdMap.set(resolved, { id: page.id, isReference: true });
        console.log(
          `[DEBUG] Página criada para filho direto: ${nome} (${resolved})`
        );
      }
    }
  }
  if (!found) {
    console.log(
      "[DEBUG] Nenhum link interno do tipo [Nome](./arquivo.md) encontrado neste arquivo."
    );
  }
}

// Função para processar um arquivo README.md
async function processReadmeFile(filePath, parentPageId) {
  try {
    const pageName = path.dirname(filePath);
    const { blocks } = await processMarkdownFile(filePath, parentPageId);

    // Se já existe uma página para este diretório
    if (pageIdMap.has(pageName)) {
      const pageInfo = pageIdMap.get(pageName);
      // Se foi criada como referência (vazia), popular com o conteúdo
      if (pageInfo.isReference) {
        await appendBlocks(pageInfo.id, blocks);
        pageIdMap.set(pageName, { id: pageInfo.id, isReference: false });
        return pageInfo.id;
      } else {
        await appendBlocks(pageInfo.id, blocks);
        return pageInfo.id;
      }
    }

    // Criar uma nova página com o conteúdo do README
    const page = await createPage(parentPageId, pageName, blocks);
    pageIdMap.set(pageName, { id: page.id, isReference: false });
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

    // Se já existe uma página para este arquivo
    if (pageIdMap.has(filePath)) {
      const pageInfo = pageIdMap.get(filePath);
      // Se foi criada como referência (vazia), popular com o conteúdo
      if (pageInfo.isReference) {
        const { blocks } = await processMarkdownFile(
          filePath,
          path.dirname(filePath),
          parentPageId
        );
        const validBlocks = blocks.filter((b) => b && typeof b === "object");
        // Adicionar blocos em lotes de até 100
        let i = 0;
        while (i < validBlocks.length) {
          const batch = validBlocks.slice(i, i + 100);
          await appendBlocks(pageInfo.id, batch);
          i += 100;
        }
        pageIdMap.set(filePath, { id: pageInfo.id, isReference: false });
        console.log(
          `Página de referência populada: ${fileName} (ID: ${pageInfo.id})`
        );
        return pageInfo.id;
      } else {
        console.log(`Página já existe para: ${fileName}`);
        return pageInfo.id;
      }
    }

    // Pré-processar: garantir que todas as páginas referenciadas por links internos já existem
    const rawContent = fs.readFileSync(filePath, "utf8");
    await ensureDirectChildPages(
      rawContent,
      path.dirname(filePath),
      parentPageId
    );

    const { blocks } = await processMarkdownFile(
      filePath,
      path.dirname(filePath),
      parentPageId
    );
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
    pageIdMap.set(filePath, { id: page.id, isReference: false });
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
async function processDirectory(dirPath) {
  try {
    const dirName = path.basename(dirPath);
    const infoDir = pageIdMap.get(dirName);
    if (!infoDir?.id)
      throw new Error(
        `Diretório não encontrado entre páginas criadas: ${dirPath}`
      );
    let readmePath = null;

    // Verificar se existe um README.md no diretório
    const readmeFile = path.join(dirPath, "README.md");
    if (fs.existsSync(readmeFile)) {
      readmePath = readmeFile;
    }

    // 1. Analisar README e criar páginas para filhos diretos referenciados
    if (readmePath) {
      await processReadmeFile(readmePath, infoDir.id);
    }

    // 4. Listar subdiretórios e processar recursivamente
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const entryPath = path.join(dirPath, entry.name);
        await processDirectory(entryPath, infoDir.id);
      }
    }

    // 5. Processar arquivos Markdown (exceto README.md)
    for (const entry of entries) {
      if (entry.isFile() && entry.name.toLowerCase() !== "readme.md") {
        const entryPath = path.join(dirPath, entry.name);
        if (shouldProcessFile(entryPath)) {
          await processMarkdownFileToNotion(entryPath, infoDir.id);
        }
      }
    }

    return infoDir.id;
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

    // Iniciar processamento a partir do diretório raiz, marcando isRoot = true
    const dirName = path.basename(rootPath);
    pageIdMap.set(dirName, { id: rootPageId, isReference: false });
    await processDirectory(rootPath);

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
