document.addEventListener('DOMContentLoaded', () => {
  const markdownEditor = document.getElementById('markdownEditor');
  const previewFrame = document.getElementById('previewFrame');
  const previewStatus = document.getElementById('previewStatus');
  const mermaidStatusBadge = document.getElementById('mermaidStatusBadge');
  const charCount = document.getElementById('charCount');
  const engineStatus = document.getElementById('engineStatus');
  const a4Simulator = document.getElementById('a4Simulator');
  
  const btnSample = document.getElementById('btnSample');
  const btnClear = document.getElementById('btnClear');
  const btnExportHtml = document.getElementById('btnExportHtml');
  const btnGeneratePdf = document.getElementById('btnGeneratePdf');
  const btnRefreshPreview = document.getElementById('btnRefreshPreview');
  const btnOpenNewTab = document.getElementById('btnOpenNewTab');
  
  const fileInput = document.getElementById('fileInput');
  const btnUpload = document.getElementById('btnUpload');
  const dropOverlay = document.getElementById('dropOverlay');
  const editorWrapper = document.querySelector('.editor-wrapper');
  
  const selectTheme = document.getElementById('selectTheme');
  const selectOrientation = document.getElementById('selectOrientation');
  const inputOrg = document.getElementById('inputOrg');
  const inputDepartment = document.getElementById('inputDepartment');
  const inputLogo = document.getElementById('inputLogo');
  const inputTitle = document.getElementById('inputTitle');
  const checkHeader = document.getElementById('checkHeader');
  const checkPageNumbers = document.getElementById('checkPageNumbers');
  const checkCover = document.getElementById('checkCover');
  const checkToc = document.getElementById('checkToc');
  
  const loadingModal = document.getElementById('loadingModal');
  const loadingStage = document.getElementById('loadingStage');

  let previewTimeout = null;
  let currentPreviewHtml = '';
  let currentZoom = 1.0;

  // 1. Checa status do motor Chromium Headless
  async function checkEngineStatus() {
    try {
      const res = await fetch('/api/status');
      const data = await res.json();
      if (data.status === 'ready') {
        engineStatus.classList.remove('loading');
        engineStatus.innerHTML = `<span class="dot"></span><span>${data.browser} Headless Ativo (v${data.version || '1.1'})</span>`;
      } else {
        engineStatus.innerHTML = `<span class="dot" style="background:#ef4444"></span><span>Motor Indisponível</span>`;
      }
    } catch (e) {
      engineStatus.innerHTML = `<span class="dot" style="background:#ef4444"></span><span>Erro ao conectar ao motor</span>`;
    }
  }

  // 2. Carrega documento de exemplo
  async function loadSample() {
    try {
      previewStatus.textContent = 'Carregando exemplo...';
      const res = await fetch('/api/sample');
      const data = await res.json();
      if (data.markdown) {
        markdownEditor.value = data.markdown;
        updateCharCount();
        triggerPreviewUpdate(true);
      }
    } catch (e) {
      console.error('Falha ao carregar exemplo:', e);
    }
  }

  // 3. Atualiza contagem de caracteres
  function updateCharCount() {
    const len = markdownEditor.value.length;
    charCount.textContent = `${len.toLocaleString('pt-BR')} caracteres`;
  }

  // 4. Inserção de Snippets no cursor
  function insertSnippet(type) {
    const snippets = {
      'alert-note': '> [!NOTE]\n> Insira a descrição da recomendação ou nota técnica aqui.\n\n',
      'mermaid-flow': '```mermaid\nflowchart TD\n    A[Início do Processo] --> B[Validação de Segurança]\n    B -->|Aprovado| C[Execução em Produção]\n    B -->|Reprovado| D[Notificar Engenharia]\n```\n\n',
      'code-bash': '```bash\n# Procedimento operacional padrão\nset -euo pipefail\necho "[$(date)] Executando rotina..."\n```\n\n',
      'table': '| Recurso / Servidor | Ambiente | Status | Janela |\n| :--- | :--- | :--- | :--- |\n| Cluster MySQL GLPI | Produção | Ativo | 02:00 BRT |\n| Storage Bucket S3 | Nuvem | Sincronizado | 24h |\n\n',
      'pagebreak': '\n\n<!-- pagebreak -->\n\n',
      'toc': '\n\n[TOC]\n\n',
      'checklist': '- [x] Homologação em ambiente de testes concluída\n- [ ] Validação de integridade SHA256\n- [ ] Rollout do backup em produção\n\n'
    };

    const textToInsert = snippets[type];
    if (!textToInsert) return;

    const start = markdownEditor.selectionStart;
    const end = markdownEditor.selectionEnd;
    const currentVal = markdownEditor.value;

    markdownEditor.value = currentVal.substring(0, start) + textToInsert + currentVal.substring(end);
    markdownEditor.selectionStart = markdownEditor.selectionEnd = start + textToInsert.length;
    markdownEditor.focus();

    updateCharCount();
    triggerPreviewUpdate();
  }

  document.querySelectorAll('.snippet-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const snippetType = btn.getAttribute('data-snippet');
      insertSnippet(snippetType);
    });
  });

  // 5. Controles de Zoom da Folha A4
  document.querySelectorAll('.zoom-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.zoom-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      currentZoom = parseFloat(btn.getAttribute('data-zoom')) || 1.0;
      a4Simulator.style.transform = `scale(${currentZoom})`;
    });
  });

  // 6. Atualização da Pré-visualização Executiva (Debounced)
  function triggerPreviewUpdate(immediate = false) {
    if (previewTimeout) clearTimeout(previewTimeout);
    previewStatus.textContent = 'Renderizando...';

    if (immediate) {
      renderPreview();
    } else {
      previewTimeout = setTimeout(renderPreview, 500);
    }
  }

  async function renderPreview() {
    const md = markdownEditor.value;
    if (!md.trim()) {
      previewFrame.srcdoc = '<div style="padding: 40px; text-align: center; color: #64748b; font-family: sans-serif;">Cole ou digite seu Markdown no painel à esquerda para visualizar aqui.</div>';
      previewStatus.textContent = 'Vazio';
      mermaidStatusBadge.style.display = 'none';
      return;
    }

    try {
      const response = await fetch('/api/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          markdown: md,
          title: inputTitle.value.trim() || undefined,
          org: inputOrg.value.trim() || undefined,
          department: inputDepartment.value.trim() || undefined,
          logo: inputLogo.value.trim() || undefined,
          theme: selectTheme.value,
          showHeader: checkHeader.checked,
          toc: checkToc.checked,
          cover: checkCover.checked
        })
      });

      const data = await response.json();
      if (data.html) {
        currentPreviewHtml = data.html;
        previewFrame.srcdoc = data.html;
        previewStatus.textContent = 'Sincronizado';

        if (data.hasMermaid) {
          mermaidStatusBadge.textContent = `${data.mermaidCount} Mermaid`;
          mermaidStatusBadge.style.display = 'inline-block';
        } else {
          mermaidStatusBadge.style.display = 'none';
        }
      }
    } catch (err) {
      previewStatus.textContent = 'Erro';
      console.error('Erro na pré-visualização:', err);
    }
  }

  // 7. Exportação Direta de HTML Autônomo
  async function exportHtml() {
    const md = markdownEditor.value;
    if (!md.trim()) {
      alert('Por favor, digite ou importe um documento Markdown antes de exportar o HTML.');
      return;
    }

    try {
      const payload = {
        markdown: md,
        title: inputTitle.value.trim() || undefined,
        org: inputOrg.value.trim() || undefined,
        department: inputDepartment.value.trim() || undefined,
        logo: inputLogo.value.trim() || undefined,
        theme: selectTheme.value,
        showHeader: checkHeader.checked,
        toc: checkToc.checked,
        cover: checkCover.checked,
        filename: 'relatorio_executivo'
      };

      const res = await fetch('/api/export-html', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Falha ao exportar HTML');

      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;

      const safeTitle = (inputTitle.value.trim() || 'Relatorio_Executivo')
        .replace(/[^a-zA-Z0-9_\u00C0-\u00FF]/g, '_')
        .substring(0, 40);
      a.download = `${safeTitle}.html`;

      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      alert(`Falha ao exportar HTML:\n${err.message}`);
    }
  }

  // 8. Geração e Download do PDF Executivo
  async function generatePdf() {
    const md = markdownEditor.value;
    if (!md.trim()) {
      alert('Por favor, digite ou importe um documento Markdown antes de gerar o PDF.');
      return;
    }

    loadingModal.classList.add('active');
    loadingStage.textContent = '1/3 Processando blocos de código e diagramas Mermaid...';

    const stageTimer1 = setTimeout(() => {
      loadingStage.textContent = '2/3 Invocando Microsoft Edge Headless com motor de renderização...';
    }, 1200);

    const stageTimer2 = setTimeout(() => {
      loadingStage.textContent = '3/3 Aplicando gabarito A4, numeração de páginas e gerando PDF...';
    }, 3200);

    try {
      const payload = {
        markdown: md,
        title: inputTitle.value.trim() || undefined,
        org: inputOrg.value.trim() || undefined,
        department: inputDepartment.value.trim() || undefined,
        logo: inputLogo.value.trim() || undefined,
        theme: selectTheme.value,
        showHeader: checkHeader.checked,
        toc: checkToc.checked,
        cover: checkCover.checked,
        pageNumbers: checkPageNumbers.checked,
        landscape: selectOrientation.value === 'landscape'
      };

      const res = await fetch('/api/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Erro HTTP ${res.status}`);
      }

      // Converte resposta binária para blob e dispara download automático
      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;

      const safeTitle = (inputTitle.value.trim() || 'Relatorio_Executivo')
        .replace(/[^a-zA-Z0-9_\u00C0-\u00FF]/g, '_')
        .substring(0, 40);
      a.download = `${safeTitle}.pdf`;

      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);

    } catch (err) {
      alert(`Falha ao gerar PDF:\n${err.message}`);
    } finally {
      clearTimeout(stageTimer1);
      clearTimeout(stageTimer2);
      loadingModal.classList.remove('active');
    }
  }

  // 9. Manipulação de Arquivo e Drag & Drop
  btnUpload.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) readFile(file);
  });

  function readFile(file) {
    const reader = new FileReader();
    reader.onload = (event) => {
      markdownEditor.value = event.target.result;
      updateCharCount();
      triggerPreviewUpdate(true);
    };
    reader.readAsText(file);
  }

  // Drag & Drop no editor
  editorWrapper.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropOverlay.classList.add('active');
  });

  dropOverlay.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dropOverlay.classList.remove('active');
  });

  dropOverlay.addEventListener('drop', (e) => {
    e.preventDefault();
    dropOverlay.classList.remove('active');
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      readFile(e.dataTransfer.files[0]);
    }
  });

  // 10. Event Listeners dos Controles
  markdownEditor.addEventListener('input', () => {
    updateCharCount();
    triggerPreviewUpdate();
  });

  // Suporte a tecla Tab no editor de Markdown
  markdownEditor.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = markdownEditor.selectionStart;
      const end = markdownEditor.selectionEnd;
      markdownEditor.value = markdownEditor.value.substring(0, start) + '  ' + markdownEditor.value.substring(end);
      markdownEditor.selectionStart = markdownEditor.selectionEnd = start + 2;
    }
  });

  btnSample.addEventListener('click', loadSample);
  
  btnClear.addEventListener('click', () => {
    if (confirm('Deseja realmente limpar o editor?')) {
      markdownEditor.value = '';
      updateCharCount();
      triggerPreviewUpdate(true);
    }
  });

  btnRefreshPreview.addEventListener('click', () => triggerPreviewUpdate(true));
  btnExportHtml.addEventListener('click', exportHtml);
  btnGeneratePdf.addEventListener('click', generatePdf);

  btnOpenNewTab.addEventListener('click', () => {
    if (currentPreviewHtml) {
      const win = window.open('', '_blank');
      win.document.write(currentPreviewHtml);
      win.document.close();
    }
  });

  // Atualiza prévia quando opções de configuração mudam
  selectTheme.addEventListener('change', () => triggerPreviewUpdate(true));
  inputOrg.addEventListener('input', () => triggerPreviewUpdate());
  inputDepartment.addEventListener('input', () => triggerPreviewUpdate());
  inputLogo.addEventListener('input', () => triggerPreviewUpdate());
  inputTitle.addEventListener('input', () => triggerPreviewUpdate());
  checkHeader.addEventListener('change', () => triggerPreviewUpdate(true));
  checkToc.addEventListener('change', () => triggerPreviewUpdate(true));
  checkCover.addEventListener('change', () => triggerPreviewUpdate(true));

  // Inicialização imediata
  checkEngineStatus();
  loadSample();
});
