const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { parseMarkdown } = require('./parser');
const { buildExecutiveHtml } = require('./template');
const { printHtmlToPdf, findBrowserExecutable } = require('./browser');

/**
 * Converte uma string Markdown diretamente para um documento HTML executivo estruturado
 * 
 * @param {string} markdownText Conteúdo em Markdown
 * @param {object} [options] Opções de cabeçalho, tema, sumário e capa
 * @param {string} [options.title] Título customizado do documento
 * @param {string} [options.org] Nome da organização/departamento no cabeçalho
 * @param {string} [options.theme='corporate'] Tema visual ('corporate' | 'slate' | 'emerald' | 'burgundy')
 * @param {boolean} [options.showHeader=true] Exibe o cabeçalho executivo institucional
 * @param {boolean} [options.toc=false] Gera o sumário executivo automaticamente
 * @param {boolean|object} [options.cover=false] Gera a capa executiva formal
 * @param {string} [options.baseDir] Diretório base para resolução de imagens locais
 * @param {boolean} [options.allowUnsafeHtml=false] Permite tags de scripts/iframes sem sanitização
 * @returns {{ html: string, title: string, hasMermaid: boolean, mermaidCount: number, tocItems: Array }}
 */
function markdownToHtml(markdownText, options = {}) {
  const {
    title: parsedTitle,
    html: contentHtml,
    hasMermaid,
    mermaidCount,
    tocItems
  } = parseMarkdown(markdownText, {
    toc: options.toc ?? false,
    allowUnsafeHtml: options.allowUnsafeHtml ?? false
  });

  const title = options.title || parsedTitle || 'Relatório Executivo';

  const fullHtml = buildExecutiveHtml({
    content: contentHtml,
    title,
    org: options.org,
    theme: options.theme || 'corporate',
    showHeader: options.showHeader ?? true,
    cover: options.cover ?? false,
    baseDir: options.baseDir,
    hasMermaid
  });

  return {
    html: fullHtml,
    title,
    hasMermaid,
    mermaidCount,
    tocItems
  };
}

/**
 * Pipeline completo: Converte um arquivo Markdown em um relatório PDF A4 de alta resolução
 * 
 * @param {string} inputPath Caminho do arquivo Markdown (.md) de entrada
 * @param {string} [outputPath] Caminho do PDF de saída (se omitido, usa o mesmo nome do input com .pdf)
 * @param {object} [options] Opções adicionais
 * @param {string} [options.title] Título customizado do documento
 * @param {string} [options.org] Nome da organização/departamento no cabeçalho
 * @param {string} [options.theme='corporate'] Tema visual ('corporate' | 'slate' | 'emerald' | 'burgundy')
 * @param {boolean} [options.toc=false] Gera sumário executivo automaticamente
 * @param {boolean|object} [options.cover=false] Gera capa de rosto executiva
 * @param {boolean} [options.pageNumbers=false] Ativa rodapé nativo com numeração "Página X de Y"
 * @param {boolean} [options.keepHtml=false] Preserva o arquivo HTML intermediário
 * @param {number} [options.virtualTimeBudget] Tempo (ms) para execução de JS (Mermaid/Highlight)
 * @param {string} [options.browserPath] Caminho manual para o executável do Microsoft Edge ou Chrome
 * @param {boolean} [options.landscape=false] Imprime em modo paisagem
 * @param {boolean} [options.allowUnsafeHtml=false] Permite HTML sem sanitização
 * @returns {Promise<{ pdfPath: string, size: number, browser: string, elapsedMs: number, hasMermaid: boolean, mermaidCount: number, htmlPath?: string }>}
 */
async function convertMarkdownToPdf(inputPath, outputPath, options = {}) {
  const resolvedInput = path.resolve(inputPath);
  if (!fs.existsSync(resolvedInput)) {
    throw new Error(`Arquivo Markdown não encontrado: ${resolvedInput}`);
  }

  const defaultPdfPath = resolvedInput.replace(/\.md$/i, '') + '.pdf';
  const resolvedPdf = path.resolve(outputPath || defaultPdfPath);

  // Isolamento seguro de arquivo temporário via UUID no os.tmpdir()
  // Evita erros de gravação em diretórios somente-leitura e previne colisões de concorrência
  const uniqueId = crypto.randomUUID();
  const tempHtmlPath = options.keepHtml
    ? resolvedInput.replace(/\.md$/i, '') + '.tmp.html'
    : path.join(os.tmpdir(), `md2pdf_${uniqueId}.html`);

  const markdownContent = fs.readFileSync(resolvedInput, 'utf8');
  const baseDir = path.dirname(resolvedInput);

  // 1ª Etapa: Parser Inteligente (intercepta Mermaid, blocos de código e TOC)
  // 2ª Etapa: Engenharia de CSS para Impressão (A4, anti-scroll, temas corporativos)
  const { html, title, hasMermaid, mermaidCount } = markdownToHtml(markdownContent, {
    title: options.title,
    org: options.org,
    theme: options.theme,
    showHeader: options.showHeader,
    toc: options.toc,
    cover: options.cover,
    baseDir: options.baseDir || baseDir,
    allowUnsafeHtml: options.allowUnsafeHtml
  });

  fs.writeFileSync(tempHtmlPath, html, 'utf8');

  try {
    // 3ª Etapa: Motor Chromium Headless (Microsoft Edge / Chrome)
    const result = await printHtmlToPdf(tempHtmlPath, resolvedPdf, {
      virtualTimeBudget: options.virtualTimeBudget,
      browserPath: options.browserPath,
      landscape: options.landscape ?? false,
      pageNumbers: options.pageNumbers ?? false,
      title,
      org: options.org,
      hasMermaid
    });

    result.hasMermaid = hasMermaid;
    result.mermaidCount = mermaidCount;

    if (options.keepHtml) {
      result.htmlPath = tempHtmlPath;
    }

    return result;
  } finally {
    // Limpeza garantida de arquivos temporários
    if (!options.keepHtml && fs.existsSync(tempHtmlPath)) {
      try {
        fs.unlinkSync(tempHtmlPath);
      } catch (_) {}
    }
  }
}

module.exports = {
  convertMarkdownToPdf,
  markdownToHtml,
  findBrowserExecutable
};
