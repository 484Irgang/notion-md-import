// const { marked } = require("marked");
// const { markedHighlight } = require("marked-highlight");
// const { gfmHeadingId } = require("marked-gfm-heading-id");
// const { mangle } = require("marked-mangle");
// const hljs = require("highlight.js");
// const cheerio = require("cheerio");
// const yaml = require("yaml");
const fs = require("fs");
const path = require("path");
// const config = require("./config");
const { createPage } = require("./notion-client");
const { markdownToBlocks } = require("@tryfabric/martian");

// // Configurar o marked com os plugins necessários
// marked.use(
//   markedHighlight({
//     highlight: (code, language) => {
//       if (language && hljs.getLanguage(language)) {
//         return hljs.highlight(code, { language }).value;
//       }
//       return hljs.highlightAuto(code).value;
//     },
//   }),
//   gfmHeadingId(),
//   mangle()
// );

// Adicionar referência ao pageIdMap (será setado pelo file-processor)
let pageIdMap = null;
function setPageIdMap(map) {
  pageIdMap = map;
}

// // Função para extrair o frontmatter do markdown
// function extractFrontmatter(content) {
//   const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
//   const match = content.match(frontmatterRegex);

//   if (match) {
//     try {
//       const frontmatter = yaml.parse(match[1]);
//       const contentWithoutFrontmatter = content
//         .replace(frontmatterRegex, "")
//         .trim();
//       return { frontmatter, content: contentWithoutFrontmatter };
//     } catch (error) {
//       console.warn("Erro ao parsear frontmatter:", error.message);
//       return { frontmatter: {}, content };
//     }
//   }

//   return { frontmatter: {}, content };
// }

function returnBaseDir(currentDir, linkPath) {
  const resolved = path.resolve(currentDir, linkPath);
  const rel = path.relative(currentDir, resolved);
  if (rel.startsWith("..")) return null; // está fora do diretório
  const parts = rel.split(path.sep);
  return parts.length === 1
    ? path.basename(rel)
    : parts.length === 2 && parts[1].toLowerCase() === "readme.md"
    ? path.basename(path.dirname(rel))
    : null;
}

// // Função utilitária para processar texto e links internos
// async function processTextWithLinks(text, dirName, parentPageId) {
//   const linkRegex = /\[([^\]]+)\]\((\.?\/?[^)]+\.md)\)/g;
//   let match;
//   let lastIndex = 0;
//   const richText = [];
//   const blocks = [];

//   while ((match = linkRegex.exec(text)) !== null) {
//     // Texto antes do link
//     if (match.index > lastIndex) {
//       richText.push({
//         type: "text",
//         text: { content: text.slice(lastIndex, match.index) },
//       });
//     }
//     const name = match[1];
//     const href = match[2];

//     const baseDir = returnBaseDir(dirName, href);

//     // Garante que a página existe
//     if (!pageIdMap.has(baseDir)) {
//       const page = await createPage(parentPageId, name);
//       pageIdMap.set(baseDir, { id: page.id, isReference: true });
//     }
//     const pageInfo = pageIdMap.get(baseDir);

//     // Cria bloco de link_to_page
//     blocks.push({
//       object: "block",
//       type: "link_to_page",
//       link_to_page: {
//         type: "page_id",
//         page_id: pageInfo.id,
//       },
//     });

//     lastIndex = linkRegex.lastIndex;
//   }

//   // Texto restante
//   if (lastIndex < text.length) {
//     richText.push({
//       type: "text",
//       text: { content: text.slice(lastIndex) },
//     });
//   }

//   return { richText, blocks };
// }

// // Converter um token do tipo heading para um bloco de título do Notion
// function headingToNotionBlock(token) {
//   // O Notion só suporta heading_1, heading_2 e heading_3
//   const level = Math.min(token.depth, 3);
//   const text = token.text;

//   return {
//     object: "block",
//     type: `heading_${level}`,
//     [`heading_${level}`]: {
//       rich_text: [
//         {
//           type: "text",
//           text: {
//             content: text,
//           },
//         },
//       ],
//     },
//   };
// }

// // Converter um token do tipo parágrafo para um bloco de parágrafo do Notion
// async function paragraphToNotionBlock(token, fileDir = "", parentPageId) {
//   const $ = cheerio.load(token.text);
//   const blocks = [];
//   let richText = [];

//   const promises = [];
//   $("body")
//     .contents()
//     .each((_, node) => {
//       if (node.type === "text") {
//         const content = node.data;
//         if (content.trim() === "") return;
//         promises.push(processTextWithLinks(content, fileDir, parentPageId));
//       } else if (node.type === "tag") {
//         let annotations = {};
//         let text = "";
//         $(node)
//           .contents()
//           .each((_, child) => {
//             if (child.type === "text") {
//               text += child.data;
//             } else if (child.type === "tag") {
//               text += $(child).text();
//             }
//           });
//         if (text.trim() === "") return;
//         // Não processa links markdown dentro de tags, só aplica anotações
//         switch (node.name) {
//           case "strong":
//           case "b":
//             annotations.bold = true;
//             break;
//           case "em":
//           case "i":
//             annotations.italic = true;
//             break;
//           case "u":
//             annotations.underline = true;
//             break;
//           case "s":
//           case "del":
//             annotations.strikethrough = true;
//             break;
//           case "code":
//             annotations.code = true;
//             break;
//         }
//         richText.push({
//           type: "text",
//           text: {
//             content: text,
//           },
//           annotations,
//         });
//       }
//     });

//   const results = await Promise.all(promises);
//   results.forEach(({ richText: r, blocks: b }) => {
//     if (r.length > 0) richText = richText.concat(r);
//     if (b.length > 0) blocks.push(...b);
//   });

//   if (blocks.length > 0) {
//     // Se houver blocos link_to_page, retornar todos (um para cada link)
//     return blocks.concat([
//       {
//         object: "block",
//         type: "paragraph",
//         paragraph: {
//           rich_text:
//             richText.length > 0
//               ? richText
//               : [{ type: "text", text: { content: "" } }],
//         },
//       },
//     ]);
//   }

//   return {
//     object: "block",
//     type: "paragraph",
//     paragraph: {
//       rich_text:
//         richText.length > 0
//           ? richText
//           : [{ type: "text", text: { content: "" } }],
//     },
//   };
// }

// // Converter um token do tipo lista para blocos de lista do Notion
// async function listToNotionBlocks(token, fileDir = "", parentPageId) {
//   const blocks = [];
//   const listType = token.ordered ? "numbered_list_item" : "bulleted_list_item";

//   for (const item of token.items) {
//     const $ = cheerio.load(item.text);
//     let richText = [];
//     const promises = [];
//     $("body")
//       .contents()
//       .each((_, node) => {
//         if (node.type === "text") {
//           const content = node.data;
//           if (content.trim() === "") return;
//           promises.push(processTextWithLinks(content, fileDir, parentPageId));
//         } else if (node.type === "tag") {
//           let annotations = {};
//           const text = $(node).text();
//           switch (node.name) {
//             case "strong":
//             case "b":
//               annotations.bold = true;
//               break;
//             case "em":
//             case "i":
//               annotations.italic = true;
//               break;
//             case "code":
//               annotations.code = true;
//               break;
//           }
//           richText.push({
//             type: "text",
//             text: {
//               content: text,
//             },
//             annotations,
//           });
//         }
//       });
//     const results = await Promise.all(promises);
//     results.forEach(({ richText: r, blocks: b }) => {
//       if (r.length > 0) richText = richText.concat(r);
//       if (b.length > 0) blocks.push(...b);
//     });
//     blocks.push({
//       object: "block",
//       type: listType,
//       [listType]: {
//         rich_text:
//           richText.length > 0
//             ? richText
//             : [{ type: "text", text: { content: "" } }],
//       },
//     });
//   }
//   return blocks;
// }

// // Converter um token do tipo blockquote para um bloco de citação do Notion
// async function blockquoteToNotionBlock(token, fileDir = "", parentPageId) {
//   const $ = cheerio.load(token.text);
//   let richText = [];
//   const blocks = [];
//   const promises = [];
//   $("body")
//     .contents()
//     .each((_, node) => {
//       if (node.type === "text") {
//         const content = node.data;
//         if (content.trim() === "") return;
//         promises.push(processTextWithLinks(content, fileDir, parentPageId));
//       }
//     });
//   const results = await Promise.all(promises);
//   results.forEach(({ richText: r, blocks: b }) => {
//     if (r.length > 0) richText = richText.concat(r);
//     if (b.length > 0) blocks.push(...b);
//   });
//   if (blocks.length > 0) {
//     return blocks.concat([
//       {
//         object: "block",
//         type: "quote",
//         quote: {
//           rich_text:
//             richText.length > 0
//               ? richText
//               : [{ type: "text", text: { content: "" } }],
//         },
//       },
//     ]);
//   }
//   return {
//     object: "block",
//     type: "quote",
//     quote: {
//       rich_text:
//         richText.length > 0
//           ? richText
//           : [{ type: "text", text: { content: "" } }],
//     },
//   };
// }

// // Converter um token do tipo tabela para um bloco de tabela do Notion
// async function tableToNotionBlock(token, fileDir = "", parentPageId) {
//   const rows = [];
//   // Função utilitária para extrair texto puro de uma célula
//   async function processCell(cell) {
//     let content = "";
//     if (typeof cell === "string") content = cell;
//     else if (cell && typeof cell === "object") {
//       if (cell.text) content = cell.text;
//       else if (cell.raw) content = cell.raw;
//       else if (cell.tokens && Array.isArray(cell.tokens)) {
//         content = cell.tokens.map((t) => t.raw || t.text || "").join("");
//       }
//     } else content = String(cell);
//     const { richText } = await processTextWithLinks(
//       content,
//       fileDir,
//       parentPageId
//     );
//     return richText;
//   }
//   // Adicionar cabeçalho
//   if (token.header && token.header.length > 0) {
//     const headerCells = await Promise.all(
//       token.header.map((cell) => processCell(cell))
//     );
//     rows.push(headerCells);
//   }
//   // Adicionar linhas
//   for (const row of token.rows) {
//     const cells = await Promise.all(row.map((cell) => processCell(cell)));
//     rows.push(cells);
//   }
//   return {
//     object: "block",
//     type: "table",
//     table: {
//       table_width: token.header
//         ? token.header.length
//         : token.rows[0]
//         ? token.rows[0].length
//         : 1,
//       has_column_header: token.header && token.header.length > 0,
//       has_row_header: false,
//       children: rows.map((row) => ({
//         type: "table_row",
//         table_row: {
//           cells: row,
//         },
//       })),
//     },
//   };
// }

// // Converter um token do tipo code para um bloco de código do Notion
// function codeToNotionBlock(token) {
//   const maxLen = 2000;
//   const code = token.text || "";
//   const lang = token.lang || "plain text";
//   const blocks = [];
//   for (let i = 0; i < code.length; i += maxLen) {
//     blocks.push({
//       object: "block",
//       type: "code",
//       code: {
//         rich_text: [
//           {
//             type: "text",
//             text: {
//               content: code.slice(i, i + maxLen),
//             },
//           },
//         ],
//         language: lang,
//       },
//     });
//   }
//   return blocks.length === 1 ? blocks[0] : blocks;
// }

// // Converter um token do tipo hr para um bloco de separador do Notion
// function hrToNotionBlock() {
//   return {
//     object: "block",
//     type: "divider",
//     divider: {},
//   };
// }

// // Converter um token do tipo image para um bloco de imagem do Notion
// function imageToNotionBlock(token) {
//   const isExternalImage = token.href.startsWith("http");

//   if (isExternalImage) {
//     return {
//       object: "block",
//       type: "image",
//       image: {
//         type: "external",
//         external: {
//           url: token.href,
//         },
//         caption: token.title
//           ? [{ type: "text", text: { content: token.title } }]
//           : [],
//       },
//     };
//   } else {
//     // Para imagens locais, seria necessário fazer upload para o Notion ou para um servidor externo
//     console.warn(
//       `Imagem local não pode ser processada diretamente: ${token.href}`
//     );
//     return {
//       object: "block",
//       type: "paragraph",
//       paragraph: {
//         rich_text: [
//           {
//             type: "text",
//             text: {
//               content: `[Imagem local: ${token.href}]`,
//             },
//             annotations: {
//               italic: true,
//               color: "gray",
//             },
//           },
//         ],
//       },
//     };
//   }
// }

// // Verificar se o conteúdo contém um diagrama Mermaid
// function containsMermaidDiagram(content) {
//   return content.includes("```mermaid") || content.includes("```Mermaid");
// }

// // Extrair diagrama Mermaid do conteúdo
// function extractMermaidDiagram(content) {
//   const mermaidRegex = /```mermaid\n([\s\S]*?)```/gi;
//   const matches = [];
//   let match;

//   while ((match = mermaidRegex.exec(content)) !== null) {
//     matches.push(match[1].trim());
//   }

//   return matches;
// }

// // Função utilitária para filtrar blocos válidos recursivamente
// function filterValidBlocks(blocks) {
//   if (!Array.isArray(blocks)) return [];
//   return blocks
//     .filter((b) => b && typeof b === "object")
//     .map((b) => {
//       // Se for um bloco de lista, pode conter children
//       if (
//         Object.prototype.hasOwnProperty.call(b, "children") &&
//         Array.isArray(b.children)
//       ) {
//         b.children = filterValidBlocks(b.children);
//       }
//       return b;
//     });
// }

// // Função principal para converter Markdown em blocos do Notion
// async function markdownToNotionBlocks(markdown, dirName, parentPageId) {
//   const { frontmatter, content } = extractFrontmatter(markdown);
//   const blocks = [];

//   // Adicionar blocos de frontmatter se configurado para preservar
//   if (config.preserveFrontmatter && Object.keys(frontmatter).length > 0) {
//     blocks.push({
//       object: "block",
//       type: "code",
//       code: {
//         rich_text: [
//           {
//             type: "text",
//             text: {
//               content: "---\n" + yaml.stringify(frontmatter) + "---",
//             },
//           },
//         ],
//         language: "yaml",
//       },
//     });
//     // Adicionar um separador após o frontmatter
//     blocks.push({
//       object: "block",
//       type: "divider",
//       divider: {},
//     });
//   }
//   // Processar diagramas Mermaid se configurado
//   if (config.renderMermaidDiagrams && containsMermaidDiagram(content)) {
//     const diagrams = extractMermaidDiagram(content);
//     diagrams.forEach((diagram) => {
//       // Dividir diagrama em blocos de até 2000 caracteres
//       const maxLen = 2000;
//       for (let i = 0; i < diagram.length; i += maxLen) {
//         blocks.push({
//           object: "block",
//           type: "code",
//           code: {
//             rich_text: [
//               {
//                 type: "text",
//                 text: {
//                   content: diagram.slice(i, i + maxLen),
//                 },
//               },
//             ],
//             language: "mermaid",
//           },
//         });
//       }
//     });
//   }
//   // Tokenizar o Markdown
//   const tokens = marked.lexer(content);
//   // Converter tokens em blocos do Notion
//   for (const [idx, token] of tokens.entries()) {
//     let block = undefined;
//     switch (token.type) {
//       case "heading":
//         block = headingToNotionBlock(token);
//         break;
//       case "paragraph":
//         block = await paragraphToNotionBlock(token, dirName, parentPageId);
//         break;
//       case "list":
//         block = await listToNotionBlocks(token, dirName, parentPageId);
//         break;
//       case "code":
//         block = codeToNotionBlock(token);
//         break;
//       case "blockquote":
//         block = await blockquoteToNotionBlock(token, dirName, parentPageId);
//         break;
//       case "table":
//         block = await tableToNotionBlock(token, dirName, parentPageId);
//         break;
//       case "hr":
//         block = hrToNotionBlock();
//         break;
//       case "image":
//         block = imageToNotionBlock(token);
//         break;
//       case "space":
//         // Ignorar tokens de espaço
//         break;
//       default:
//         console.warn(`Tipo de token não suportado: ${token.type}`);
//     }
//     if (block === undefined) {
//       console.warn(
//         `[DEBUG] Token gerou bloco undefined no índice ${idx}:`,
//         JSON.stringify(token, null, 2)
//       );
//     }
//     if (Array.isArray(block)) {
//       block.forEach((b) => {
//         if (b) blocks.push(b);
//       });
//     } else if (block) {
//       blocks.push(block);
//     }
//   }
//   // Filtrar blocos inválidos antes de retornar (recursivo)
//   const validBlocks = filterValidBlocks(blocks);
//   return { blocks: validBlocks, frontmatter };
// }

// Função para processar um arquivo Markdown
// async function processMarkdownFile(filePath) {
//   try {
//     const content = fs.readFileSync(filePath, "utf8");
//     return markdownToBlocks(content);
//   } catch (error) {
//     console.error(
//       `Erro ao processar arquivo Markdown ${filePath}:`,
//       error.message
//     );
//     throw error;
//   }
// }

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

    const newRichTextArr =
      (await richTextArr?.map(async (rt) => {
        if (
          rt.type !== "text" ||
          !rt?.text?.link ||
          !rt?.text?.link?.url?.endsWith(".md")
        )
          return rt;
        const linkPath = rt.text.link.url;
        const baseDir = returnBaseDir(fileDir, linkPath);
        if (!baseDir) return rt;
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

    return {
      ...block,
      [richTextType]: { rich_text: await Promise.all(newRichTextArr) },
    };
  };
}

// Função para garantir que todos os blocos de código tenham language definido
function ensureCodeBlockLanguage(blocks) {
  for (const block of blocks) {
    if (block.type === "code" && block.code) {
      if (!block.code.language) {
        block.code.language = "plain text";
      }
    }
    if (block.children && Array.isArray(block.children)) {
      ensureCodeBlockLanguage(block.children);
    }
  }
  return blocks;
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
        await normalizeBlockPageLinks(filePath, parentPageId)(block)
      );
    }
    // Garante que todos os blocos de código tenham language definido
    return ensureCodeBlockLanguage(resultBlocks);
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
