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

// function returnBaseDir(currentDir, linkPath) {
//   const resolved = path.resolve(currentDir, linkPath);
//   const rel = path.relative(currentDir, resolved);
//   if (rel.startsWith("..")) return null; // está fora do diretório
//   const parts = rel.split(path.sep);
//   return parts.length === 1
//     ? path.basename(rel)
//     : parts.length === 2 && parts[1].toLowerCase() === "readme.md"
//     ? path.basename(path.dirname(rel))
//     : null;
// }

// function isDirectChildLink(currentDir, linkPath) {
//   const resolved = path.resolve(currentDir, linkPath);
//   const rel = path.relative(currentDir, resolved);
//   if (rel.startsWith("..")) return false; // está fora do diretório
//   const parts = rel.split(path.sep);
//   return (
//     parts.length === 1 ||
//     (parts.length === 2 && parts[1].toLowerCase() === "readme.md")
//   );
// }

// Função utilitária para garantir que todas as páginas referenciadas por links internos já existem (apenas filhos diretos)
// const linkRegex = /^\[([^\]]+)\]\((\.?\/?[^)]+\.md)\)/g;

// async function ensureDirectChildPages(markdown, fileDir, parentPageId) {
//   let match;
//   let found = false;
//   while ((match = linkRegex.exec(markdown)) !== null) {
//     const nome = match[1];
//     const href = match[2];
//     found = true;
//     if (isDirectChildLink(fileDir, href)) {
//       const resolved = path.resolve(fileDir, href);
//       if (!pageIdMap.has(resolved)) {
//         const page = await createPage(parentPageId, nome);
//         pageIdMap.set(resolved, { id: page.id, isReference: true });
//         console.log(
//           `[DEBUG] Página criada para filho direto: ${nome} (${resolved})`
//         );
//       }
//     }
//   }
//   if (!found) {
//     console.log(
//       "[DEBUG] Nenhum link interno do tipo [Nome](./arquivo.md) encontrado neste arquivo."
//     );
//   }
// }

// Função para processar um arquivo README.md
async function processMarkdownReadme(filePath, parentPageId, pageName) {
  try {
    const blocks = await processMarkdownFile(filePath, parentPageId);
    // // DEBUG: Exibir estrutura dos blocos que irão para o Notion
    // console.log(
    //   "[DEBUG] Estrutura dos blocos para Notion:",
    //   JSON.stringify(blocks, null, 2)
    // );

    // Se já existe uma página para este diretório
    if (pageIdMap.has(pageName)) {
      const pageInfo = pageIdMap.get(pageName);
      // Se foi criada como referência (vazia), popular com o conteúdo
      if (pageInfo.isReference) {
        let i = 0;
        while (i < blocks.length) {
          const batch = blocks.slice(i, i + 100);
          await appendBlocks(pageInfo.id, batch);
          i += 100;
        }
        pageIdMap.set(pageName, { id: pageInfo.id, isReference: false });
        return pageInfo.id;
      } else {
        let i = 0;
        while (i < blocks.length) {
          const batch = blocks.slice(i, i + 100);
          await appendBlocks(pageInfo.id, batch);
          i += 100;
        }
        return pageInfo.id;
      }
    }

    // Criar uma nova página com o conteúdo do README
    const firstBatch = blocks.slice(0, 100);
    const page = await createPage(parentPageId, pageName, firstBatch);
    pageIdMap.set(pageName, { id: page.id, isReference: false });
    console.log(`Página criada para README: ${pageName} (ID: ${page.id})`);

    // Adicionar blocos restantes, se houver
    let i = 100;
    while (i < blocks.length) {
      const batch = blocks.slice(i, i + 100);
      await appendBlocks(page.id, batch);
      i += 100;
    }
    return page.id;
  } catch (error) {
    console.error(`Erro ao processar README ${filePath}:`, error.message);
    throw error;
  }
}

async function processMarkdownFileToNotion(filePath, parentPageId) {
  try {
    const fileName = path.basename(filePath, path.extname(filePath));

    if (pageIdMap.has(fileName)) {
      const pageInfo = pageIdMap.get(fileName);
      if (!pageInfo.isReference) {
        console.log(`Página já existe para: ${fileName}`);
        return pageInfo.id;
      }
      const blocks = await processMarkdownFile(filePath, parentPageId);
      // Adicionar blocos em lotes de até 100
      let i = 0;
      while (i < blocks.length) {
        const batch = blocks.slice(i, i + 100);
        await appendBlocks(pageInfo.id, batch);
        i += 100;
      }
      pageIdMap.set(fileName, { id: pageInfo.id, isReference: false });
      console.log(
        `Página de referência populada: ${fileName} (ID: ${pageInfo.id})`
      );
      return pageInfo.id;
    }

    const blocks = await processMarkdownFile(
      filePath,
      path.dirname(filePath),
      parentPageId
    );

    // Dividir os blocos em lotes de até 100
    const firstBatch = blocks.slice(0, 100);
    const page = await createPage(parentPageId, fileName, firstBatch);
    pageIdMap.set(filePath, { id: page.id, isReference: false });
    console.log(`Página criada para: ${fileName} (ID: ${page.id})`);

    // Adicionar blocos restantes, se houver
    let i = 100;
    while (i < blocks.length) {
      const batch = blocks.slice(i, i + 100);
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
    console.log(`Processando diretório: ${dirName} = ${dirName}`);
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
      await processMarkdownReadme(readmePath, infoDir.id, dirName);
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
};
