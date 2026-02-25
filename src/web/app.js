/**
 * CS ANIMATION PLATFORM - NEUBRUTALISM UI
 * Main app with client-side routing
 */

import router from '/frontend/lib/router.js';

// ══════════════════════════════════════════════════════════════
// STATE MANAGEMENT
// ══════════════════════════════════════════════════════════════

const state = {
  currentShow: null,
  currentJobId: null,
  activeScene: 0,
};

// No YAML skeleton needed — users paste their own or use AI/presets

// ══════════════════════════════════════════════════════════════
// PAGE RENDERERS
// ══════════════════════════════════════════════════════════════

function renderEditorPage() {
  const template = document.getElementById('template-editor');
  const content = template.content.cloneNode(true);

  const appRoot = document.getElementById('app-root');
  appRoot.innerHTML = '';
  appRoot.appendChild(content);

  initEditor();
  updateActiveNav('/');
}

function renderTemplatesPage() {
  const template = document.getElementById('template-templates');
  const content = template.content.cloneNode(true);

  const appRoot = document.getElementById('app-root');
  appRoot.innerHTML = '';
  appRoot.appendChild(content);

  document.querySelectorAll('.load-template').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const preset = e.target.dataset.preset;
      router.navigate('/');
      setTimeout(() => {
        document.getElementById('preset-select').value = preset;
        document.getElementById('preset-select').dispatchEvent(new Event('change'));
      }, 100);
    });
  });

  updateActiveNav('/templates');
}

function renderDocsPage() {
  const template = document.getElementById('template-docs');
  const content = template.content.cloneNode(true);

  const appRoot = document.getElementById('app-root');
  appRoot.innerHTML = '';
  appRoot.appendChild(content);

  updateActiveNav('/docs');
}

async function renderHistoryPage() {
  const template = document.getElementById('template-history');
  const content = template.content.cloneNode(true);

  const appRoot = document.getElementById('app-root');
  appRoot.innerHTML = '';
  appRoot.appendChild(content);

  await loadJobHistory();
  updateActiveNav('/history');
}

// ══════════════════════════════════════════════════════════════
// NAVIGATION
// ══════════════════════════════════════════════════════════════

function updateActiveNav(path) {
  document.querySelectorAll('.nav-link').forEach(link => {
    if (link.dataset.route === path) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
}

// ══════════════════════════════════════════════════════════════
// EDITOR FUNCTIONALITY
// ══════════════════════════════════════════════════════════════

function initEditor() {
  // Paste manifest toggle
  document.getElementById('paste-manifest-toggle')?.addEventListener('click', () => {
    const body = document.getElementById('paste-manifest-body');
    const arrow = document.querySelector('#paste-manifest-toggle .toggle-arrow');
    if (body.style.display === 'none') {
      body.style.display = 'block';
      arrow.classList.add('open');
    } else {
      body.style.display = 'none';
      arrow.classList.remove('open');
    }
  });

  // Manual YAML load button
  document.getElementById('load-yaml-btn')?.addEventListener('click', () => {
    const yamlText = document.getElementById('manual-yaml-input').value.trim();
    if (!yamlText) {
      showStatus('manual', 'Paste a YAML manifest first', 'error');
      return;
    }

    try {
      const show = jsyaml.load(yamlText);

      if (!show || !show.scenes || !Array.isArray(show.scenes)) {
        throw new Error('Invalid: must have a "scenes" array');
      }
      if (!show.meta) {
        throw new Error('Invalid: must have a "meta" section');
      }

      loadShow(show);
      showStatus('manual', `Loaded ${show.scenes.length} scene(s)!`, 'success');
    } catch (err) {
      showStatus('manual', `YAML error: ${err.message}`, 'error');
    }
  });

  // Preset loading
  document.getElementById('preset-select').addEventListener('change', async (e) => {
    const preset = e.target.value;
    if (!preset) return;

    try {
      const response = await fetch(`/frontend/assets/presets/${preset}.json`);
      if (!response.ok) throw new Error('Preset not found');

      const show = await response.json();
      loadShow(show);

      showStatus('generate', `Loaded ${preset.toUpperCase()} preset`, 'success');
    } catch (err) {
      showStatus('generate', `Failed to load preset: ${err.message}`, 'error');
    }

    e.target.value = '';
  });

  // Generate button
  document.getElementById('generate-btn').addEventListener('click', async () => {
    const prompt = document.getElementById('prompt-input').value.trim();
    if (!prompt) {
      showStatus('generate', 'Enter a prompt first', 'error');
      return;
    }

    showStatus('generate', 'Generating with AI...', 'loading');
    document.getElementById('generate-btn').disabled = true;

    try {
      const response = await fetch('/api/v1/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Generation failed');
      }

      const data = await response.json();
      loadShow(data.show);

      showStatus('generate', `Generated ${data.show.scenes.length} scenes!`, 'success');
    } catch (err) {
      showStatus('generate', err.message, 'error');
    } finally {
      document.getElementById('generate-btn').disabled = false;
    }
  });

  // Render button
  document.getElementById('render-btn').addEventListener('click', async () => {
    if (!state.currentShow) return;

    const ttsEnabled = document.getElementById('tts-checkbox')?.checked ?? false;

    try {
      const response = await fetch('/api/v1/render/show', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          show: state.currentShow,
          topic: state.currentShow.meta?.topic || document.getElementById('prompt-input').value.trim(),
          tts: ttsEnabled
        })
      });

      if (!response.ok) throw new Error('Render failed');

      const data = await response.json();
      state.currentJobId = data.jobId;

      showRenderStatus();
      pollRenderStatus(data.jobId);
    } catch (err) {
      alert(`Render failed: ${err.message}`);
    }
  });

  // Meta toggle
  document.getElementById('meta-toggle')?.addEventListener('click', () => {
    const wrap = document.getElementById('meta-editor-wrap');
    const icon = document.querySelector('#meta-toggle .toggle-icon');

    if (wrap.style.display === 'none') {
      wrap.style.display = 'block';
      icon.classList.add('open');
    } else {
      wrap.style.display = 'none';
      icon.classList.remove('open');
    }
  });

  // Scene editor changes
  document.getElementById('scene-editor')?.addEventListener('input', () => {
    updateShowFromEditors();
  });

  document.getElementById('meta-editor')?.addEventListener('input', () => {
    updateShowFromEditors();
  });
}

function loadShow(show) {
  state.currentShow = show;
  state.activeScene = 0;

  // Show sections
  document.getElementById('scenes-section').style.display = 'block';
  document.getElementById('meta-section').style.display = 'block';
  document.getElementById('render-btn').disabled = false;

  // Render scene tabs
  const tabsContainer = document.getElementById('scene-tabs');
  tabsContainer.innerHTML = '';

  show.scenes.forEach((scene, i) => {
    const tab = document.createElement('button');
    tab.className = 'scene-tab';
    tab.textContent = scene.name || `Scene ${i + 1}`;
    tab.addEventListener('click', () => switchScene(i));
    if (i === 0) tab.classList.add('active');
    tabsContainer.appendChild(tab);
  });

  // Load first scene
  switchScene(0);

  // Load meta
  const metaEditor = document.getElementById('meta-editor');
  metaEditor.value = jsyaml.dump({
    title: show.meta.title,
    canvas: show.meta.canvas,
    palette: show.meta.palette || {},
    defaults: show.meta.defaults || {},
    easing: show.meta.easing || 'easeInOut'
  });
}

function switchScene(index) {
  state.activeScene = index;

  // Update tabs
  document.querySelectorAll('.scene-tab').forEach((tab, i) => {
    tab.classList.toggle('active', i === index);
  });

  // Load scene into editor
  const scene = state.currentShow.scenes[index];
  const sceneEditor = document.getElementById('scene-editor');
  sceneEditor.value = jsyaml.dump(scene.manifest);
}

function updateShowFromEditors() {
  try {
    const sceneYaml = document.getElementById('scene-editor').value;
    const sceneData = jsyaml.load(sceneYaml);
    state.currentShow.scenes[state.activeScene].manifest = sceneData;

    const metaYaml = document.getElementById('meta-editor').value;
    const metaData = jsyaml.load(metaYaml);
    state.currentShow.meta = { ...state.currentShow.meta, ...metaData };
  } catch (err) {
    // Ignore YAML parse errors while typing
  }
}

function showStatus(type, message, status) {
  const statusEl = document.getElementById(`${type}-status`);
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.className = `generate-status ${status}`;
  statusEl.style.display = 'block';
}

function showRenderStatus() {
  const card = document.getElementById('render-status-card');
  card.style.display = 'block';
  document.getElementById('video-preview').style.display = 'none';
}

async function pollRenderStatus(jobId) {
  const statusText = document.getElementById('status-text');
  const statusBadge = document.getElementById('status-badge');
  const progressFill = document.getElementById('progress-fill');
  const statusDetail = document.getElementById('status-detail');

  const poll = async () => {
    try {
      const response = await fetch(`/api/v1/jobs/${jobId}/status`);
      if (!response.ok) throw new Error('Failed to get status');

      const data = await response.json();

      statusBadge.textContent = data.status;
      statusBadge.className = `badge badge-${getStatusColor(data.status)}`;
      progressFill.style.width = `${data.progress}%`;
      statusDetail.textContent = data.title || 'Processing...';

      if (data.status === 'done') {
        statusText.textContent = 'Render complete!';
        showVideoPreview(jobId);
      } else if (data.status === 'error') {
        statusText.textContent = 'Render failed';
        statusDetail.textContent = data.error;
      } else {
        setTimeout(poll, 1000);
      }
    } catch (err) {
      console.error('Poll error:', err);
      setTimeout(poll, 2000);
    }
  };

  poll();
}

function getStatusColor(status) {
  const colors = {
    queued: 'neutral',
    rendering: 'info',
    done: 'success',
    error: 'error'
  };
  return colors[status] || 'neutral';
}

function showVideoPreview(jobId) {
  const preview = document.getElementById('video-preview');
  const video = document.getElementById('video-player');
  const downloadBtn = document.getElementById('download-btn');

  video.src = `/output/${jobId}.mp4`;
  preview.style.display = 'block';

  downloadBtn.onclick = () => {
    window.location.href = `/api/v1/download/${jobId}`;
  };
}

// ══════════════════════════════════════════════════════════════
// HISTORY FUNCTIONALITY
// ══════════════════════════════════════════════════════════════

async function loadJobHistory() {
  try {
    const response = await fetch('/api/v1/jobs?limit=20');
    if (!response.ok) throw new Error('Failed to load jobs');

    const data = await response.json();

    const jobsList = document.getElementById('jobs-list');
    const emptyState = document.getElementById('empty-history');

    if (data.jobs.length === 0) {
      jobsList.style.display = 'none';
      emptyState.style.display = 'block';
      return;
    }

    jobsList.style.display = 'block';
    emptyState.style.display = 'none';
    jobsList.innerHTML = '';

    data.jobs.forEach(job => {
      const card = createJobCard(job);
      jobsList.appendChild(card);
    });
  } catch (err) {
    console.error('Failed to load history:', err);
  }
}

function createJobCard(job) {
  const card = document.createElement('div');
  card.className = 'card job-card';

  const date = new Date(job.createdAt).toLocaleString();

  card.innerHTML = `
    <div class="job-info">
      <h4>${job.title || 'Untitled Animation'}</h4>
      <div class="job-meta">
        <span>${date}</span>
        <span class="badge badge-${getStatusColor(job.status)}">${job.status}</span>
        ${job.topic ? `<span>${job.topic.substring(0, 50)}...</span>` : ''}
      </div>
    </div>
    <div class="job-actions">
      ${job.status === 'done' ? `
        <a href="/api/v1/download/${job.id}" class="btn btn-success btn-sm">DOWNLOAD</a>
      ` : ''}
      <button class="btn btn-outline btn-sm delete-job" data-id="${job.id}">DELETE</button>
    </div>
  `;

  card.querySelector('.delete-job')?.addEventListener('click', async (e) => {
    if (!confirm('Delete this job?')) return;

    try {
      await fetch(`/api/v1/jobs/${job.id}`, { method: 'DELETE' });
      card.remove();
    } catch (err) {
      alert('Failed to delete job');
    }
  });

  return card;
}

// ══════════════════════════════════════════════════════════════
// ROUTER SETUP
// ══════════════════════════════════════════════════════════════

router.addRoute('/', renderEditorPage);
router.addRoute('/templates', renderTemplatesPage);
router.addRoute('/docs', renderDocsPage);
router.addRoute('/history', renderHistoryPage);

router.setNotFound((path) => {
  console.log('404:', path);
  router.navigate('/');
});

// Initialize
console.log('CS Animation Platform initialized');
