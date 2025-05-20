const { marked } = require("marked");
const { markedHighlight } = require("marked-highlight");
const { gfmHeadingId } = require("marked-gfm-heading-id");
const { mangle } = require("marked-mangle");
const hljs = require("highlight.js");
const cheerio = require("cheerio");
const yaml = require("yaml");
const fs = require("fs");
const path = require("path");
const config = require("./config");

// Configurar o marked com os plugins necessários
marked.use(
  markedHighlight({
    highlight: (code, language) => {
      if (language && hljs.getLanguage(language)) {
        return hljs.highlight(code, { language }).value;
      }
      return hljs.highlightAuto(code).value;
    },
  }),
  gfmHeadingId(),
  mangle()
);

// Adicionar referência ao pageIdMap (será setado pelo file-processor)
let pageIdMap = null;
function setPageIdMap(map) {
  pageIdMap = map;
}

// Função para extrair o frontmatter do markdown
function extractFrontmatter(content) {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
  const match = content.match(frontmatterRegex);

  if (match) {
    try {
      const frontmatter = yaml.parse(match[1]);
      const contentWithoutFrontmatter = content
        .replace(frontmatterRegex, "")
        .trim();
      return { frontmatter, content: contentWithoutFrontmatter };
    } catch (error) {
      console.warn("Erro ao parsear frontmatter:", error.message);
      return { frontmatter: {}, content };
    }
  }

  return { frontmatter: {}, content };
}

// Converter um token do tipo heading para um bloco de título do Notion
function headingToNotionBlock(token) {
  // O Notion só suporta heading_1, heading_2 e heading_3
  const level = Math.min(token.depth, 3);
  const text = token.text;

  return {
    object: "block",
    type: `heading_${level}`,
    [`heading_${level}`]: {
      rich_text: [
        {
          type: "text",
          text: {
            content: text,
          },
        },
      ],
    },
  };
}

// Converter um token do tipo paragraph para um bloco de parágrafo do Notion
function paragraphToNotionBlock(token, fileDir = "") {
  const $ = cheerio.load(token.text);
  const blocks = [];
  const richText = [];

  function processNode(node) {
    if (node.type === "text") {
      const content = node.data;
      if (content.trim() === "") return;
      richText.push({
        type: "text",
        text: {
          content,
        },
      });
    } else if (node.type === "tag") {
      let annotations = {};
      let text = "";
      $(node)
        .contents()
        .each((_, child) => {
          if (child.type === "text") {
            text += child.data;
          } else if (child.type === "tag") {
            text += $(child).text();
          }
        });
      if (text.trim() === "") return;
      switch (node.name) {
        case "strong":
        case "b":
          annotations.bold = true;
          break;
        case "em":
        case "i":
          annotations.italic = true;
          break;
        case "u":
          annotations.underline = true;
          break;
        case "s":
        case "del":
          annotations.strikethrough = true;
          break;
        case "code":
          annotations.code = true;
          break;
        case "a": {
          const href = $(node).attr("href") || "";
          if (href.endsWith(".md") && pageIdMap) {
            // Link interno
            const resolved = path.resolve(fileDir, href);
            const pageInfo = pageIdMap.get(resolved);
            if (pageInfo && pageInfo.id) {
              // Bloco de link_to_page
              blocks.push({
                object: "block",
                type: "link_to_page",
                link_to_page: {
                  type: "page_id",
                  page_id: pageInfo.id,
                },
              });
              return;
            } else {
              // Se não encontrou, apenas texto
              richText.push({
                type: "text",
                text: {
                  content: text,
                },
                annotations,
              });
              return;
            }
          } else if (
            href.startsWith("http://") ||
            href.startsWith("https://")
          ) {
            // Link externo
            richText.push({
              type: "text",
              text: {
                content: text,
                link: { url: href },
              },
              annotations,
            });
            return;
          } else {
            // Outro tipo de link
            richText.push({
              type: "text",
              text: {
                content: text,
              },
              annotations,
            });
            return;
          }
        }
      }
      richText.push({
        type: "text",
        text: {
          content: text,
        },
        annotations,
      });
    }
  }

  $("body")
    .contents()
    .each((_, node) => {
      processNode(node);
    });

  if (blocks.length > 0) {
    // Se houver blocos link_to_page, retornar todos (um para cada link)
    return blocks.concat([
      {
        object: "block",
        type: "paragraph",
        paragraph: {
          rich_text:
            richText.length > 0
              ? richText
              : [{ type: "text", text: { content: "" } }],
        },
      },
    ]);
  }

  return {
    object: "block",
    type: "paragraph",
    paragraph: {
      rich_text:
        richText.length > 0
          ? richText
          : [{ type: "text", text: { content: "" } }],
    },
  };
}

// Converter um token do tipo list para um bloco de lista do Notion
function listToNotionBlocks(token) {
  const blocks = [];
  const listType = token.ordered ? "numbered_list_item" : "bulleted_list_item";

  token.items.forEach((item) => {
    const $ = cheerio.load(item.text);
    const richText = [];

    $("body")
      .contents()
      .each((_, node) => {
        if (node.type === "text") {
          richText.push({
            type: "text",
            text: {
              content: node.data,
            },
          });
        } else if (node.type === "tag") {
          let annotations = {};
          const text = $(node).text();

          switch (node.name) {
            case "strong":
            case "b":
              annotations.bold = true;
              break;
            case "em":
            case "i":
              annotations.italic = true;
              break;
            case "code":
              annotations.code = true;
              break;
          }

          richText.push({
            type: "text",
            text: {
              content: text,
            },
            annotations,
          });
        }
      });

    blocks.push({
      object: "block",
      type: listType,
      [listType]: {
        rich_text:
          richText.length > 0
            ? richText
            : [{ type: "text", text: { content: "" } }],
      },
    });
  });

  return blocks;
}

// Converter um token do tipo code para um bloco de código do Notion
function codeToNotionBlock(token) {
  const maxLen = 2000;
  const code = token.text || "";
  const lang = token.lang || "plain text";
  const blocks = [];
  for (let i = 0; i < code.length; i += maxLen) {
    blocks.push({
      object: "block",
      type: "code",
      code: {
        rich_text: [
          {
            type: "text",
            text: {
              content: code.slice(i, i + maxLen),
            },
          },
        ],
        language: lang,
      },
    });
  }
  return blocks.length === 1 ? blocks[0] : blocks;
}

// Converter um token do tipo blockquote para um bloco de citação do Notion
function blockquoteToNotionBlock(token) {
  const $ = cheerio.load(token.text);
  const richText = [];

  $("body")
    .contents()
    .each((_, node) => {
      if (node.type === "text") {
        richText.push({
          type: "text",
          text: {
            content: node.data,
          },
        });
      }
    });

  return {
    object: "block",
    type: "quote",
    quote: {
      rich_text:
        richText.length > 0
          ? richText
          : [{ type: "text", text: { content: "" } }],
    },
  };
}

// Converter um token do tipo table para um bloco de tabela do Notion
function tableToNotionBlock(token) {
  const rows = [];

  // Função utilitária para extrair texto puro de uma célula
  function extractCellText(cell) {
    if (typeof cell === "string") return cell;
    if (cell && typeof cell === "object") {
      if (cell.text) return cell.text;
      if (cell.raw) return cell.raw;
      if (cell.tokens && Array.isArray(cell.tokens)) {
        return cell.tokens.map((t) => t.raw || t.text || "").join("");
      }
    }
    return String(cell);
  }

  // Adicionar cabeçalho
  if (token.header && token.header.length > 0) {
    const headerCells = token.header.map((cell) => [
      {
        type: "text",
        text: {
          content: extractCellText(cell),
        },
      },
    ]);
    rows.push(headerCells);
  }

  // Adicionar linhas
  token.rows.forEach((row) => {
    const cells = row.map((cell) => [
      {
        type: "text",
        text: {
          content: extractCellText(cell),
        },
      },
    ]);
    rows.push(cells);
  });

  return {
    object: "block",
    type: "table",
    table: {
      table_width: token.header
        ? token.header.length
        : token.rows[0]
        ? token.rows[0].length
        : 1,
      has_column_header: token.header && token.header.length > 0,
      has_row_header: false,
      children: rows.map((row) => ({
        type: "table_row",
        table_row: {
          cells: row,
        },
      })),
    },
  };
}

// Converter um token do tipo hr para um bloco de separador do Notion
function hrToNotionBlock() {
  return {
    object: "block",
    type: "divider",
    divider: {},
  };
}

// Converter um token do tipo image para um bloco de imagem do Notion
function imageToNotionBlock(token) {
  const isExternalImage = token.href.startsWith("http");

  if (isExternalImage) {
    return {
      object: "block",
      type: "image",
      image: {
        type: "external",
        external: {
          url: token.href,
        },
        caption: token.title
          ? [{ type: "text", text: { content: token.title } }]
          : [],
      },
    };
  } else {
    // Para imagens locais, seria necessário fazer upload para o Notion ou para um servidor externo
    console.warn(
      `Imagem local não pode ser processada diretamente: ${token.href}`
    );
    return {
      object: "block",
      type: "paragraph",
      paragraph: {
        rich_text: [
          {
            type: "text",
            text: {
              content: `[Imagem local: ${token.href}]`,
            },
            annotations: {
              italic: true,
              color: "gray",
            },
          },
        ],
      },
    };
  }
}

// Verificar se o conteúdo contém um diagrama Mermaid
function containsMermaidDiagram(content) {
  return content.includes("```mermaid") || content.includes("```Mermaid");
}

// Extrair diagrama Mermaid do conteúdo
function extractMermaidDiagram(content) {
  const mermaidRegex = /```mermaid\n([\s\S]*?)```/gi;
  const matches = [];
  let match;

  while ((match = mermaidRegex.exec(content)) !== null) {
    matches.push(match[1].trim());
  }

  return matches;
}

// Função utilitária para filtrar blocos válidos recursivamente
function filterValidBlocks(blocks) {
  if (!Array.isArray(blocks)) return [];
  return blocks
    .filter((b) => b && typeof b === "object")
    .map((b) => {
      // Se for um bloco de lista, pode conter children
      if (
        Object.prototype.hasOwnProperty.call(b, "children") &&
        Array.isArray(b.children)
      ) {
        b.children = filterValidBlocks(b.children);
      }
      return b;
    });
}

// Função principal para converter Markdown em blocos do Notion
function markdownToNotionBlocks(markdown, fileDir = "", rootDir = "") {
  const { frontmatter, content } = extractFrontmatter(markdown);
  const blocks = [];

  // Adicionar blocos de frontmatter se configurado para preservar
  if (config.preserveFrontmatter && Object.keys(frontmatter).length > 0) {
    blocks.push({
      object: "block",
      type: "code",
      code: {
        rich_text: [
          {
            type: "text",
            text: {
              content: "---\n" + yaml.stringify(frontmatter) + "---",
            },
          },
        ],
        language: "yaml",
      },
    });

    // Adicionar um separador após o frontmatter
    blocks.push({
      object: "block",
      type: "divider",
      divider: {},
    });
  }

  // Processar diagramas Mermaid se configurado
  if (config.renderMermaidDiagrams && containsMermaidDiagram(content)) {
    const diagrams = extractMermaidDiagram(content);

    diagrams.forEach((diagram) => {
      // Dividir diagrama em blocos de até 2000 caracteres
      const maxLen = 2000;
      for (let i = 0; i < diagram.length; i += maxLen) {
        blocks.push({
          object: "block",
          type: "code",
          code: {
            rich_text: [
              {
                type: "text",
                text: {
                  content: diagram.slice(i, i + maxLen),
                },
              },
            ],
            language: "mermaid",
          },
        });
      }
    });
  }

  // Tokenizar o Markdown
  const tokens = marked.lexer(content);

  // Converter tokens em blocos do Notion
  tokens.forEach((token, idx) => {
    let block = undefined;
    switch (token.type) {
      case "heading":
        block = headingToNotionBlock(token);
        break;
      case "paragraph":
        block = paragraphToNotionBlock(token, fileDir, rootDir);
        break;
      case "list":
        block = listToNotionBlocks(token);
        break;
      case "code":
        block = codeToNotionBlock(token);
        break;
      case "blockquote":
        block = blockquoteToNotionBlock(token);
        break;
      case "table":
        block = tableToNotionBlock(token);
        break;
      case "hr":
        block = hrToNotionBlock();
        break;
      case "image":
        block = imageToNotionBlock(token);
        break;
      case "space":
        // Ignorar tokens de espaço
        break;
      default:
        console.warn(`Tipo de token não suportado: ${token.type}`);
    }
    if (block === undefined) {
      console.warn(
        `[DEBUG] Token gerou bloco undefined no índice ${idx}:`,
        JSON.stringify(token, null, 2)
      );
    }
    if (Array.isArray(block)) {
      block.forEach((b) => {
        if (b) blocks.push(b);
      });
    } else if (block) {
      blocks.push(block);
    }
  });

  // Filtrar blocos inválidos antes de retornar (recursivo)
  const validBlocks = filterValidBlocks(blocks);
  return { blocks: validBlocks, frontmatter };
}

// Função para processar um arquivo Markdown
function processMarkdownFile(filePath, fileDir = "") {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    return markdownToNotionBlocks(content, fileDir, "");
  } catch (error) {
    console.error(
      `Erro ao processar arquivo Markdown ${filePath}:`,
      error.message
    );
    throw error;
  }
}

module.exports = {
  markdownToNotionBlocks,
  processMarkdownFile,
  extractFrontmatter,
  setPageIdMap,
};
