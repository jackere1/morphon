// ── Elements ──
const editorEl = document.getElementById('editor');
const renderBtn = document.getElementById('render-btn');
const presetSelect = document.getElementById('preset-select');
const statusMsg = document.getElementById('status-message');
const progressContainer = document.getElementById('progress-bar-container');
const progressBar = document.getElementById('progress-bar');
const progressText = document.getElementById('progress-text');
const videoPlayer = document.getElementById('video-player');
const downloadLink = document.getElementById('download-link');

// ── Editor setup (textarea fallback — works everywhere) ──
const textarea = document.createElement('textarea');
textarea.id = 'yaml-editor';
textarea.spellcheck = false;
textarea.placeholder = '# Paste your YAML manifest here...';
textarea.style.cssText = `
  width: 100%; height: 100%; resize: none; border: none; outline: none;
  background: #1a1a2e; color: #d0d0ee; padding: 16px;
  font-family: 'JetBrains Mono', 'Fira Code', Consolas, monospace;
  font-size: 14px; line-height: 1.6; tab-size: 2;
`;
editorEl.appendChild(textarea);

// Handle tab key for indentation
textarea.addEventListener('keydown', (e) => {
  if (e.key === 'Tab') {
    e.preventDefault();
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    textarea.value = textarea.value.substring(0, start) + '  ' + textarea.value.substring(end);
    textarea.selectionStart = textarea.selectionEnd = start + 2;
  }
});

function getEditorValue() {
  return textarea.value;
}

function setEditorValue(val) {
  textarea.value = val;
}

// ── Presets ──
const PRESETS = {
  bfs: `# BFS Walkthrough — single scene
meta:
  title: "BFS Walkthrough"
  topic: "bfs-web"
  canvas:
    width: 1920
    height: 1080
    background: "#0f0f23"
  defaults:
    graph:
      nodeRadius: 40
      nodeColor: "#2d4a7a"
      nodeStroke: "#5b8fd9"
      edgeColor: "#4a6a9a"
      edgeWidth: 4
      strokeWidth: 3
      labelColor: "#ffffff"
      labelFont: "24px monospace"
    data-structure:
      cellWidth: 70
      cellHeight: 45
      fillColor: "#1a2a4a"
      borderColor: "#5b8fd9"
      textColor: "#ffffff"
  palette:
    visited: "#e74c3c"
    queued: "#f1c40f"
    current: "#2ecc71"
    highlight: "#e67e22"
  easing: easeInOutCubic

objects:
  - id: title
    type: text
    content: ""
    position: { x: 960, y: 60 }
    style:
      font: "bold 36px sans-serif"
      align: center
      color: "#ffffff"

  - id: graph
    type: graph
    nodes:
      - { id: A, label: A, x: 960, y: 300 }
      - { id: B, label: B, x: 720, y: 480 }
      - { id: C, label: C, x: 1200, y: 480 }
      - { id: D, label: D, x: 840, y: 660 }
    edges:
      - { from: A, to: B }
      - { from: A, to: C }
      - { from: B, to: D }

  - id: queue
    type: data-structure
    variant: queue
    position: { x: 960, y: 870 }

  - id: step
    type: text
    content: ""
    position: { x: 960, y: 140 }
    style:
      font: "22px sans-serif"
      align: center
      color: "#b0b0dd"

timeline:
  - action: set-text
    target: title
    value: "Breadth-First Search"
  - action: fade-in
    target: title
    duration: 0.6s

  - action: fade-in
    target: graph
    duration: 0.8s
  - action: fade-in
    target: queue
    duration: 0.3s

  - action: pause
    duration: 1s

  # Visit A
  - action: set-text
    target: step
    value: "Start at A"
  - action: fade-in
    target: step
    duration: 0.3s
  - action: highlight-node
    target: graph
    node: A
    color: "$current"
    duration: 0.5s
  - action: enqueue
    target: queue
    values: ["A"]
    duration: 0.4s
  - action: pause
    duration: 1.5s

  # Dequeue A, visit B and C
  - action: set-text
    target: step
    value: "Dequeue A — visit B, C"
  - action: dequeue
    target: queue
    duration: 0.4s
  - action: highlight-node
    target: graph
    node: A
    color: "$visited"
    duration: 0.4s
  - parallel:
      - action: highlight-edge
        target: graph
        edge: [A, B]
        color: "$highlight"
        duration: 0.5s
      - action: highlight-edge
        target: graph
        edge: [A, C]
        color: "$highlight"
        duration: 0.5s
  - parallel:
      - action: highlight-node
        target: graph
        node: B
        color: "$queued"
        duration: 0.4s
      - action: highlight-node
        target: graph
        node: C
        color: "$queued"
        duration: 0.4s
  - action: enqueue
    target: queue
    values: ["B", "C"]
    duration: 0.4s
  - action: pause
    duration: 1.5s

  # Dequeue B, visit D
  - action: set-text
    target: step
    value: "Dequeue B — visit D"
  - action: dequeue
    target: queue
    duration: 0.4s
  - action: highlight-node
    target: graph
    node: B
    color: "$visited"
    duration: 0.4s
  - action: highlight-edge
    target: graph
    edge: [B, D]
    color: "$highlight"
    duration: 0.5s
  - action: highlight-node
    target: graph
    node: D
    color: "$queued"
    duration: 0.4s
  - action: enqueue
    target: queue
    values: ["D"]
    duration: 0.4s
  - action: pause
    duration: 1.5s

  # Dequeue C (no new neighbors)
  - action: set-text
    target: step
    value: "Dequeue C — no unvisited neighbors"
  - action: dequeue
    target: queue
    duration: 0.4s
  - action: highlight-node
    target: graph
    node: C
    color: "$visited"
    duration: 0.4s
  - action: pause
    duration: 1s

  # Dequeue D (no new neighbors)
  - action: set-text
    target: step
    value: "Dequeue D — BFS complete!"
  - action: dequeue
    target: queue
    duration: 0.4s
  - action: highlight-node
    target: graph
    node: D
    color: "$visited"
    duration: 0.4s
  - action: pause
    duration: 2s
`,

  dfs: `# DFS Traversal using a Stack
meta:
  title: "DFS Traversal"
  topic: "dfs-web"
  canvas:
    width: 1920
    height: 1080
    background: "#0f0f23"
  defaults:
    graph:
      nodeRadius: 40
      nodeColor: "#2d4a7a"
      nodeStroke: "#5b8fd9"
      edgeColor: "#4a6a9a"
      edgeWidth: 4
      strokeWidth: 3
      labelColor: "#ffffff"
      labelFont: "24px monospace"
    data-structure:
      cellWidth: 70
      cellHeight: 45
      fillColor: "#1a2a4a"
      borderColor: "#5b8fd9"
      textColor: "#ffffff"
  palette:
    visited: "#e74c3c"
    stacked: "#9b59b6"
    current: "#2ecc71"
    highlight: "#e67e22"
  easing: easeInOutCubic

objects:
  - id: title
    type: text
    content: ""
    position: { x: 960, y: 60 }
    style:
      font: "bold 36px sans-serif"
      align: center
      color: "#ffffff"

  - id: graph
    type: graph
    nodes:
      - { id: A, label: A, x: 960, y: 300 }
      - { id: B, label: B, x: 720, y: 480 }
      - { id: C, label: C, x: 1200, y: 480 }
      - { id: D, label: D, x: 840, y: 660 }
    edges:
      - { from: A, to: B }
      - { from: A, to: C }
      - { from: B, to: D }

  - id: stack
    type: data-structure
    variant: stack
    position: { x: 960, y: 870 }

  - id: step
    type: text
    content: ""
    position: { x: 960, y: 140 }
    style:
      font: "22px sans-serif"
      align: center
      color: "#b0b0dd"

timeline:
  - action: set-text
    target: title
    value: "Depth-First Search"
  - action: fade-in
    target: title
    duration: 0.6s
  - action: fade-in
    target: graph
    duration: 0.8s
  - action: fade-in
    target: stack
    duration: 0.3s
  - action: pause
    duration: 1s

  # Push A
  - action: set-text
    target: step
    value: "Push A onto stack"
  - action: fade-in
    target: step
    duration: 0.3s
  - action: highlight-node
    target: graph
    node: A
    color: "$current"
    duration: 0.5s
  - action: push
    target: stack
    values: ["A"]
    duration: 0.4s
  - action: pause
    duration: 1.5s

  # Pop A, push C then B (DFS goes B first)
  - action: set-text
    target: step
    value: "Pop A — push neighbors C, B"
  - action: pop
    target: stack
    duration: 0.4s
  - action: highlight-node
    target: graph
    node: A
    color: "$visited"
    duration: 0.4s
  - action: push
    target: stack
    values: ["C", "B"]
    duration: 0.5s
  - parallel:
      - action: highlight-node
        target: graph
        node: B
        color: "$stacked"
        duration: 0.4s
      - action: highlight-node
        target: graph
        node: C
        color: "$stacked"
        duration: 0.4s
  - action: pause
    duration: 1.5s

  # Pop B, push D
  - action: set-text
    target: step
    value: "Pop B — push neighbor D"
  - action: pop
    target: stack
    duration: 0.4s
  - action: highlight-node
    target: graph
    node: B
    color: "$visited"
    duration: 0.4s
  - action: highlight-edge
    target: graph
    edge: [B, D]
    color: "$highlight"
    duration: 0.5s
  - action: push
    target: stack
    values: ["D"]
    duration: 0.4s
  - action: highlight-node
    target: graph
    node: D
    color: "$stacked"
    duration: 0.4s
  - action: pause
    duration: 1.5s

  # Pop D (leaf)
  - action: set-text
    target: step
    value: "Pop D — no unvisited neighbors"
  - action: pop
    target: stack
    duration: 0.4s
  - action: highlight-node
    target: graph
    node: D
    color: "$visited"
    duration: 0.4s
  - action: pause
    duration: 1s

  # Pop C (leaf)
  - action: set-text
    target: step
    value: "Pop C — DFS complete!"
  - action: pop
    target: stack
    duration: 0.4s
  - action: highlight-node
    target: graph
    node: C
    color: "$visited"
    duration: 0.4s
  - action: pause
    duration: 2s
`,

  stack: `# Stack Operations — LIFO
meta:
  title: "Stack: Push & Pop"
  topic: "stack-web"
  canvas:
    width: 1920
    height: 1080
    background: "#0f0f23"
  defaults:
    data-structure:
      cellWidth: 80
      cellHeight: 50
      fillColor: "#1a2a4a"
      borderColor: "#5b8fd9"
      textColor: "#ffffff"
  easing: easeInOutCubic

objects:
  - id: title
    type: text
    content: ""
    position: { x: 960, y: 100 }
    style:
      font: "bold 44px sans-serif"
      align: center
      color: "#ffffff"

  - id: stack
    type: data-structure
    variant: stack
    position: { x: 960, y: 500 }

  - id: narration
    type: text
    content: ""
    position: { x: 960, y: 700 }
    style:
      font: "24px sans-serif"
      align: center
      color: "#b0b0dd"

timeline:
  - action: set-text
    target: title
    value: "Stack — Last In, First Out"
  - action: fade-in
    target: title
    duration: 0.8s
  - action: fade-in
    target: stack
    duration: 0.3s
  - action: pause
    duration: 1s

  - action: set-text
    target: narration
    value: "push(10)"
  - action: fade-in
    target: narration
    duration: 0.3s
  - action: push
    target: stack
    values: ["10"]
    duration: 0.5s
  - action: pause
    duration: 1s

  - action: set-text
    target: narration
    value: "push(20)"
  - action: push
    target: stack
    values: ["20"]
    duration: 0.5s
  - action: pause
    duration: 1s

  - action: set-text
    target: narration
    value: "push(30)"
  - action: push
    target: stack
    values: ["30"]
    duration: 0.5s
  - action: pause
    duration: 1s

  - action: set-text
    target: narration
    value: "pop() → 30 (last in, first out!)"
  - action: pop
    target: stack
    duration: 0.6s
  - action: pause
    duration: 1.5s

  - action: set-text
    target: narration
    value: "pop() → 20"
  - action: pop
    target: stack
    duration: 0.6s
  - action: pause
    duration: 1.5s

  - action: set-text
    target: narration
    value: "pop() → 10 — stack empty!"
  - action: pop
    target: stack
    duration: 0.6s
  - action: pause
    duration: 2s
`,
};

presetSelect.addEventListener('change', () => {
  const key = presetSelect.value;
  if (key && PRESETS[key]) {
    setEditorValue(PRESETS[key]);
  }
  presetSelect.value = '';
});

// ── Render flow ──
let currentJobId = null;
let pollInterval = null;

renderBtn.addEventListener('click', async () => {
  const yaml = getEditorValue().trim();
  if (!yaml) {
    showStatus('Please enter a YAML manifest.', 'error');
    return;
  }

  // Reset UI
  renderBtn.disabled = true;
  renderBtn.textContent = 'Rendering...';
  videoPlayer.style.display = 'none';
  downloadLink.style.display = 'none';
  showStatus('Submitting render job...', 'rendering');
  showProgress(0);

  try {
    const res = await fetch('/api/render', {
      method: 'POST',
      headers: {'Content-Type': 'application/yaml'},
      body: yaml,
    });

    const data = await res.json();

    if (!res.ok) {
      showStatus(`Error: ${data.error}`, 'error');
      resetBtn();
      return;
    }

    currentJobId = data.jobId;
    showStatus('Queued for rendering...', 'rendering');

    // Start polling
    pollInterval = setInterval(() => pollStatus(data.jobId), 1000);
  } catch (err) {
    showStatus(`Network error: ${err.message}`, 'error');
    resetBtn();
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

      // Show video player
      const videoUrl = `/api/download/${jobId}`;
      videoPlayer.src = videoUrl;
      videoPlayer.style.display = 'block';

      // Show download link
      downloadLink.href = videoUrl;
      downloadLink.style.display = 'inline-block';

      resetBtn();
    } else if (data.status === 'error') {
      clearInterval(pollInterval);
      showStatus(`Render failed: ${data.error}`, 'error');
      hideProgress();
      resetBtn();
    }
  } catch (err) {
    // Silently retry on network errors
  }
}

function showStatus(msg, type = '') {
  statusMsg.textContent = msg;
  statusMsg.className = `status ${type}`;
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

function resetBtn() {
  renderBtn.disabled = false;
  renderBtn.textContent = 'Render';
}

// Load BFS preset by default
setEditorValue(PRESETS.bfs);
