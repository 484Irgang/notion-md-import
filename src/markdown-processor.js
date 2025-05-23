const fs = require("fs");
const path = require("path");
const { createPage } = require("./notion-client");
const { markdownToBlocks } = require("@tryfabric/martian");

let pageIdMap = null;
function setPageIdMap(map) {
  pageIdMap = map;
}

function returnBaseDir(currentDir, linkPath) {
  const resolved = path.resolve(currentDir, linkPath);
  console.log("[DEBUG] resolved:", resolved);
  if (!fs.existsSync(resolved)) return null;
  const rel = path.relative(currentDir, resolved);
  if (rel.startsWith("..")) return null;
  const parts = rel.split(path.sep);
  return parts.length === 1
    ? path.basename(rel, path.extname(rel))
    : parts.length === 2 && parts[1].toLowerCase() === "readme.md"
    ? path.basename(path.dirname(rel))
    : null;
}

const typesWithRichText = [
  "paragraph",
  "bulleted_list_item",
  "numbered_list_item",
  "heading_1",
  "heading_2",
  "heading_3",
  "code",
  "quote",
  "table",
  "divider",
  "image",
];

// Função para processar blocos recursivamente
function normalizeBlockPageLinks(fileDir, parentPageId) {
  return async function (block) {
    const richTextType = typesWithRichText.find(
      (type) => block?.[type]?.rich_text
    );
    const richTextArr = block?.[richTextType]?.rich_text;
    if (!richTextArr) return block;

    const richTextPromises =
      (await richTextArr?.map(async (rt) => {
        if (
          rt.type !== "text" ||
          !rt?.text?.link ||
          !rt?.text?.link?.url?.endsWith(".md")
        )
          return rt;
        const linkPath = rt.text.link.url;
        const baseDir = returnBaseDir(fileDir, linkPath);
        if (!baseDir) return { ...rt, text: { ...rt.text, link: undefined } };
        if (!pageIdMap.has(baseDir)) {
          const page = await createPage(parentPageId, baseDir);
          pageIdMap.set(baseDir, { id: page.id, isReference: true });
        }
        const pageInfo = pageIdMap.get(baseDir);
        // Atualiza apenas a URL do link para apontar para a página criada
        return {
          ...rt,
          text: {
            ...rt.text,
            link: {
              ...rt.text.link,
              url: `https://www.notion.so/${baseDir}-${pageInfo.id.replace(
                /-/g,
                ""
              )}`,
            },
          },
        };
      })) || [];

    // Se o bloco tiver filhos, processa recursivamente
    if (block.children && Array.isArray(block.children)) {
      block.children = await Promise.all(
        block.children.map(normalizeBlockPageLinks(fileDir, parentPageId))
      );
    }

    const rich_text = await Promise.all(richTextPromises);

    return {
      ...block,
      [richTextType]: { ...block[richTextType], rich_text },
    };
  };
}

// Função principal para processar markdown e tratar links internos
async function processMarkdownFile(filePath, parentPageId) {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    const blocks = markdownToBlocks(content);
    // Processamento sequencial dos blocos para evitar concorrência
    const resultBlocks = [];
    for (const block of blocks) {
      resultBlocks.push(
        await normalizeBlockPageLinks(
          path.dirname(filePath),
          parentPageId
        )(block)
      );
    }
    return resultBlocks;
  } catch (error) {
    console.error(
      `Erro ao processar arquivo Markdown ${filePath}:`,
      error.message
    );
    throw error;
  }
}

module.exports = {
  processMarkdownFile,
  setPageIdMap,
};
