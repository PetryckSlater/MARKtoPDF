const { Marked } = require('marked');

/**
 * Escapa caracteres HTML para exibição segura em blocos de código
 */
function escapeHtml(html) {
  return String(html)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Gera identificador seguro (slug) para âncoras de títulos
 */
function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/<[^>]+>/g, '') // remove tags html
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'secao';
}

/**
 * Neutraliza scripts e elementos perigosos de Markdown não confiável
 */
function sanitizeUnsafeTags(html) {
  return String(html)
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^>]*\bsrc\s*=\s*['"]?file:[^>]*>/gi, '')
    .replace(/\son\w+\s*=\s*['"][^'"]*['"]/gi, ''); // remove inline event handlers como onclick
}

/**
 * Gera a marcação HTML para o Sumário Executivo (TOC)
 * @param {Array<{ depth: number, text: string, slug: string }>} tocItems
 * @returns {string}
 */
function generateTocHtml(tocItems) {
  if (!tocItems || tocItems.length === 0) return '';

  // Filtra apenas H2 e H3 para um sumário executivo conciso
  const filtered = tocItems.filter(item => item.depth === 2 || item.depth === 3);
  if (filtered.length === 0) return '';

  const listItems = filtered.map(item => {
    const depthClass = item.depth === 3 ? 'toc-h3' : 'toc-h2';
    const badge = item.depth === 3 ? 'Sub' : 'Cap';
    return `
      <li class="toc-item ${depthClass}">
        <a href="#${item.slug}">
          <span class="toc-bullet">&bull;</span>
          <span class="toc-label">${escapeHtml(item.text)}</span>
          <span class="toc-spacer"></span>
          <span class="toc-tag">${badge}</span>
        </a>
      </li>`;
  }).join('');

  return `
<nav class="executive-toc" id="sumario-executivo">
  <div class="toc-header">
    <div class="toc-badge-icon">📑</div>
    <div class="toc-header-text">
      <div class="toc-title">SUMÁRIO EXECUTIVO</div>
      <div class="toc-sub">Índice navegável do documento técnico</div>
    </div>
  </div>
  <ul class="toc-list">
    ${listItems}
  </ul>
</nav>\n`;
}

/**
 * Cria o parser do Marked configurado com interceptador de Mermaid,
 * blocos de código com estilo terminal, alertas GFM e identificadores de títulos
 */
function createExecutiveParser(state = {}) {
  const marked = new Marked();
  state.mermaidCount = 0;
  state.tocItems = [];
  const usedSlugs = new Set();

  marked.use({
    renderer: {
      heading(tokenOrText, levelParam) {
        let text = '';
        let depth = 2;

        if (typeof tokenOrText === 'object' && tokenOrText !== null) {
          text = tokenOrText.text || '';
          depth = tokenOrText.depth || 2;
        } else {
          text = String(tokenOrText || '');
          depth = levelParam || 2;
        }

        // Gera slug único para cada título
        let rawSlug = slugify(text);
        let slug = rawSlug;
        let counter = 1;
        while (usedSlugs.has(slug)) {
          slug = `${rawSlug}-${counter}`;
          counter++;
        }
        usedSlugs.add(slug);

        state.tocItems.push({
          depth,
          text: text.replace(/<[^>]+>/g, '').trim(),
          slug
        });

        // H1 tem estilo executivo especial e âncora
        return `<h${depth} id="${slug}">${text}</h${depth}>\n`;
      },

      code(codeOrToken, infoString) {
        let text = '';
        let lang = '';

        if (typeof codeOrToken === 'object' && codeOrToken !== null) {
          text = codeOrToken.text || '';
          lang = (codeOrToken.lang || '').trim().toLowerCase();
        } else {
          text = String(codeOrToken || '');
          lang = (infoString || '').trim().toLowerCase();
        }

        // 1ª Etapa: Intercepta blocos 'mermaid' para renderização dinâmica via CDN
        if (lang === 'mermaid') {
          state.mermaidCount++;
          return `
<div class="mermaid-wrapper">
  <div class="mermaid" id="mermaid-diagram-${state.mermaidCount}">
${text}
  </div>
</div>\n`;
        }

        // Blocos comuns (bash, yaml, sql, dockerfile, json, etc.) ganham estrutura de terminal executivo
        const displayLang = lang ? lang.toUpperCase() : 'TERMINAL';
        const safeCode = escapeHtml(text);

        return `
<div class="code-card">
  <div class="code-header">
    <div class="terminal-dots">
      <span class="terminal-dot"></span>
      <span class="terminal-dot"></span>
      <span class="terminal-dot"></span>
    </div>
    <span class="code-lang">${displayLang}</span>
  </div>
  <pre><code class="language-${lang || 'plaintext'}">${safeCode}</code></pre>
</div>\n`;
      },

      table(headerOrToken, body) {
        if (typeof headerOrToken === 'object' && headerOrToken !== null && headerOrToken.header) {
          const token = headerOrToken;
          const headerRows = token.header.map(cell => {
            const inner = this.parser && this.parser.parseInline ? this.parser.parseInline(cell.tokens || []) : cell.text;
            return `<th>${inner || cell.text}</th>`;
          }).join('');

          const bodyRows = token.rows.map(row => {
            const cells = row.map(cell => {
              const inner = this.parser && this.parser.parseInline ? this.parser.parseInline(cell.tokens || []) : cell.text;
              return `<td>${inner || cell.text}</td>`;
            }).join('');
            return `<tr>${cells}</tr>`;
          }).join('\n');

          return `<div class="table-wrapper">\n<table><thead><tr>${headerRows}</tr></thead><tbody>${bodyRows}</tbody></table>\n</div>\n`;
        }

        return `<div class="table-wrapper">\n<table><thead>${headerOrToken}</thead><tbody>${body}</tbody></table>\n</div>\n`;
      },

      blockquote(quoteOrToken) {
        let text = '';
        if (typeof quoteOrToken === 'object' && quoteOrToken !== null) {
          text = quoteOrToken.text || '';
        } else {
          text = String(quoteOrToken || '');
        }

        // Suporte para [!NOTE], [!TIP], [!WARNING], [!CAUTION], [!IMPORTANT]
        const rawAlert = text.match(/\[!(NOTE|TIP|WARNING|CAUTION|IMPORTANT)\]([\s\S]*)/i);
        if (rawAlert) {
          const type = rawAlert[1].toLowerCase();
          const cleanText = rawAlert[2].trim();
          const innerHtml = marked.parse(cleanText);

          const titles = {
            note: 'INFORMAÇÃO / NOTA',
            tip: 'DICA DE OPERAÇÃO',
            warning: 'ATENÇÃO',
            caution: 'CUIDADO',
            important: 'IMPORTANTE'
          };
          const cssClass = (type === 'important' || type === 'caution') ? 'callout-caution' : (type === 'tip' ? 'callout-tip' : (type === 'warning' ? 'callout-warning' : 'callout-note'));

          return `
<div class="callout ${cssClass}">
  <div class="callout-title">${titles[type] || 'AVISO'}</div>
  ${innerHtml}
</div>\n`;
        }

        return `<blockquote>\n${marked.parse(text)}\n</blockquote>\n`;
      }
    }
  });

  return marked;
}

/**
 * Converte Markdown para fragmento HTML e extrai metadados completos
 * 
 * @param {string} markdownContent Conteúdo do documento Markdown
 * @param {object} [options] Opções de processamento
 * @param {boolean} [options.toc=false] Injeta sumário executivo automaticamente se não houver [TOC]
 * @param {boolean} [options.allowUnsafeHtml=false] Permite tags de scripts/iframes não sanitizadas
 * @returns {{ title: string|null, html: string, hasMermaid: boolean, mermaidCount: number, tocItems: Array }}
 */
function parseMarkdown(markdownContent, options = {}) {
  const state = { mermaidCount: 0, tocItems: [] };
  const parser = createExecutiveParser(state);

  let processedMd = String(markdownContent || '');

  // 1. Suporte a quebras manuais de página: <!-- pagebreak -->, <!-- newpage --> ou \pagebreak
  processedMd = processedMd.replace(/<!--\s*(pagebreak|newpage)\s*-->|\\pagebreak/gi, '\n\n<div class="page-break"></div>\n\n');

  // 2. Extrai o primeiro H1 como título do documento, se existir
  const h1Match = processedMd.match(/^#\s+(.+)$/m);
  const detectedTitle = h1Match ? h1Match[1].replace(/<[^>]+>/g, '').trim() : null;

  // 3. Processa Markdown via Marked
  let htmlContent = parser.parse(processedMd);

  // 4. Sanitização contra tags maliciosas se não configurado como unsafe
  if (!options.allowUnsafeHtml) {
    htmlContent = sanitizeUnsafeTags(htmlContent);
  }

  // 5. Tratamento de [TOC] ou injeção automática de Sumário
  const hasTocPlaceholder = /<p>\s*\[TOC\]\s*<\/p>|\[TOC\]/i.test(htmlContent);
  const shouldIncludeToc = hasTocPlaceholder || Boolean(options.toc);

  if (shouldIncludeToc && state.tocItems.length > 0) {
    const tocHtml = generateTocHtml(state.tocItems);
    if (hasTocPlaceholder) {
      htmlContent = htmlContent.replace(/<p>\s*\[TOC\]\s*<\/p>|\[TOC\]/gi, tocHtml);
    } else if (options.toc) {
      // Injeta logo após o primeiro <h1> ou no topo
      if (/<h1[^>]*>[\s\S]*?<\/h1>/i.test(htmlContent)) {
        htmlContent = htmlContent.replace(/(<h1[^>]*>[\s\S]*?<\/h1>)/i, `$1\n${tocHtml}`);
      } else {
        htmlContent = `${tocHtml}\n${htmlContent}`;
      }
    }
  }

  return {
    title: detectedTitle,
    html: htmlContent,
    hasMermaid: state.mermaidCount > 0,
    mermaidCount: state.mermaidCount,
    tocItems: state.tocItems
  };
}

module.exports = {
  createExecutiveParser,
  parseMarkdown,
  escapeHtml,
  slugify,
  generateTocHtml,
  sanitizeUnsafeTags
};
