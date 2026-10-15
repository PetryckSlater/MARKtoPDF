const test = require('node:test');
const assert = require('node:assert/strict');
const { parseMarkdown, slugify, sanitizeUnsafeTags } = require('../src/parser');

test('slugify deve normalizar acentos e caracteres especiais', () => {
  assert.equal(slugify('1. Topologia da Arquitetura & Backup!'), '1-topologia-da-arquitetura-backup');
  assert.equal(slugify('Automação com Ansible'), 'automacao-com-ansible');
  assert.equal(slugify(''), 'secao');
});

test('sanitizeUnsafeTags deve neutralizar tags de script e iframes perigosos', () => {
  const unsafe = 'Texto normal <script>alert("xss")</script> e <iframe src="file:///etc/passwd"></iframe> final';
  const clean = sanitizeUnsafeTags(unsafe);
  assert.equal(clean.includes('<script>'), false);
  assert.equal(clean.includes('<iframe'), false);
  assert.equal(clean.includes('Texto normal'), true);
});

test('parseMarkdown deve detectar título H1 e blocos Mermaid', () => {
  const md = `# Documento Técnico de Teste

Introdução ao sistema.

\`\`\`mermaid
flowchart TD
  A --> B
\`\`\`

## 1. Primeira Seção
Texto da seção.
`;

  const result = parseMarkdown(md);
  assert.equal(result.title, 'Documento Técnico de Teste');
  assert.equal(result.hasMermaid, true);
  assert.equal(result.mermaidCount, 1);
  assert.equal(result.html.includes('id="mermaid-diagram-1"'), true);
  assert.equal(result.tocItems.length, 2); // H1 + H2
});

test('parseMarkdown deve converter <!-- pagebreak --> em div apropriada', () => {
  const md = `Seção 1\n\n<!-- pagebreak -->\n\nSeção 2`;
  const result = parseMarkdown(md);
  assert.equal(result.html.includes('<div class="page-break"></div>'), true);
});

test('parseMarkdown deve formatar alertas GFM com títulos executivos', () => {
  const md = `> [!IMPORTANT]\n> Alerta crítico de segurança.`;
  const result = parseMarkdown(md);
  assert.equal(result.html.includes('callout-caution'), true);
  assert.equal(result.html.includes('IMPORTANTE'), true);
});

test('parseMarkdown deve gerar Sumário Executivo quando solicitado', () => {
  const md = `# Título Principal\n\n## 1. Infraestrutura\n\n### 1.1 Kubernetes\n\n## 2. Monitoramento`;
  const result = parseMarkdown(md, { toc: true });
  assert.equal(result.html.includes('class="executive-toc"'), true);
  assert.equal(result.html.includes('SUMÁRIO EXECUTIVO'), true);
  assert.equal(result.html.includes('href="#1-infraestrutura"'), true);
  assert.equal(result.html.includes('href="#1-1-kubernetes"'), true);
});
