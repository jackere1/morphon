// ── State ──
const state = {
  showMeta: null,       // Object (show-level meta)
  scenes: [],           // [{name, transition, yaml}]
  activeSceneIndex: 0,
};

// ── Elements ──
const promptInput = document.getElementById('prompt-input');
const generateBtn = document.getElementById('generate-btn');
const generateStatus = document.getElementById('generate-status');
const presetSelect = document.getElementById('preset-select');
const metaSection = document.getElementById('meta-section');
const metaToggle = document.getElementById('meta-toggle');
const metaEditorWrap = document.getElementById('meta-editor-wrap');
const metaEditor = document.getElementById('meta-editor');
const scenesSection = document.getElementById('scenes-section');
const sceneTabsEl = document.getElementById('scene-tabs');
const sceneEditor = document.getElementById('scene-editor');
const renderBtn = document.getElementById('render-btn');
const statusMsg = document.getElementById('status-message');
const progressContainer = document.getElementById('progress-bar-container');
const progressBar = document.getElementById('progress-bar');
const progressText = document.getElementById('progress-text');
const videoPlayer = document.getElementById('video-player');
const downloadLink = document.getElementById('download-link');
const warningsArea = document.getElementById('warnings-area');

// ── Tab indentation for textareas ──
function enableTabKey(el) {
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = el.selectionStart;
      const end = el.selectionEnd;
      el.value = el.value.substring(0, start) + '  ' + el.value.substring(end);
      el.selectionStart = el.selectionEnd = start + 2;
    }
  });
}
enableTabKey(metaEditor);
enableTabKey(sceneEditor);

// ── Meta toggle (collapse/expand) ──
metaToggle.addEventListener('click', () => {
  const icon = metaToggle.querySelector('.toggle-icon');
  metaEditorWrap.classList.toggle('collapsed');
  icon.classList.toggle('collapsed');
});

// ── Generate with AI ──
generateBtn.addEventListener('click', async () => {
  const prompt = promptInput.value.trim();
  if (!prompt) {
    showGenerateStatus('Please enter a description.', true);
    return;
  }

  generateBtn.disabled = true;
  generateBtn.textContent = 'Generating...';
  showGenerateStatus('Calling AI... this may take 10-30 seconds.');
  showStatus('Generating scenes with AI...', 'generating');

  try {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({prompt}),
    });

    const data = await res.json();

    if (!res.ok) {
      showGenerateStatus(data.error || 'Generation failed.', true);
      showStatus('Generation failed.', 'error');
      return;
    }

    // Load the generated show into state
    loadShow(data.show);

    // Show warnings if any
    if (data.warnings && data.warnings.length > 0) {
      showWarnings(data.warnings);
    }

    showGenerateStatus(`Generated ${state.scenes.length} scenes! Review and edit below, then click Render.`);
    showStatus('Scenes generated. Edit if needed, then render.', 'done');
  } catch (err) {
    showGenerateStatus(`Network error: ${err.message}`, true);
    showStatus('Generation failed.', 'error');
  } finally {
    generateBtn.disabled = false;
    generateBtn.textContent = 'Generate';
  }
});

function showGenerateStatus(msg, isError = false) {
  generateStatus.style.display = 'block';
  generateStatus.textContent = msg;
  generateStatus.className = 'generate-status' + (isError ? ' error' : '');
}

// ── Load show into state + UI ──
function loadShow(show) {
  state.showMeta = show.meta || {};
  state.scenes = (show.scenes || []).map((s, i) => ({
    name: s.name || `scene-${i + 1}`,
    transition: s.transition || 'none',
    yaml: jsyaml.dump(s.manifest, {lineWidth: 120, noRefs: true}),
  }));
  state.activeSceneIndex = 0;

  // Show meta editor
  metaSection.style.display = 'block';
  metaEditor.value = jsyaml.dump(state.showMeta, {lineWidth: 120, noRefs: true});

  // Show scenes section
  scenesSection.style.display = 'flex';
  renderSceneTabs();
  loadActiveScene();
}

// ── Scene tabs ──
function renderSceneTabs() {
  sceneTabsEl.innerHTML = '';
  state.scenes.forEach((scene, i) => {
    const tab = document.createElement('button');
    tab.className = 'scene-tab' + (i === state.activeSceneIndex ? ' active' : '');
    tab.textContent = scene.name;
    tab.addEventListener('click', () => switchScene(i));
    sceneTabsEl.appendChild(tab);
  });
}

function switchScene(index) {
  // Save current editor content
  if (state.scenes[state.activeSceneIndex]) {
    state.scenes[state.activeSceneIndex].yaml = sceneEditor.value;
  }
  state.activeSceneIndex = index;
  loadActiveScene();
  renderSceneTabs();
}

function loadActiveScene() {
  const scene = state.scenes[state.activeSceneIndex];
  if (scene) {
    sceneEditor.value = scene.yaml;
  }
}

// ── Render flow ──
let pollInterval = null;

renderBtn.addEventListener('click', async () => {
  // Save current scene editor content
  if (state.scenes[state.activeSceneIndex]) {
    state.scenes[state.activeSceneIndex].yaml = sceneEditor.value;
  }

  // Save meta editor content
  let showMeta;
  try {
    showMeta = jsyaml.load(metaEditor.value);
  } catch (err) {
    showStatus(`Invalid show meta YAML: ${err.message}`, 'error');
    return;
  }

  // Parse all scene YAMLs
  const scenes = [];
  for (let i = 0; i < state.scenes.length; i++) {
    try {
      const manifest = jsyaml.load(state.scenes[i].yaml);
      scenes.push({
        name: state.scenes[i].name,
        manifest,
        transition: state.scenes[i].transition,
      });
    } catch (err) {
      showStatus(`Scene "${state.scenes[i].name}" has invalid YAML: ${err.message}`, 'error');
      return;
    }
  }

  const show = {meta: showMeta, scenes};

  // Submit render
  renderBtn.disabled = true;
  renderBtn.textContent = 'Rendering...';
  videoPlayer.style.display = 'none';
  downloadLink.style.display = 'none';
  warningsArea.style.display = 'none';
  showStatus('Submitting render job...', 'rendering');
  showProgress(0);

  try {
    const res = await fetch('/api/render-show', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({show}),
    });

    const data = await res.json();

    if (!res.ok) {
      showStatus(`Error: ${data.error}`, 'error');
      resetRenderBtn();
      return;
    }

    showStatus('Queued for rendering...', 'rendering');
    pollInterval = setInterval(() => pollStatus(data.jobId), 1000);
  } catch (err) {
    showStatus(`Network error: ${err.message}`, 'error');
    resetRenderBtn();
  }
});

async function pollStatus(jobId) {
  try {
    const res = await fetch(`/api/status/${jobId}`);
    const data = await res.json();

    if (data.status === 'queued') {
      showStatus(`Queued (position: ${data.queuePosition || '?'})...`, 'rendering');
    } else if (data.status === 'rendering') {
      showStatus('Rendering video...', 'rendering');
      showProgress(data.progress || 0);
    } else if (data.status === 'done') {
      clearInterval(pollInterval);
      showProgress(100);
      showStatus(`Rendered: ${data.title}`, 'done');

      const videoUrl = `/api/download/${jobId}`;
      videoPlayer.src = videoUrl;
      videoPlayer.style.display = 'block';
      downloadLink.href = videoUrl;
      downloadLink.style.display = 'inline-block';
      resetRenderBtn();
    } else if (data.status === 'error') {
      clearInterval(pollInterval);
      showStatus(`Render failed: ${data.error}`, 'error');
      hideProgress();
      resetRenderBtn();
    }
  } catch {
    // Silently retry on network errors
  }
}

// ── UI helpers ──
function showStatus(msg, type = '') {
  statusMsg.textContent = msg;
  statusMsg.className = 'status ' + type;
  statusMsg.style.display = 'block';
}

function showProgress(percent) {
  progressContainer.style.display = 'flex';
  progressBar.style.setProperty('--progress', `${percent}%`);
  progressText.textContent = `${Math.round(percent)}%`;
}

function hideProgress() {
  progressContainer.style.display = 'none';
}

function resetRenderBtn() {
  renderBtn.disabled = false;
  renderBtn.textContent = 'Render Video';
}

function showWarnings(warnings) {
  warningsArea.style.display = 'block';
  warningsArea.innerHTML = '<strong>Warnings:</strong><br>' +
    warnings.map(w => '&bull; ' + w).join('<br>');
}

// ── Presets (single-scene, loaded as a 1-scene show) ──
const PRESETS = {
  bfs: {
    meta: {
      title: "BFS Walkthrough",
      topic: "bfs-web",
      canvas: {width: 1920, height: 1080, background: "#0f0f23"},
      defaults: {
        graph: {nodeRadius: 40, nodeColor: "#2d4a7a", nodeStroke: "#5b8fd9", edgeColor: "#4a6a9a", edgeWidth: 4, strokeWidth: 3, labelColor: "#ffffff", labelFont: "24px monospace"},
        "data-structure": {cellWidth: 70, cellHeight: 45, fillColor: "#1a2a4a", borderColor: "#5b8fd9", textColor: "#ffffff"},
      },
      palette: {visited: "#e74c3c", queued: "#f1c40f", current: "#2ecc71", highlight: "#e67e22"},
      easing: "easeInOutCubic",
    },
    scenes: [{
      name: "walkthrough",
      transition: "none",
      manifest: {
        meta: {title: "BFS Walkthrough", canvas: {width: 1920, height: 1080, background: "#0f0f23"}},
        objects: [
          {id: "title", type: "text", content: "", position: {x: 960, y: 60}, style: {font: "bold 36px sans-serif", align: "center", color: "#ffffff"}},
          {id: "graph", type: "graph", nodes: [{id: "A", label: "A", x: 960, y: 300}, {id: "B", label: "B", x: 720, y: 480}, {id: "C", label: "C", x: 1200, y: 480}, {id: "D", label: "D", x: 840, y: 660}], edges: [{from: "A", to: "B"}, {from: "A", to: "C"}, {from: "B", to: "D"}]},
          {id: "queue", type: "data-structure", variant: "queue", position: {x: 960, y: 870}},
          {id: "step", type: "text", content: "", position: {x: 960, y: 140}, style: {font: "22px sans-serif", align: "center", color: "#b0b0dd"}},
        ],
        timeline: [
          {action: "set-text", target: "title", value: "Breadth-First Search"},
          {action: "fade-in", target: "title", duration: "0.6s"},
          {action: "fade-in", target: "graph", duration: "0.8s"},
          {action: "fade-in", target: "queue", duration: "0.3s"},
          {action: "pause", duration: "1s"},
          {action: "set-text", target: "step", value: "Start at A"},
          {action: "fade-in", target: "step", duration: "0.3s"},
          {action: "highlight-node", target: "graph", node: "A", color: "$current", duration: "0.5s"},
          {action: "enqueue", target: "queue", values: ["A"], duration: "0.4s"},
          {action: "pause", duration: "1.5s"},
          {action: "set-text", target: "step", value: "Dequeue A — visit B, C"},
          {action: "dequeue", target: "queue", duration: "0.4s"},
          {action: "highlight-node", target: "graph", node: "A", color: "$visited", duration: "0.4s"},
          {parallel: [{action: "highlight-node", target: "graph", node: "B", color: "$queued", duration: "0.4s"}, {action: "highlight-node", target: "graph", node: "C", color: "$queued", duration: "0.4s"}]},
          {action: "enqueue", target: "queue", values: ["B", "C"], duration: "0.4s"},
          {action: "pause", duration: "1.5s"},
          {action: "set-text", target: "step", value: "Dequeue B — visit D"},
          {action: "dequeue", target: "queue", duration: "0.4s"},
          {action: "highlight-node", target: "graph", node: "B", color: "$visited", duration: "0.4s"},
          {action: "highlight-node", target: "graph", node: "D", color: "$queued", duration: "0.4s"},
          {action: "enqueue", target: "queue", values: ["D"], duration: "0.4s"},
          {action: "pause", duration: "1.5s"},
          {action: "set-text", target: "step", value: "Dequeue C — no unvisited neighbors"},
          {action: "dequeue", target: "queue", duration: "0.4s"},
          {action: "highlight-node", target: "graph", node: "C", color: "$visited", duration: "0.4s"},
          {action: "pause", duration: "1s"},
          {action: "set-text", target: "step", value: "Dequeue D — BFS complete!"},
          {action: "dequeue", target: "queue", duration: "0.4s"},
          {action: "highlight-node", target: "graph", node: "D", color: "$visited", duration: "0.4s"},
          {action: "pause", duration: "2s"},
        ],
      },
    }],
  },

  dfs: {
    meta: {
      title: "DFS Traversal",
      topic: "dfs-web",
      canvas: {width: 1920, height: 1080, background: "#0f0f23"},
      defaults: {
        graph: {nodeRadius: 40, nodeColor: "#2d4a7a", nodeStroke: "#5b8fd9", edgeColor: "#4a6a9a", edgeWidth: 4, strokeWidth: 3, labelColor: "#ffffff", labelFont: "24px monospace"},
        "data-structure": {cellWidth: 70, cellHeight: 45, fillColor: "#1a2a4a", borderColor: "#5b8fd9", textColor: "#ffffff"},
      },
      palette: {visited: "#e74c3c", stacked: "#9b59b6", current: "#2ecc71", highlight: "#e67e22"},
      easing: "easeInOutCubic",
    },
    scenes: [{
      name: "walkthrough",
      transition: "none",
      manifest: {
        meta: {title: "DFS Traversal", canvas: {width: 1920, height: 1080, background: "#0f0f23"}},
        objects: [
          {id: "title", type: "text", content: "", position: {x: 960, y: 60}, style: {font: "bold 36px sans-serif", align: "center", color: "#ffffff"}},
          {id: "graph", type: "graph", nodes: [{id: "A", label: "A", x: 960, y: 300}, {id: "B", label: "B", x: 720, y: 480}, {id: "C", label: "C", x: 1200, y: 480}, {id: "D", label: "D", x: 840, y: 660}], edges: [{from: "A", to: "B"}, {from: "A", to: "C"}, {from: "B", to: "D"}]},
          {id: "stack", type: "data-structure", variant: "stack", position: {x: 960, y: 870}},
          {id: "step", type: "text", content: "", position: {x: 960, y: 140}, style: {font: "22px sans-serif", align: "center", color: "#b0b0dd"}},
        ],
        timeline: [
          {action: "set-text", target: "title", value: "Depth-First Search"},
          {action: "fade-in", target: "title", duration: "0.6s"},
          {action: "fade-in", target: "graph", duration: "0.8s"},
          {action: "fade-in", target: "stack", duration: "0.3s"},
          {action: "pause", duration: "1s"},
          {action: "set-text", target: "step", value: "Push A onto stack"},
          {action: "fade-in", target: "step", duration: "0.3s"},
          {action: "highlight-node", target: "graph", node: "A", color: "$current", duration: "0.5s"},
          {action: "push", target: "stack", values: ["A"], duration: "0.4s"},
          {action: "pause", duration: "1.5s"},
          {action: "set-text", target: "step", value: "Pop A — push C, B"},
          {action: "pop", target: "stack", duration: "0.4s"},
          {action: "highlight-node", target: "graph", node: "A", color: "$visited", duration: "0.4s"},
          {action: "push", target: "stack", values: ["C", "B"], duration: "0.5s"},
          {action: "pause", duration: "1.5s"},
          {action: "set-text", target: "step", value: "Pop B — push D"},
          {action: "pop", target: "stack", duration: "0.4s"},
          {action: "highlight-node", target: "graph", node: "B", color: "$visited", duration: "0.4s"},
          {action: "push", target: "stack", values: ["D"], duration: "0.4s"},
          {action: "pause", duration: "1.5s"},
          {action: "set-text", target: "step", value: "Pop D — leaf node"},
          {action: "pop", target: "stack", duration: "0.4s"},
          {action: "highlight-node", target: "graph", node: "D", color: "$visited", duration: "0.4s"},
          {action: "pause", duration: "1s"},
          {action: "set-text", target: "step", value: "Pop C — DFS complete!"},
          {action: "pop", target: "stack", duration: "0.4s"},
          {action: "highlight-node", target: "graph", node: "C", color: "$visited", duration: "0.4s"},
          {action: "pause", duration: "2s"},
        ],
      },
    }],
  },

  stack: {
    meta: {
      title: "Stack: Push & Pop",
      topic: "stack-web",
      canvas: {width: 1920, height: 1080, background: "#0f0f23"},
      defaults: {"data-structure": {cellWidth: 80, cellHeight: 50, fillColor: "#1a2a4a", borderColor: "#5b8fd9", textColor: "#ffffff"}},
      easing: "easeInOutCubic",
    },
    scenes: [{
      name: "demo",
      transition: "none",
      manifest: {
        meta: {title: "Stack Operations", canvas: {width: 1920, height: 1080, background: "#0f0f23"}},
        objects: [
          {id: "title", type: "text", content: "", position: {x: 960, y: 100}, style: {font: "bold 44px sans-serif", align: "center", color: "#ffffff"}},
          {id: "stack", type: "data-structure", variant: "stack", position: {x: 960, y: 500}},
          {id: "narration", type: "text", content: "", position: {x: 960, y: 700}, style: {font: "24px sans-serif", align: "center", color: "#b0b0dd"}},
        ],
        timeline: [
          {action: "set-text", target: "title", value: "Stack — Last In, First Out"},
          {action: "fade-in", target: "title", duration: "0.8s"},
          {action: "fade-in", target: "stack", duration: "0.3s"},
          {action: "pause", duration: "1s"},
          {action: "set-text", target: "narration", value: "push(10)"},
          {action: "fade-in", target: "narration", duration: "0.3s"},
          {action: "push", target: "stack", values: ["10"], duration: "0.5s"},
          {action: "pause", duration: "1s"},
          {action: "set-text", target: "narration", value: "push(20)"},
          {action: "push", target: "stack", values: ["20"], duration: "0.5s"},
          {action: "pause", duration: "1s"},
          {action: "set-text", target: "narration", value: "push(30)"},
          {action: "push", target: "stack", values: ["30"], duration: "0.5s"},
          {action: "pause", duration: "1s"},
          {action: "set-text", target: "narration", value: "pop() -> 30 (last in, first out!)"},
          {action: "pop", target: "stack", duration: "0.6s"},
          {action: "pause", duration: "1.5s"},
          {action: "set-text", target: "narration", value: "pop() -> 20"},
          {action: "pop", target: "stack", duration: "0.6s"},
          {action: "pause", duration: "1.5s"},
          {action: "set-text", target: "narration", value: "pop() -> 10 — stack empty!"},
          {action: "pop", target: "stack", duration: "0.6s"},
          {action: "pause", duration: "2s"},
        ],
      },
    }],
  },
};

// ── Preset loading ──
presetSelect.addEventListener('change', () => {
  const key = presetSelect.value;
  if (key && PRESETS[key]) {
    loadShow(PRESETS[key]);
    showGenerateStatus(`Loaded "${key}" preset. Click Render Video to generate.`);
  }
  presetSelect.value = '';
});

// ═══════════════════════════════════════════════════════════════════
// Help Modal
// ═══════════════════════════════════════════════════════════════════

const helpBtn = document.getElementById('help-btn');
const helpModal = document.getElementById('help-modal');
const helpClose = document.getElementById('help-close');

function isTyping() {
  const active = document.activeElement;
  return active && (active.tagName === 'TEXTAREA' || active.tagName === 'INPUT');
}

function openHelpModal() {
  helpModal.style.display = 'flex';
}

function closeHelpModal() {
  helpModal.style.display = 'none';
}

// Event listeners
helpBtn.addEventListener('click', openHelpModal);
helpClose.addEventListener('click', closeHelpModal);

// Click backdrop to close
helpModal.addEventListener('click', (e) => {
  if (e.target === helpModal) {
    closeHelpModal();
  }
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // ? opens help (only when not typing)
  if (e.key === '?' && !isTyping()) {
    e.preventDefault();
    openHelpModal();
  }
  // Escape closes help
  if (e.key === 'Escape' && helpModal.style.display !== 'none') {
    closeHelpModal();
  }
});

// ── Tab switching ──
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

function switchTab(tabName) {
  // Deactivate all tabs
  tabBtns.forEach(btn => btn.classList.remove('active'));
  tabContents.forEach(content => content.classList.remove('active'));

  // Activate selected tab
  const btn = document.querySelector(`.tab-btn[data-tab="${tabName}"]`);
  const content = document.querySelector(`.tab-content[data-tab="${tabName}"]`);

  if (btn) btn.classList.add('active');
  if (content) content.classList.add('active');
}

tabBtns.forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

// ── Copy to clipboard for code examples ──
function setupCopyButtons() {
  document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const code = this.previousElementSibling.textContent;
      navigator.clipboard.writeText(code).then(() => {
        const originalText = this.textContent;
        this.textContent = 'Copied!';
        setTimeout(() => {
          this.textContent = originalText;
        }, 2000);
      }).catch(err => {
        console.error('Failed to copy:', err);
        this.textContent = 'Failed';
        setTimeout(() => {
          this.textContent = originalText;
        }, 2000);
      });
    });
  });
}

// Initialize copy buttons
setupCopyButtons();

// ── Action filter (search Actions tab) ──
const actionFilter = document.getElementById('action-filter');
if (actionFilter) {
  actionFilter.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    document.querySelectorAll('.action-row').forEach(row => {
      const name = row.dataset.name.toLowerCase();
      const category = row.dataset.category.toLowerCase();
      if (name.includes(query) || category.includes(query) || query === '') {
        row.style.display = '';
      } else {
        row.style.display = 'none';
      }
    });
  });
}
