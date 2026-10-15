const fs = require('fs');
const path = require('path');

const CSS_PATH = path.join(__dirname, 'styles', 'executive.css');

/**
 * Cores temáticas para os diagramas Mermaid alinhadas aos temas CSS
 */
const MERMAID_PALETTES = {
  corporate: {
    primary: '#0047AB',
    primaryText: '#FFFFFF',
    primaryBorder: '#002D62',
    secondary: '#EBF3FA',
    tertiary: '#F4F7FB'
  },
  slate: {
    primary: '#334155',
    primaryText: '#FFFFFF',
    primaryBorder: '#0F172A',
    secondary: '#F1F5F9',
    tertiary: '#F8FAFC'
  },
  emerald: {
    primary: '#059669',
    primaryText: '#FFFFFF',
    primaryBorder: '#064E3B',
    secondary: '#ECFDF5',
    tertiary: '#F0FDF4'
  },
  burgundy: {
    primary: '#881337',
    primaryText: '#FFFFFF',
    primaryBorder: '#4C0519',
    secondary: '#FFF1F2',
    tertiary: '#FFF5F5'
  }
};

/**
 * Gera a capa executiva formal
 */
function buildCoverPageHtml({ title, org, coverOptions, dateFormatted }) {
  const subtitle = coverOptions.subtitle || 'Relatório Técnico e Procedimento Operacional Padrão';
  const author = coverOptions.author || 'Equipe de DevOps & Engenharia de Infraestrutura';
  const version = coverOptions.version || '1.0';
  const classification = coverOptions.classification || 'CONFIDENCIAL / USO INTERNO';

  return `
  <section class="cover-page">
    <div class="cover-header">
      <div class="cover-org">${org}</div>
      <div class="cover-department">DIRETORIA DE TECNOLOGIA & INFRAESTRUTURA</div>
    </div>

    <div class="cover-body">
      <div class="cover-badge">${classification}</div>
      <h1 class="cover-title">${title}</h1>
      <div class="cover-subtitle">${subtitle}</div>

      <div class="cover-metadata-card">
        <div class="meta-item">
          <span class="meta-label">Responsável Técnico</span>
          <span class="meta-value">${author}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Data de Emissão</span>
          <span class="meta-value">${dateFormatted}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Versão do Documento</span>
          <span class="meta-value">v${version}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Status do Procedimento</span>
          <span class="meta-value">Homologado</span>
        </div>
      </div>
    </div>

    <div class="cover-footer">
      <span>${org} &bull; Documento Oficial</span>
      <span>Gabarito A4 Corporativo</span>
    </div>
  </section>
  `;
}

/**
 * Gera o documento HTML5 completo e estruturado para impressão em A4
 * 
 * @param {object} params
 * @param {string} params.content Fragmento HTML processado
 * @param {string} [params.title] Título do documento
 * @param {string} [params.org="OAB-PB | Infraestrutura e Operações"] Nome da instituição/empresa
 * @param {string} [params.theme="corporate"] Tema visual ('corporate' | 'slate' | 'emerald' | 'burgundy')
 * @param {boolean} [params.showHeader=true] Se deve exibir o cabeçalho executivo institucional
 * @param {boolean|object} [params.cover=false] Adiciona folha de rosto/capa executiva
 * @param {string} [params.baseDir] Diretório base para resolução de imagens locais relativas
 * @param {boolean} [params.hasMermaid=true] Se o documento contém diagramas Mermaid
 * @returns {string} HTML completo
 */
function buildExecutiveHtml({
  content,
  title = 'Relatório Técnico Executivo',
  org = 'OAB-PB | Infraestrutura e Operações',
  theme = 'corporate',
  showHeader = true,
  cover = false,
  baseDir = null,
  hasMermaid = true
}) {
  const css = fs.readFileSync(CSS_PATH, 'utf8');
  const dateFormatted = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  const selectedPalette = MERMAID_PALETTES[theme] || MERMAID_PALETTES.corporate;
  const themeClass = `theme-${theme}`;

  // Se baseDir fornecido, cria a tag <base> para carregar imagens locais relativas sem quebrar
  const baseTag = baseDir ? `<base href="file:///${path.resolve(baseDir).replace(/\\/g, '/')}/">` : '';

  // Constrói a capa se solicitada
  const coverHtml = cover ? buildCoverPageHtml({
    title,
    org,
    coverOptions: typeof cover === 'object' ? cover : {},
    dateFormatted
  }) : '';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${baseTag}
  <title>${title}</title>

  <!-- Tipografia Executiva: Inter + JetBrains Mono com Fallbacks -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">

  <!-- Highlight.js para Sintaxe Colorida em Códigos de Terminal (Bash, Yaml, SQL, Dockerfile) -->
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>

  ${hasMermaid ? `
  <!-- Mermaid.js Oficial para Diagramas Vetoriais SVG -->
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  ` : ''}

  <!-- Engenharia de CSS para Impressão A4 -->
  <style>
${css}
  </style>

  <script>
    ${hasMermaid ? `
    // Configuração oficial Mermaid harmonizada com o tema '${theme}'
    try {
      mermaid.initialize({
        startOnLoad: false,
        theme: 'base',
        themeVariables: {
          primaryColor: '${selectedPalette.primary}',
          primaryTextColor: '${selectedPalette.primaryText}',
          primaryBorderColor: '${selectedPalette.primaryBorder}',
          lineColor: '${selectedPalette.primary}',
          secondaryColor: '${selectedPalette.secondary}',
          tertiaryColor: '${selectedPalette.tertiary}',
          mainBkg: '${selectedPalette.primary}',
          nodeBorder: '${selectedPalette.primaryBorder}',
          clusterBkg: '#F8FAFC',
          clusterBorder: '#CBD5E1',
          titleColor: '#0F172A',
          edgeLabelBackground: '#FFFFFF',
          messageTextColor: '#0F172A',
          actorBorder: '${selectedPalette.primaryBorder}',
          actorBkg: '${selectedPalette.primary}',
          actorTextColor: '${selectedPalette.primaryText}',
          actorLineColor: '${selectedPalette.primary}',
          signalColor: '${selectedPalette.primary}',
          signalTextColor: '#0F172A',
          sequenceNumberColor: '${selectedPalette.primaryText}',
          fontFamily: 'Inter, -apple-system, sans-serif',
          fontSize: '13px'
        },
        flowchart: {
          curve: 'basis',
          htmlLabels: true,
          useMaxWidth: true
        },
        sequence: {
          useMaxWidth: true,
          actorMargin: 50,
          boxMargin: 10
        }
      });
    } catch (e) {
      console.warn('Erro ao inicializar Mermaid:', e);
    }
    ` : ''}

    document.addEventListener('DOMContentLoaded', async () => {
      // 1. Highlight.js para blocos de código
      if (typeof hljs !== 'undefined') {
        hljs.highlightAll();
      }

      // 2. Renderização explícita do Mermaid com Promise de conclusão
      ${hasMermaid ? `
      if (typeof mermaid !== 'undefined') {
        try {
          await mermaid.run();
          document.body.classList.add('mermaid-rendered');
          window.__RENDER_COMPLETE__ = true;
        } catch (err) {
          console.error('Falha ao renderizar diagramas Mermaid:', err);
          window.__RENDER_COMPLETE__ = true;
        }
      } else {
        window.__RENDER_COMPLETE__ = true;
      }
      ` : `
      window.__RENDER_COMPLETE__ = true;
      `}
    });
  </script>
</head>
<body class="${themeClass}">
  ${coverHtml}

  ${showHeader && !cover ? `
  <header class="executive-header">
    <div class="org-brand">${org}</div>
    <div class="doc-meta">
      <div>DOCUMENTO TÉCNICO OFICIAL</div>
      <div>EMISSÃO: ${dateFormatted}</div>
    </div>
  </header>
  ` : ''}

  <main class="document-content">
    ${content}
  </main>

  <footer class="executive-footer">
    <span>Gerado via Motor Headless Executivo (Node.js + Edge)</span>
    <span>Página A4 &bull; Confidencialidade Interna</span>
  </footer>
</body>
</html>`;
}

module.exports = {
  buildExecutiveHtml,
  MERMAID_PALETTES
};
