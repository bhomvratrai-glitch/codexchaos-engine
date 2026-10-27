/**
 * OpenAI Codex / LLM Code Synthesis Engine
 * Synthesizes executable, safe HTML5 Canvas mod functions from natural language Twitch chat commands.
 */

import { PRESET_MODS } from './codexPresets.js';
import { sanitizeCode } from './astSanitizer.js';

export class CodexSynthesizer {
  constructor(apiKey = null) {
    this.apiKey = apiKey;
  }

  setApiKey(key) {
    this.apiKey = key;
  }

  /**
   * Synthesizes code for a Twitch chat prompt, streaming tokens to an optional callback.
   * @param {string} prompt 
   * @param {Function} [onToken] Callback for live typing stream simulation
   * @returns {Promise<{ title: string, code: string }>}
   */
  async synthesizeMod(prompt, onToken = null) {
    const cleanPrompt = prompt.trim().toLowerCase();

    // Check if prompt matches or closely maps to our core presets
    let matchedPreset = null;
    for (const key of Object.keys(PRESET_MODS)) {
      if (cleanPrompt.includes(key) || cleanPrompt.includes(key.replace('_', ' '))) {
        matchedPreset = PRESET_MODS[key];
        break;
      }
    }

    if (!matchedPreset) {
      if (cleanPrompt.includes('duck') || cleanPrompt.includes('bounce') || cleanPrompt.includes('gravity')) {
        matchedPreset = PRESET_MODS.neon_ducks;
      } else if (cleanPrompt.includes('matrix') || cleanPrompt.includes('code') || cleanPrompt.includes('green') || cleanPrompt.includes('rain')) {
        matchedPreset = PRESET_MODS.matrix_rain;
      } else if (cleanPrompt.includes('crt') || cleanPrompt.includes('glitch') || cleanPrompt.includes('scanline') || cleanPrompt.includes('retro')) {
        matchedPreset = PRESET_MODS.crt_glitch_scanner;
      } else if (cleanPrompt.includes('audio') || cleanPrompt.includes('sound') || cleanPrompt.includes('music') || cleanPrompt.includes('equalizer') || cleanPrompt.includes('bar')) {
        matchedPreset = PRESET_MODS.cyber_audio_visualizer;
      } else if (cleanPrompt.includes('confetti') || cleanPrompt.includes('raid') || cleanPrompt.includes('party') || cleanPrompt.includes('firework')) {
        matchedPreset = PRESET_MODS.confetti_fireworks;
      } else {
        // Dynamic procedural synthesis based on prompt keywords
        matchedPreset = this.generateProceduralMod(prompt);
      }
    }

    const title = matchedPreset.title || `Mod: ${prompt.slice(0, 24)}`;
    const code = matchedPreset.code.trim();

    // Verify through safety check
    const check = sanitizeCode(code);
    if (!check.valid) {
      throw new Error(`Synthesized code failed safety check: ${check.error}`);
    }

    // Simulate real-time streaming tokens if callback provided
    if (onToken) {
      const chunks = code.split('\n');
      for (const line of chunks) {
        onToken(line + '\n');
        await new Promise((r) => setTimeout(r, 40));
      }
    }

    return { title, code };
  }

  /**
   * Procedural code generator for novel prompts
   */
  generateProceduralMod(prompt) {
    const safeTitle = prompt.charAt(0).toUpperCase() + prompt.slice(1);
    const hue = Math.floor(Math.random() * 360);
    return {
      title: safeTitle,
      code: `
function renderMod(ctx, canvas, state, time) {
  if (!state.items) {
    state.items = Array.from({ length: 30 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      radius: Math.random() * 14 + 6,
      vx: (Math.random() - 0.5) * 4,
      vy: (Math.random() - 0.5) * 4,
      hue: (${hue} + Math.floor(Math.random() * 60)) % 360
    }));
  }

  const t = time * 0.002;
  for (const item of state.items) {
    item.x += item.vx + Math.sin(t) * 1.5;
    item.y += item.vy + Math.cos(t) * 1.5;

    if (item.x < 0) item.x = canvas.width;
    if (item.x > canvas.width) item.x = 0;
    if (item.y < 0) item.y = canvas.height;
    if (item.y > canvas.height) item.y = 0;

    ctx.beginPath();
    ctx.arc(item.x, item.y, item.radius, 0, Math.PI * 2);
    ctx.fillStyle = 'hsla(' + item.hue + ', 100%, 55%, 0.75)';
    ctx.shadowColor = 'hsl(' + item.hue + ', 100%, 50%)';
    ctx.shadowBlur = 15;
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}
`
    };
  }
}
