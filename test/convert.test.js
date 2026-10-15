const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { convertMarkdownToPdf, findBrowserExecutable } = require('../src/index');

test('findBrowserExecutable deve localizar um navegador Chromium no sistema', () => {
  const exe = findBrowserExecutable();
  assert.ok(exe);
  assert.ok(fs.existsSync(exe));
});

test('convertMarkdownToPdf deve converter markdown sem Mermaid em modo turbo', async () => {
  const tmpMd = path.join(os.tmpdir(), `test_md_${crypto.randomUUID()}.md`);
  const tmpPdf = path.join(os.tmpdir(), `test_out_${crypto.randomUUID()}.pdf`);

  fs.writeFileSync(tmpMd, '# Teste Rápido\n\nEste é um teste automatizado.\n\n```bash\necho "OK"\n```', 'utf8');

  try {
    const result = await convertMarkdownToPdf(tmpMd, tmpPdf, {
      title: 'Teste Automatizado',
      theme: 'corporate',
      pageNumbers: true
    });

    assert.ok(fs.existsSync(result.pdfPath));
    assert.ok(result.size > 5000);
    assert.equal(result.hasMermaid, false);
  } finally {
    try { if (fs.existsSync(tmpMd)) fs.unlinkSync(tmpMd); } catch (_) {}
    try { if (fs.existsSync(tmpPdf)) fs.unlinkSync(tmpPdf); } catch (_) {}
  }
});
