const test = require('node:test');
const assert = require('node:assert/strict');
const { buildExecutiveHtml } = require('../src/template');

test('buildExecutiveHtml deve injetar classes temáticas corretamente', () => {
  const htmlCorp = buildExecutiveHtml({ content: '<p>Teste</p>', theme: 'corporate' });
  assert.equal(htmlCorp.includes('class="theme-corporate"'), true);

  const htmlEmerald = buildExecutiveHtml({ content: '<p>Teste</p>', theme: 'emerald' });
  assert.equal(htmlEmerald.includes('class="theme-emerald"'), true);
});

test('buildExecutiveHtml deve renderizar a capa executiva quando solicitada', () => {
  const html = buildExecutiveHtml({
    content: '<p>Conteúdo</p>',
    title: 'Plano Diretor de TI',
    org: 'Acme Corp',
    department: 'Engenharia de Software',
    logo: 'https://acme.com/logo.png',
    cover: {
      author: 'Diretoria de Tecnologia',
      version: '2.0'
    }
  });

  assert.equal(html.includes('class="cover-page"'), true);
  assert.equal(html.includes('Plano Diretor de TI'), true);
  assert.equal(html.includes('Acme Corp'), true);
  assert.equal(html.includes('Engenharia de Software'), true);
  assert.equal(html.includes('https://acme.com/logo.png'), true);
  assert.equal(html.includes('Diretoria de Tecnologia'), true);
  assert.equal(html.includes('v2.0'), true);
});

test('buildExecutiveHtml deve injetar tag base quando baseDir for especificado', () => {
  const html = buildExecutiveHtml({
    content: '<p>Teste</p>',
    baseDir: 'C:/docs/projetos'
  });

  assert.equal(html.includes('<base href="file:///'), true);
  assert.equal(html.includes('C:/docs/projetos'), true);
});
