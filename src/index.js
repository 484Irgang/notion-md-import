const { processFiles } = require('./file-processor')
const { markdownToNotionBlocks, processMarkdownFile } = require('./markdown-processor')
const { notion, createPage, appendBlocks } = require('./notion-client')
const config = require('./config')

module.exports = {
  processFiles,
  markdownToNotionBlocks,
  processMarkdownFile,
  notion,
  createPage,
  appendBlocks,
  config
}
