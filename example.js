require("dotenv").config();
const { processFiles } = require("./src/index");
const path = require("path");
const os = require("os");

function expandHomeDir(filePath) {
  if (!filePath) return filePath;
  if (filePath.startsWith("~")) {
    return path.join(os.homedir(), filePath.slice(1));
  }
  return filePath;
}

async function runImport() {
  try {
    const [notionPageId, docsPathRaw] = process.argv.slice(2);
    const notionApiKey = process.env.NOTION_API_KEY;

    if (!notionApiKey) {
      console.error("Erro: NOTION_API_KEY não definido!");
      process.exit(1);
    }
    if (!notionPageId) {
      console.error("Erro: ID da página do Notion não fornecido!");
      console.error("Uso: node example.js <notionPageId> <docsPath>");
      process.exit(1);
    }
    if (!docsPathRaw) {
      console.error("Erro: Caminho dos arquivos não fornecido!");
      console.error("Uso: node example.js <notionPageId> <docsPath>");
      process.exit(1);
    }

    const docsPath = expandHomeDir(docsPathRaw);

    console.log(`Importando de: ${docsPath}`);
    console.log(`Para a página Notion: ${notionPageId}`);

    const success = await processFiles(docsPath, notionPageId);

    if (success) {
      console.log("Importação concluída com sucesso!");
    } else {
      console.error("Importação falhou!");
      process.exit(1);
    }
  } catch (error) {
    console.error("Erro durante a importação:", error.message);
    process.exit(1);
  }
}

runImport();
