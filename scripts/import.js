#!/usr/bin/env node

const { program } = require('commander')
const ora = require('ora')
const chalk = require('chalk')
const path = require('path')
const fs = require('fs')
const inquirer = require('inquirer')
const { processFiles } = require('../src/file-processor')
const config = require('../src/config')

// Configurar o Commander
program
  .name('notion-md-import')
  .description('Importa arquivos Markdown para o Notion mantendo a estrutura de diretórios')
  .version('1.0.0')
  .option('-p, --path <path>', 'Caminho para a pasta de documentação', config.docsPath)
  .option('-r, --root-page <id>', 'ID da página raiz no Notion', config.notionRootPageId)
  .option('-k, --api-key <key>', 'Chave de API do Notion', config.notionApiKey)
  .option('-d, --delay <ms>', 'Atraso entre requisições em milissegundos', config.requestDelayMs.toString())
  .option(
    '-c, --concurrent <num>',
    'Número máximo de requisições concorrentes',
    config.maxConcurrentRequests.toString()
  )
  .option('-m, --mermaid', 'Renderizar diagramas Mermaid', config.renderMermaidDiagrams)
  .option('-f, --preserve-frontmatter', 'Preservar frontmatter nos documentos', config.preserveFrontmatter)
  .option('-y, --yes', 'Pular confirmações')
  .action(async options => {
    // Atualizar configurações com as opções da linha de comando
    config.docsPath = options.path || config.docsPath
    config.notionRootPageId = options.rootPage || config.notionRootPageId
    config.notionApiKey = options.apiKey || config.notionApiKey
    config.requestDelayMs = parseInt(options.delay || config.requestDelayMs, 10)
    config.maxConcurrentRequests = parseInt(options.concurrent || config.maxConcurrentRequests, 10)
    config.renderMermaidDiagrams =
      options.mermaid !== undefined ? options.mermaid : config.renderMermaidDiagrams
    config.preserveFrontmatter =
      options.preserveFrontmatter !== undefined ? options.preserveFrontmatter : config.preserveFrontmatter

    // Validar configurações obrigatórias
    if (!config.notionApiKey) {
      console.error(chalk.red('Erro: Chave de API do Notion não fornecida.'))
      console.log('Defina a chave de API usando a opção --api-key ou a variável de ambiente NOTION_API_KEY.')
      process.exit(1)
    }

    if (!config.notionRootPageId) {
      console.error(chalk.red('Erro: ID da página raiz do Notion não fornecido.'))
      console.log(
        'Defina o ID da página raiz usando a opção --root-page ou a variável de ambiente NOTION_ROOT_PAGE_ID.'
      )
      process.exit(1)
    }

    // Resolver caminho absoluto para a pasta de documentação
    const docsPath = path.resolve(process.cwd(), config.docsPath)

    // Verificar se o diretório existe
    if (!fs.existsSync(docsPath)) {
      console.error(chalk.red(`Erro: Diretório não encontrado: ${docsPath}`))
      process.exit(1)
    }

    // Mostrar configurações
    console.log(chalk.blue('Configurações:'))
    console.log(`- Pasta de documentação: ${chalk.green(docsPath)}`)
    console.log(`- ID da página raiz: ${chalk.green(config.notionRootPageId)}`)
    console.log(`- Chave de API: ${chalk.green('*'.repeat(5) + config.notionApiKey.slice(-4))}`)
    console.log(`- Atraso entre requisições: ${chalk.green(config.requestDelayMs)}ms`)
    console.log(`- Requisições concorrentes: ${chalk.green(config.maxConcurrentRequests)}`)
    console.log(
      `- Renderizar diagramas Mermaid: ${chalk.green(config.renderMermaidDiagrams ? 'Sim' : 'Não')}`
    )
    console.log(`- Preservar frontmatter: ${chalk.green(config.preserveFrontmatter ? 'Sim' : 'Não')}`)

    // Pedir confirmação antes de prosseguir
    if (!options.yes) {
      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: 'Deseja prosseguir com a importação?',
          default: true
        }
      ])

      if (!confirm) {
        console.log(chalk.yellow('Importação cancelada.'))
        process.exit(0)
      }
    }

    // Iniciar a importação
    const spinner = ora('Importando arquivos para o Notion...').start()

    try {
      const success = await processFiles(docsPath, config.notionRootPageId)

      if (success) {
        spinner.succeed(chalk.green('Importação concluída com sucesso!'))
      } else {
        spinner.fail(chalk.red('Importação falhou.'))
        process.exit(1)
      }
    } catch (error) {
      spinner.fail(chalk.red(`Erro durante a importação: ${error.message}`))
      process.exit(1)
    }
  })

// Executar o programa
program.parse(process.argv)
