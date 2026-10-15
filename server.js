const express = require('express');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const multer = require('multer');
const { convertMarkdownToPdf, markdownToHtml, findBrowserExecutable } = require('./src/index');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuração do multer para upload de arquivos .md temporários
const upload = multer({
  dest: path.join(os.tmpdir(), 'md2pdf_uploads'),
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB
});

// Middleware para JSON e dados de formulário com limite amplo
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Arquivos estáticos da interface web
app.use(express.static(path.join(__dirname, 'public')));

// Rota de status do sistema e motor detectado
app.get('/api/status', (req, res) => {
  try {
    const browserPath = findBrowserExecutable();
    res.json({
      status: 'ready',
      version: '1.1.0',
      browser: path.basename(browserPath),
      browserPath,
      themes: ['corporate', 'slate', 'emerald', 'burgundy']
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: err.message
    });
  }
});

// Rota para carregar o arquivo de exemplo (BACKUP.md)
app.get('/api/sample', (req, res) => {
  const samplePath = path.join(__dirname, 'BACKUP.md');
  if (fs.existsSync(samplePath)) {
    const markdown = fs.readFileSync(samplePath, 'utf8');
    res.json({ markdown, filename: 'BACKUP.md' });
  } else {
    res.status(404).json({ error: 'Arquivo de exemplo não encontrado' });
  }
});

// Rota para pré-visualização HTML imediata
app.post('/api/preview', (req, res) => {
  try {
    const {
      markdown = '',
      title,
      org,
      department,
      logo,
      theme = 'corporate',
      showHeader = true,
      toc = false,
      cover = false
    } = req.body;

    const { html, title: detectedTitle, hasMermaid, mermaidCount, tocItems } = markdownToHtml(markdown, {
      title,
      org: org || 'Organização / Empresa',
      department,
      logo,
      theme,
      showHeader: showHeader === true || showHeader === 'true',
      toc: toc === true || toc === 'true',
      cover: cover === true || cover === 'true'
    });

    res.json({
      html,
      title: detectedTitle,
      hasMermaid,
      mermaidCount,
      tocCount: tocItems ? tocItems.length : 0
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Rota para exportar diretamente o HTML autônomo (Single-File)
app.post('/api/export-html', (req, res) => {
  try {
    const {
      markdown = '',
      title,
      org,
      department,
      logo,
      theme = 'corporate',
      showHeader = true,
      toc = false,
      cover = false,
      filename
    } = req.body;

    const { html, title: detectedTitle } = markdownToHtml(markdown, {
      title,
      org: org || 'Organização / Empresa',
      department,
      logo,
      theme,
      showHeader: showHeader === true || showHeader === 'true',
      toc: toc === true || toc === 'true',
      cover: cover === true || cover === 'true'
    });

    const safeTitle = (title || detectedTitle || filename || 'relatorio_executivo')
      .replace(/[^a-zA-Z0-9_\u00C0-\u00FF]/g, '_')
      .substring(0, 40);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(safeTitle)}.html"`);
    res.send(html);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Rota de conversão para PDF com isolamento criptográfico de UUID temporário
app.post('/api/convert', upload.single('file'), async (req, res) => {
  let tempInputPath = null;
  let tempPdfPath = null;

  try {
    let markdownContent = '';
    let originalName = 'documento.pdf';

    if (req.file) {
      tempInputPath = req.file.path;
      markdownContent = fs.readFileSync(tempInputPath, 'utf8');
      originalName = req.file.originalname.replace(/\.md$/i, '') + '.pdf';
    } else if (req.body.markdown) {
      markdownContent = req.body.markdown;
      const baseName = req.body.filename ? req.body.filename.replace(/\.md$/i, '') : 'relatorio_executivo';
      originalName = `${baseName}.pdf`;
      tempInputPath = path.join(os.tmpdir(), `md2pdf_${crypto.randomUUID()}_input.md`);
      fs.writeFileSync(tempInputPath, markdownContent, 'utf8');
    } else {
      return res.status(400).json({ error: 'Nenhum conteúdo Markdown ou arquivo foi enviado.' });
    }

    tempPdfPath = path.join(os.tmpdir(), `md2pdf_${crypto.randomUUID()}_out.pdf`);

    const title = req.body.title || undefined;
    const org = req.body.org || 'Organização / Empresa';
    const department = req.body.department || undefined;
    const logo = req.body.logo || undefined;
    const theme = req.body.theme || 'corporate';
    const showHeader = req.body.showHeader !== 'false' && req.body.showHeader !== false;
    const toc = req.body.toc === 'true' || req.body.toc === true;
    const cover = req.body.cover === 'true' || req.body.cover === true;
    const pageNumbers = req.body.pageNumbers === 'true' || req.body.pageNumbers === true;
    const landscape = req.body.landscape === 'true' || req.body.landscape === true;
    const waitMs = req.body.wait ? parseInt(req.body.wait, 10) : undefined;

    // Executa a conversão completa através do Edge/Chrome
    await convertMarkdownToPdf(tempInputPath, tempPdfPath, {
      title,
      org,
      department,
      logo,
      theme,
      showHeader,
      toc,
      cover,
      pageNumbers,
      landscape,
      virtualTimeBudget: waitMs
    });

    if (!fs.existsSync(tempPdfPath)) {
      throw new Error('Falha: O PDF não foi gerado pelo processo do navegador.');
    }

    const stat = fs.statSync(tempPdfPath);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(originalName)}"`);

    const stream = fs.createReadStream(tempPdfPath);
    stream.pipe(res);

    stream.on('close', () => {
      // Limpeza de arquivos temporários
      try { if (tempInputPath && fs.existsSync(tempInputPath)) fs.unlinkSync(tempInputPath); } catch (_) {}
      try { if (tempPdfPath && fs.existsSync(tempPdfPath)) fs.unlinkSync(tempPdfPath); } catch (_) {}
    });

  } catch (err) {
    console.error('Erro na conversão:', err);
    try { if (tempInputPath && fs.existsSync(tempInputPath)) fs.unlinkSync(tempInputPath); } catch (_) {}
    try { if (tempPdfPath && fs.existsSync(tempPdfPath)) fs.unlinkSync(tempPdfPath); } catch (_) {}
    res.status(500).json({ error: err.message });
  }
});

// Inicialização do servidor
if (require.main === module) {
  app.listen(PORT, () => {
    console.log('\x1b[36m=========================================================\x1b[0m');
    console.log('\x1b[1m\x1b[34m  MD2PDF EXECUTIVE v1.1.0 - SERVIDOR WEB ATIVO\x1b[0m');
    console.log('\x1b[36m=========================================================\x1b[0m');
    console.log(`\x1b[32m✔\x1b[0m Interface Web rodando em: \x1b[1m\x1b[37mhttp://localhost:${PORT}\x1b[0m`);
    try {
      const browser = findBrowserExecutable();
      console.log(`\x1b[32m✔\x1b[0m Motor Headless ativo:     \x1b[33m${path.basename(browser)}\x1b[0m (${browser})`);
    } catch (e) {
      console.warn(`\x1b[33m⚠ Aviso:\x1b[0m ${e.message}`);
    }
    console.log('\x1b[36m=========================================================\x1b[0m');
  });
}

module.exports = app;
