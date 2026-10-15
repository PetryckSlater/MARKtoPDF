const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');

/**
 * Encontra o executável do Microsoft Edge ou Google Chrome no sistema operacional.
 * @param {string} [customPath] Caminho manual fornecido pelo usuário.
 * @returns {string} Caminho absoluto para o executável do navegador.
 */
function findBrowserExecutable(customPath) {
  if (customPath) {
    if (fs.existsSync(customPath)) return customPath;
    throw new Error(`Navegador especificado não encontrado: ${customPath}`);
  }

  const platform = process.platform;
  const candidates = [];

  if (platform === 'win32') {
    const progFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
    const progFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
    const localAppData = process.env['LocalAppData'] || '';

    // Prioridade 1: Microsoft Edge (padrão em qualquer Windows 10/11)
    candidates.push(
      path.join(progFilesX86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      path.join(progFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      path.join(localAppData, 'Microsoft', 'Edge', 'Application', 'msedge.exe')
    );

    // Prioridade 2: Google Chrome
    candidates.push(
      path.join(progFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(progFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe')
    );
  } else if (platform === 'darwin') {
    // macOS
    candidates.push(
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium'
    );
  } else {
    // Linux / BSD
    candidates.push(
      '/usr/bin/microsoft-edge',
      '/usr/bin/microsoft-edge-stable',
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium'
    );
  }

  // Verifica os caminhos fixos conhecidos
  for (const p of candidates) {
    if (p && fs.existsSync(p)) {
      return p;
    }
  }

  // Fallback: tenta localizar via comando do sistema (where no Windows ou which no Unix)
  try {
    const cmd = platform === 'win32' ? 'where.exe msedge.exe || where.exe chrome.exe' : 'which microsoft-edge || which google-chrome || which chromium';
    const result = execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim().split('\n')[0].trim();
    if (result && fs.existsSync(result)) {
      return result;
    }
  } catch (err) {
    // Silencia erro de lookup
  }

  throw new Error(
    'Nenhum navegador baseado em Chromium (Microsoft Edge ou Google Chrome) foi encontrado automaticamente.\n' +
    'Por favor, instale o Microsoft Edge/Chrome ou passe o caminho do executável com --browser <caminho>.'
  );
}

/**
 * Converte um arquivo HTML para PDF usando o motor Chromium Headless com suporte a JavaScript e CSS avançado.
 * 
 * @param {string} htmlPath Caminho para o arquivo HTML de origem.
 * @param {string} pdfPath Caminho para o arquivo PDF de destino.
 * @param {object} [options] Opções de renderização.
 * @param {number} [options.virtualTimeBudget] Tempo (ms) para esperar o Mermaid e fontes. Se omitido, calibra dinamicamente.
 * @param {boolean} [options.hasMermaid=true] Indica se o documento contém diagramas Mermaid para calibração de tempo.
 * @param {string} [options.browserPath] Caminho manual para o executável do Edge/Chrome.
 * @param {boolean} [options.landscape=false] Se verdadeiro, imprime em modo paisagem.
 * @param {boolean} [options.pageNumbers=false] Se verdadeiro, ativa rodapé nativo com numeração "Página X de Y".
 * @param {string} [options.title] Título exibido no cabeçalho nativo da página.
 * @param {string} [options.org] Instituição exibida no cabeçalho nativo da página.
 * @param {number} [options.timeout=35000] Timeout máximo em milissegundos para evitar travamentos.
 * @returns {Promise<{ pdfPath: string, size: number, browser: string, elapsedMs: number }>}
 */
function printHtmlToPdf(htmlPath, pdfPath, options = {}) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const browserExe = findBrowserExecutable(options.browserPath);
    const resolvedHtmlPath = path.resolve(htmlPath);
    const resolvedPdfPath = path.resolve(pdfPath);

    // Calibração inteligente de tempo: se não houver Mermaid, roda em modo turbo (1200ms)
    const virtualTime = options.virtualTimeBudget ?? (options.hasMermaid === false ? 1200 : 8000);

    // Converte caminho do HTML para formato de URL segura para o Chromium
    const fileUrl = 'file:///' + resolvedHtmlPath.replace(/\\/g, '/');

    const args = [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--run-all-compositor-stages-before-draw',
      `--virtual-time-budget=${virtualTime}`,
      `--print-to-pdf=${resolvedPdfPath}`
    ];

    if (options.pageNumbers) {
      // Cabeçalho e rodapé nativos do Chromium com numeração oficial de páginas
      args.push('--display-header-footer');

      const safeOrg = (options.org || 'Documento Técnico').replace(/"/g, '&quot;');
      const safeTitle = (options.title || 'Relatório Executivo').replace(/"/g, '&quot;');

      const headerTemplate = `<div style="font-size: 8px; width: 100%; display: flex; justify-content: space-between; padding: 0 15mm; color: #64748b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;"><span>${safeOrg}</span><span>${safeTitle}</span></div>`;
      const footerTemplate = `<div style="font-size: 8px; width: 100%; display: flex; justify-content: space-between; padding: 0 15mm; color: #64748b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;"><span>Confidencialidade Interna</span><span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span></div>`;

      args.push(`--header-template=${headerTemplate}`);
      args.push(`--footer-template=${footerTemplate}`);
    } else {
      args.push('--no-pdf-header-footer');
    }

    if (options.landscape) {
      args.push('--landscape');
    }

    // Passa a URL como último argumento
    args.push(fileUrl);

    let stderrOutput = '';
    const proc = spawn(browserExe, args, {
      windowsHide: true
    });

    const timeout = setTimeout(() => {
      try {
        proc.kill('SIGKILL');
      } catch (_) {}
      reject(new Error(`Timeout de renderização excedido (${options.timeout || 35000}ms). O processo do navegador foi finalizado.`));
    }, options.timeout || 35000);

    proc.stderr.on('data', chunk => {
      stderrOutput += chunk.toString();
    });

    proc.on('error', err => {
      clearTimeout(timeout);
      reject(new Error(`Falha ao iniciar o motor do navegador (${browserExe}): ${err.message}`));
    });

    proc.on('close', code => {
      clearTimeout(timeout);

      // Verifica se o arquivo PDF foi efetivamente gravado no disco
      if (fs.existsSync(resolvedPdfPath)) {
        resolve({
          pdfPath: resolvedPdfPath,
          size: fs.statSync(resolvedPdfPath).size,
          browser: path.basename(browserExe),
          elapsedMs: Date.now() - startTime
        });
      } else {
        reject(
          new Error(
            `O processo do navegador terminou (código ${code}) mas o PDF não foi gerado.\n` +
            `Log do navegador:\n${stderrOutput}`
          )
        );
      }
    });
  });
}

module.exports = {
  findBrowserExecutable,
  printHtmlToPdf
};
