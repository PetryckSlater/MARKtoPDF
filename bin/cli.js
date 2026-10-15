#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const { program } = require('commander');
const { convertMarkdownToPdf, findBrowserExecutable } = require('../src/index');

program
  .name('md2pdf')
  .description('Converte documentos Markdown para relatórios executivos em PDF A4 com Mermaid e CSS de alta definição')
  .version('1.1.0')
  .argument('<arquivo-markdown>', 'Caminho do arquivo Markdown de entrada (.md)')
  .option('-o, --output <caminho>', 'Caminho do arquivo PDF de saída (padrão: mesmo nome com .pdf)')
  .option('-t, --title <titulo>', 'Título do relatório executivo')
  .option('--org <instituicao>', 'Nome da organização para o cabeçalho', 'OAB-PB | Infraestrutura e Operações')
  .option('--theme <tema>', 'Tema visual: corporate (azul), slate (grafite), emerald (verde), burgundy (vinho)', 'corporate')
  .option('--toc', 'Gera automaticamente um Sumário Executivo navegável a partir dos títulos H2/H3', false)
  .option('--cover', 'Gera uma folha de rosto/capa executiva formal antes do conteúdo', false)
  .option('--author <autor>', 'Nome do autor/responsável exibido na capa', 'DevOps & Engenharia de Infraestrutura')
  .option('--version-doc <versao>', 'Versão do documento para exibição na capa', '1.0')
  .option('--page-numbers', 'Ativa rodapé oficial com numeração "Página X de Y" em todas as folhas', false)
  .option('--no-header', 'Desativa o cabeçalho executivo institucional estático')
  .option('-k, --keep-html', 'Preserva o arquivo HTML intermediário gerado')
  .option('-w, --wait <ms>', 'Tempo de espera manual (ms) para o Mermaid e fontes renderizarem')
  .option('-b, --browser <caminho>', 'Caminho manual para o executável do Edge ou Chrome')
  .option('--landscape', 'Gera o PDF em orientação paisagem (horizontal)')
  .option('--allow-unsafe-html', 'Permite tags HTML sem sanitização de segurança', false)
  .action(async (inputFile, options) => {
    const startTime = Date.now();

    try {
      const resolvedInput = path.resolve(inputFile);
      if (!fs.existsSync(resolvedInput)) {
        console.error(`\x1b[31m[ERRO]\x1b[0m Arquivo não encontrado: ${resolvedInput}`);
        process.exit(1);
      }

      console.log('\x1b[36m=========================================================\x1b[0m');
      console.log('\x1b[1m\x1b[34m  MD2PDF EXECUTIVE v1.1.0\x1b[0m \x1b[90m- Relatórios Técnicos em A4\x1b[0m');
      console.log('\x1b[36m=========================================================\x1b[0m');

      // Localiza motor de renderização
      const browserExe = findBrowserExecutable(options.browser);
      console.log(`\x1b[32m✔\x1b[0m Motor detectado:     \x1b[33m${path.basename(browserExe)}\x1b[0m (${browserExe})`);
      console.log(`\x1b[32m✔\x1b[0m Arquivo de entrada:  \x1b[37m${path.basename(resolvedInput)}\x1b[0m`);
      console.log(`\x1b[32m✔\x1b[0m Tema visual:         \x1b[35m${options.theme.toUpperCase()}\x1b[0m`);

      const activeFeatures = [];
      if (options.toc) activeFeatures.push('Sumário (TOC)');
      if (options.cover) activeFeatures.push('Capa Executiva');
      if (options.pageNumbers) activeFeatures.push('Numeração Página X de Y');
      if (options.landscape) activeFeatures.push('Modo Paisagem');
      if (activeFeatures.length > 0) {
        console.log(`\x1b[32m✔\x1b[0m Recursos ativados:   \x1b[36m${activeFeatures.join(' | ')}\x1b[0m`);
      }

      const waitMs = options.wait ? parseInt(options.wait, 10) : undefined;
      console.log(`\x1b[90m⏳ 1ª Etapa: Processando Markdown e interceptando sintaxe executiva...\x1b[0m`);
      console.log(`\x1b[90m⏳ 2ª Etapa: Injetando Print CSS A4 (tema: ${options.theme}, anti-scroll)...\x1b[0m`);
      console.log(`\x1b[90m⏳ 3ª Etapa: Invocando Chromium Headless (${options.browser ? options.browser : 'Edge/Chrome'})...\x1b[0m`);

      const coverConfig = options.cover ? {
        author: options.author,
        version: options.versionDoc
      } : false;

      const result = await convertMarkdownToPdf(resolvedInput, options.output, {
        title: options.title,
        org: options.org,
        theme: options.theme,
        showHeader: options.header,
        toc: options.toc,
        cover: coverConfig,
        pageNumbers: options.pageNumbers,
        keepHtml: options.keepHtml,
        virtualTimeBudget: waitMs,
        browserPath: options.browser,
        landscape: options.landscape,
        allowUnsafeHtml: options.allowUnsafeHtml
      });

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      const sizeKb = (result.size / 1024).toFixed(1);

      console.log('\x1b[32m=========================================================\x1b[0m');
      console.log(`\x1b[1m\x1b[32m✔ PDF EXECUTIVO GERADO COM SUCESSO!\x1b[0m`);
      console.log(`\x1b[37m📄 Destino:   \x1b[1m${result.pdfPath}\x1b[0m`);
      console.log(`\x1b[37m📊 Tamanho:   \x1b[33m${sizeKb} KB\x1b[0m`);
      console.log(`\x1b[37m⚡ Tempo:     \x1b[36m${elapsed}s\x1b[0m`);
      if (result.hasMermaid) {
        console.log(`\x1b[37m📐 Mermaid:   \x1b[32m${result.mermaidCount} diagrama(s) renderizado(s)\x1b[0m`);
      } else {
        console.log(`\x1b[37m🚀 Modo:      \x1b[90mTurbo (sem diagramas, execução acelerada)\x1b[0m`);
      }
      if (result.htmlPath) {
        console.log(`\x1b[37m🌐 HTML:      \x1b[90m${result.htmlPath}\x1b[0m`);
      }
      console.log('\x1b[32m=========================================================\x1b[0m');

    } catch (err) {
      console.error('\n\x1b[31m[FALHA NA GERAÇÃO DO PDF]\x1b[0m');
      console.error(err.message);
      process.exit(1);
    }
  });

program.parse(process.argv);
