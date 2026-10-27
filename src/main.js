import { ModRegistry } from './engine/modRegistry.js';
import { CodexSynthesizer } from './engine/codexSynthesizer.js';
import { TwitchChatBridge } from './engine/twitchChatBridge.js';
import { PRESET_MODS } from './engine/codexPresets.js';

// Setup cross-window sync channel for OBS Browser Source
const syncChannel = new BroadcastChannel('codexchaos_sync_channel');

// Detect OBS mode from URL query ?view=obs
const urlParams = new URLSearchParams(window.location.search);
const isObsMode = urlParams.get('view') === 'obs';

if (isObsMode) {
  initObsMode();
} else {
  initStudioMode();
}

/**
 * ==========================================
 * OBS BROWSER SOURCE MODE (Transparent 60fps)
 * ==========================================
 */
function initObsMode() {
  document.body.classList.add('obs-mode');
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="obs-canvas-container">
      <canvas id="obs-canvas"></canvas>
    </div>
    <div id="obs-toast-container"></div>
  `;

  const canvas = document.getElementById('obs-canvas');
  const ctx = canvas.getContext('2d');
  const registry = new ModRegistry();

  function resizeObsCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resizeObsCanvas);
  resizeObsCanvas();

  // Listen for mods synced from Studio tab
  syncChannel.onmessage = (event) => {
    const { type, payload } = event.data;
    if (type === 'APPLY_MOD') {
      registry.registerMod({
        title: payload.title,
        code: payload.code,
        author: payload.author,
        prompt: payload.prompt
      });
      showObsToast(payload.title, payload.author);
    } else if (type === 'REVERT_MOD') {
      registry.revertLastMod();
    } else if (type === 'CLEAR_MODS') {
      registry.clearAll();
    }
  };

  function showObsToast(title, author) {
    const container = document.getElementById('obs-toast-container');
    container.innerHTML = `
      <div class="obs-attribution-toast">
        <span style="color: #9146ff; font-weight: 700;">★ MOD APPLIED</span>
        <span style="font-weight: 600;">${title}</span>
        <span style="color: #94a3b8; font-size: 12px;">by @${author}</span>
      </div>
    `;
    setTimeout(() => {
      container.innerHTML = '';
    }, 4500);
  }

  // OBS 60fps Loop
  function obsLoop(time) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    registry.renderAll(ctx, canvas, time);
    requestAnimationFrame(obsLoop);
  }
  requestAnimationFrame(obsLoop);
}

/**
 * ==========================================
 * STREAMER STUDIO MODE (Dashboard & Live HUD)
 * ==========================================
 */
function initStudioMode() {
  const app = document.getElementById('app');

  app.innerHTML = `
    <div class="studio-container">
      <!-- Top Studio Header -->
      <header class="studio-header">
        <div class="brand-section">
          <div class="brand-logo-icon">⚡</div>
          <div>
            <h1 class="brand-title">CodexChaos Engine</h1>
            <p class="brand-tagline">Real-Time AI Game Modder & Live OBS Overlay • OpenAI Codex x TwitchCon</p>
          </div>
        </div>
        <div class="header-actions">
          <div class="status-pill">
            <span class="status-dot"></span>
            <span>LIVE 60 FPS</span>
          </div>
          <button id="btn-copy-obs" class="btn btn-primary" title="Copy OBS Browser Source URL">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            <span id="copy-btn-text">Copy OBS Link</span>
          </button>
          <button id="btn-revert-mod" class="btn btn-secondary">
            ↩ Revert Mod
          </button>
          <button id="btn-clear-mods" class="btn btn-danger">
            ✕ Clear All
          </button>
        </div>
      </header>

      <!-- Main Studio Grid -->
      <main class="studio-grid">
        <!-- Left: Game Viewport & Mods Dock -->
        <section class="viewport-card">
          <div class="viewport-header">
            <h2 class="viewport-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                <line x1="8" y1="21" x2="16" y2="21"></line>
                <line x1="12" y1="17" x2="12" y2="21"></line>
              </svg>
              Live Game Stream & Codex Overlay
            </h2>
            <div class="resolution-tag">1920 × 1080 (Canvas 60fps)</div>
          </div>

          <!-- 16:9 Canvas Viewport -->
          <div class="viewport-canvas-wrapper">
            <canvas id="studio-canvas"></canvas>
            <div class="canvas-overlay-hud">
              <div class="hud-stat" id="hud-fps">FPS: 60</div>
              <div class="hud-stat" id="hud-mods">Active Mods: 0</div>
            </div>
          </div>

          <!-- Active Mods Dock -->
          <div class="active-mods-dock">
            <div class="dock-title-bar">
              <span>ACTIVE MOD STACK</span>
              <span id="dock-count" style="color: var(--neon-cyan);">0 running</span>
            </div>
            <div class="mods-list" id="active-mods-list">
              <span style="font-size: 12px; color: var(--text-muted); font-style: italic;">
                No mods running. Twitch chat can type !mod [prompt] or click presets below.
              </span>
            </div>
          </div>

          <!-- Quick Presets Trigger Bar -->
          <div class="presets-section">
            <span class="presets-label">⚡ Instant Codex Presets (1-Click Test)</span>
            <div class="presets-grid" id="presets-container"></div>
          </div>
        </section>

        <!-- Right: Twitch Chat Simulator & Codex AST Terminal -->
        <section class="control-hub">
          <!-- Live Twitch Chat Simulator -->
          <div class="chat-card">
            <div class="chat-header">
              <div class="chat-title">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/>
                </svg>
                <span>Twitch Stream Chat Simulator</span>
              </div>
              <button id="btn-toggle-auto-chat" class="btn btn-secondary" style="padding: 4px 10px; font-size: 11px;">
                Auto Chat: ON
              </button>
            </div>
            <div class="chat-feed" id="chat-feed"></div>
            <form class="chat-input-bar" id="chat-form">
              <input 
                type="text" 
                id="chat-input" 
                class="chat-input" 
                placeholder="Type as viewer (e.g. !mod neon ducks or !revert)..." 
                autocomplete="off"
              />
              <button type="submit" class="btn btn-primary" style="padding: 10px 14px;">Send</button>
            </form>
          </div>

          <!-- OpenAI Codex Synthesizer Terminal -->
          <div class="terminal-card">
            <div class="terminal-header">
              <div class="terminal-title">
                <span>🤖 CODEX AST COMPILER & HOT-SWAP HUD</span>
              </div>
              <span class="terminal-badge">AST SANDBOX: ARMED</span>
            </div>
            <div class="terminal-body" id="terminal-body">
              <div class="terminal-line info">[INIT] CodexChaos Engine initialized. AST Sandbox ready.</div>
              <div class="terminal-line cmd">[READY] Listening for Twitch IRC events & !mod directives...</div>
            </div>
          </div>
        </section>
      </main>
    </div>
  `;

  // Initialize Core Systems
  const canvas = document.getElementById('studio-canvas');
  const ctx = canvas.getContext('2d');
  const registry = new ModRegistry();
  const synthesizer = new CodexSynthesizer();
  const chatBridge = new TwitchChatBridge();

  function resizeCanvas() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  // Populate Presets Buttons
  const presetsContainer = document.getElementById('presets-container');
  Object.keys(PRESET_MODS).forEach((key) => {
    const preset = PRESET_MODS[key];
    const chip = document.createElement('button');
    chip.className = 'preset-chip';
    chip.innerHTML = `
      <span>${preset.title}</span>
      <span class="sub">${preset.prompt}</span>
    `;
    chip.addEventListener('click', () => {
      triggerModExecution(preset.title, preset.code, 'Streamer', preset.prompt);
    });
    presetsContainer.appendChild(chip);
  });

  // Terminal logging helper
  const terminalBody = document.getElementById('terminal-body');
  function logTerminal(text, type = 'info') {
    const line = document.createElement('div');
    line.className = `terminal-line ${type}`;
    line.textContent = `[${new Date().toLocaleTimeString()}] ${text}`;
    terminalBody.appendChild(line);
    terminalBody.scrollTop = terminalBody.scrollHeight;
  }

  // Update UI Active Mods Dock
  const activeModsList = document.getElementById('active-mods-list');
  const dockCount = document.getElementById('dock-count');
  const hudMods = document.getElementById('hud-mods');

  function updateModsDock() {
    const active = registry.getActiveMods();
    dockCount.textContent = `${active.length} running`;
    hudMods.textContent = `Active Mods: ${active.length}`;

    if (active.length === 0) {
      activeModsList.innerHTML = `
        <span style="font-size: 12px; color: var(--text-muted); font-style: italic;">
          No mods running. Twitch chat can type !mod [prompt] or click presets below.
        </span>
      `;
      return;
    }

    activeModsList.innerHTML = '';
    active.forEach((mod) => {
      const badge = document.createElement('div');
      badge.className = 'mod-badge';
      badge.innerHTML = `
        <span>⚡ ${mod.title}</span>
        <span style="font-size: 10px; color: var(--text-muted);">(@${mod.author})</span>
        <button class="remove-btn" title="Remove Mod">✕</button>
      `;
      badge.querySelector('.remove-btn').addEventListener('click', () => {
        registry.removeMod(mod.id);
        updateModsDock();
        logTerminal(`Removed mod "${mod.title}"`, 'warn');
      });
      activeModsList.appendChild(badge);
    });
  }

  // Function to apply a mod safely
  function triggerModExecution(title, code, author, prompt) {
    logTerminal(`Compiling AST for "${title}" by @${author}...`, 'cmd');
    try {
      registry.registerMod({
        title,
        code,
        author,
        prompt
      });
      logTerminal(`AST Verified Safe. Hot-swapped into 60fps frame loop!`, 'info');
      updateModsDock();
      syncChannel.postMessage({
        type: 'APPLY_MOD',
        payload: { title, code, author, prompt }
      });
    } catch (err) {
      logTerminal(`AST Violation Blocked: ${err.message}`, 'warn');
    }
  }

  // Revert & Clear Handlers
  document.getElementById('btn-revert-mod').addEventListener('click', () => {
    const success = registry.revertLastMod();
    if (success) {
      logTerminal(`Reverted most recent active mod`, 'warn');
      updateModsDock();
      syncChannel.postMessage({ type: 'REVERT_MOD' });
    }
  });

  document.getElementById('btn-clear-mods').addEventListener('click', () => {
    registry.clearAll();
    logTerminal(`Cleared all active mods`, 'warn');
    updateModsDock();
    syncChannel.postMessage({ type: 'CLEAR_MODS' });
  });

  // OBS Link Copy Button
  const copyBtn = document.getElementById('btn-copy-obs');
  const copyBtnText = document.getElementById('copy-btn-text');
  copyBtn.addEventListener('click', () => {
    const obsUrl = `${window.location.origin}${window.location.pathname}?view=obs`;
    navigator.clipboard.writeText(obsUrl).then(() => {
      copyBtnText.textContent = 'Copied to Clipboard!';
      setTimeout(() => {
        copyBtnText.textContent = 'Copy OBS Link';
      }, 2500);
    });
  });

  // Twitch Chat Hookup
  const chatFeed = document.getElementById('chat-feed');
  const chatForm = document.getElementById('chat-form');
  const chatInput = document.getElementById('chat-input');
  const toggleAutoChatBtn = document.getElementById('btn-toggle-auto-chat');

  let autoChatActive = true;
  toggleAutoChatBtn.addEventListener('click', () => {
    autoChatActive = !autoChatActive;
    if (autoChatActive) {
      chatBridge.startMockStream();
      toggleAutoChatBtn.textContent = 'Auto Chat: ON';
      toggleAutoChatBtn.className = 'btn btn-secondary';
    } else {
      chatBridge.stopMockStream();
      toggleAutoChatBtn.textContent = 'Auto Chat: OFF';
      toggleAutoChatBtn.className = 'btn btn-danger';
    }
  });

  chatBridge.onMessage((msg) => {
    const msgEl = document.createElement('div');
    msgEl.className = 'chat-message';
    const isCommand = msg.text.startsWith('!');

    if (isCommand) {
      msgEl.innerHTML = `
        <span class="chat-author" style="color: ${msg.color};">${msg.user}:</span>
        <span class="chat-command-pill">${escapeHtml(msg.text)}</span>
      `;
    } else {
      msgEl.innerHTML = `
        <span class="chat-author" style="color: ${msg.color};">${msg.user}:</span>
        <span>${escapeHtml(msg.text)}</span>
      `;
    }

    chatFeed.appendChild(msgEl);
    chatFeed.scrollTop = chatFeed.scrollHeight;
  });

  chatBridge.onCommand((cmd) => {
    if (cmd.command === 'mod') {
      handleChatModCommand(cmd.args, cmd.user);
    } else if (cmd.command === 'revert') {
      const success = registry.revertLastMod();
      if (success) {
        logTerminal(`Chat user @${cmd.user} triggered !revert`, 'warn');
        updateModsDock();
        syncChannel.postMessage({ type: 'REVERT_MOD' });
      }
    } else if (cmd.command === 'clear') {
      registry.clearAll();
      logTerminal(`Chat user @${cmd.user} cleared all mods`, 'warn');
      updateModsDock();
      syncChannel.postMessage({ type: 'CLEAR_MODS' });
    }
  });

  function handleChatModCommand(prompt, username) {
    logTerminal(`[TWITCH] @${username} requested mod: "${prompt}"`, 'info');
    logTerminal(`Querying OpenAI Codex Model for JavaScript AST synthesis...`, 'info');

    synthesizer.synthesizeMod(prompt).then((result) => {
      logTerminal(`Codex Synthesized: "${result.title}" (${result.code.length} chars)`, 'cmd');
      triggerModExecution(result.title, result.code, username, prompt);
    }).catch(err => {
      logTerminal(`Synthesis Error: ${err.message}`, 'warn');
    });
  }

  chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (!text) return;
    chatInput.value = '';
    chatBridge.receiveMessage({
      user: 'You',
      text,
      color: '#00f0ff'
    });
  });

  // Start auto chat stream
  chatBridge.startMockStream(5000);

  /**
   * Retro Pixel Game Background Simulation
   */
  const stars = Array.from({ length: 60 }, () => ({
    x: Math.random() * 1000,
    y: Math.random() * 600,
    speed: 0.5 + Math.random() * 2,
    size: 1 + Math.random() * 2
  }));

  let player = {
    x: 100,
    y: 200,
    vx: 2,
    vy: 1.5
  };

  function renderGameBackground() {
    // Space background
    ctx.fillStyle = '#0a0d18';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Moving stars
    ctx.fillStyle = '#ffffff';
    for (const star of stars) {
      star.x -= star.speed;
      if (star.x < 0) star.x = canvas.width;
      ctx.fillRect(star.x, star.y, star.size, star.size);
    }

    // Retro ground grid
    const groundY = canvas.height * 0.75;
    ctx.strokeStyle = 'rgba(145, 70, 255, 0.25)';
    ctx.lineWidth = 1;

    for (let x = 0; x < canvas.width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, groundY);
      ctx.lineTo(x - 50, canvas.height);
      ctx.stroke();
    }
    for (let y = groundY; y < canvas.height; y += 20) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Moving game ship
    player.x += player.vx;
    player.y += Math.sin(performance.now() * 0.003) * 1.5;
    if (player.x > canvas.width - 50 || player.x < 50) player.vx *= -1;

    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.fillStyle = '#00f0ff';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.moveTo(20, 0);
    ctx.lineTo(-15, -12);
    ctx.lineTo(-8, 0);
    ctx.lineTo(-15, 12);
    ctx.closePath();
    ctx.fill();

    // Engine thruster
    ctx.fillStyle = '#f43f5e';
    ctx.shadowColor = '#f43f5e';
    ctx.beginPath();
    ctx.moveTo(-8, -4);
    ctx.lineTo(-20 - Math.random() * 8, 0);
    ctx.lineTo(-8, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // 60 FPS Render Loop
  let lastTime = performance.now();
  let frameCount = 0;
  let fpsTimer = 0;
  const hudFps = document.getElementById('hud-fps');

  function renderLoop(time) {
    const deltaTime = Math.min((time - lastTime) / 1000, 0.1);
    lastTime = time;

    // FPS Counter
    frameCount++;
    fpsTimer += deltaTime;
    if (fpsTimer >= 0.5) {
      const currentFps = Math.round(frameCount / fpsTimer);
      hudFps.textContent = `FPS: ${currentFps}`;
      frameCount = 0;
      fpsTimer = 0;
    }

    // 1. Render Base Game
    renderGameBackground();

    // 2. Render Active Codex Mods Stack
    registry.renderAll(ctx, canvas, time);

    requestAnimationFrame(renderLoop);
  }

  requestAnimationFrame(renderLoop);
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
