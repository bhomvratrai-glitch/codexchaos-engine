/**
 * Mod Registry & State Snapshot Engine for CodexChaos
 * Tracks running on-screen effects, layers them, and handles instant rollback.
 */

import { compileSafeMod } from './astSanitizer.js';

export class ModRegistry {
  constructor() {
    this.activeMods = new Map();
    this.history = [];
    this.listeners = new Set();
  }

  /**
   * Register and activate a new mod.
   * @param {Object} options
   * @param {string} options.id
   * @param {string} options.title
   * @param {string} options.author
   * @param {string} options.prompt
   * @param {string} options.code
   * @param {number} [options.duration=30000] Mod lifetime in ms (0 for indefinite)
   * @returns {Object} registered mod metadata
   */
  registerMod({ id, title, author, prompt, code, duration = 30000 }) {
    const fn = compileSafeMod(code);
    const mod = {
      id: id || `mod_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      title: title || 'Custom Chat Mod',
      author: author || 'TwitchViewer',
      prompt,
      code,
      renderFn: fn,
      state: {}, // Local state object passed to renderFn
      createdAt: Date.now(),
      duration,
      expiresAt: duration > 0 ? Date.now() + duration : null
    };

    this.activeMods.set(mod.id, mod);
    this.history.push({ ...mod });
    this.notifyListeners();
    return mod;
  }

  /**
   * Render all active mods on a given canvas context.
   * @param {CanvasRenderingContext2D} ctx 
   * @param {HTMLCanvasElement} canvas 
   * @param {number} timestamp 
   */
  renderAll(ctx, canvas, timestamp) {
    const now = Date.now();
    for (const [id, mod] of this.activeMods.entries()) {
      if (mod.expiresAt && now > mod.expiresAt) {
        this.activeMods.delete(id);
        this.notifyListeners();
        continue;
      }

      try {
        mod.renderFn(ctx, canvas, mod.state, timestamp);
      } catch (err) {
        console.error(`Runtime error in mod [${mod.title}]:`, err);
        // Automatically drop failing mod to prevent stream freeze
        this.activeMods.delete(id);
        this.notifyListeners();
      }
    }
  }

  /**
   * Reverts the most recently added mod.
   * @returns {boolean} true if a mod was removed
   */
  revertLastMod() {
    if (this.activeMods.size === 0) return false;
    const keys = Array.from(this.activeMods.keys());
    const lastKey = keys[keys.length - 1];
    this.activeMods.delete(lastKey);
    this.notifyListeners();
    return true;
  }

  /**
   * Clears all active mods instantly.
   */
  clearAll() {
    this.activeMods.clear();
    this.notifyListeners();
  }

  /**
   * Remove a specific mod by ID
   * @param {string} id
   */
  removeMod(id) {
    if (this.activeMods.has(id)) {
      this.activeMods.delete(id);
      this.notifyListeners();
      return true;
    }
    return false;
  }

  /**
   * Get array of all currently active mods
   * @returns {Array}
   */
  getActiveMods() {
    return Array.from(this.activeMods.values());
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notifyListeners() {
    const list = Array.from(this.activeMods.values());
    for (const listener of this.listeners) {
      listener(list);
    }
  }
}
