/**
 * Twitch IRC & EventSub Chat Bridge for CodexChaos Engine
 * Captures chat commands (!mod, !revert, !clear), channel points, and simulates live chat events.
 */

export class TwitchChatBridge {
  constructor() {
    this.listeners = new Set();
    this.commandListeners = new Set();
    this.channel = 'streamer';
    this.isConnected = false;
    this.mockInterval = null;
  }

  onMessage(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  onCommand(callback) {
    this.commandListeners.add(callback);
    return () => this.commandListeners.delete(callback);
  }

  /**
   * Processes an incoming raw chat line or simulated message.
   * @param {Object} msg
   * @param {string} msg.user
   * @param {string} msg.text
   * @param {string} [msg.color='#00ffcc']
   * @param {boolean} [msg.isMod=false]
   */
  receiveMessage({ user, text, color = '#00ffcc', isMod = false }) {
    const chatEvent = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      user,
      text,
      color,
      isMod,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    };

    // Emit to message listeners
    for (const cb of this.listeners) {
      cb(chatEvent);
    }

    // Command parsing
    const trimmed = text.trim();
    if (trimmed.startsWith('!')) {
      const parts = trimmed.slice(1).split(' ');
      const command = parts[0].toLowerCase();
      const args = parts.slice(1).join(' ');

      for (const cb of this.commandListeners) {
        cb({ command, args, user, isMod, raw: text });
      }
    }
  }

  /**
   * Start mock viewer simulation for testing without connecting to live Twitch
   */
  startMockStream(intervalMs = 4500) {
    if (this.mockInterval) return;
    this.isConnected = true;

    const mockViewers = [
      { user: 'PixelKnight', color: '#9146FF' },
      { user: 'CyberGamer99', color: '#00F0FF' },
      { user: 'NeonSamurai', color: '#FF0055' },
      { user: 'CodeMaster_Live', color: '#00FF66' },
      { user: 'TwitchModAlpha', color: '#FFD700', isMod: true },
      { user: 'RetroVibes', color: '#FF7700' }
    ];

    const sampleCommands = [
      '!mod matrix neon rain with green glow',
      '!mod bouncing neon ducks with low gravity',
      '!mod retro 80s crt scanlines and glitch bars',
      '!mod neon audio visualizer equalizer spectrum',
      '!mod festive confetti fireworks burst',
      'poggers that code looks insane!',
      'can we make the ducks bounce higher?? lol',
      '!revert',
      '!mod matrix digital rain'
    ];

    let index = 0;
    this.mockInterval = setInterval(() => {
      const viewer = mockViewers[Math.floor(Math.random() * mockViewers.length)];
      const text = sampleCommands[index % sampleCommands.length];
      index++;
      this.receiveMessage({
        user: viewer.user,
        text,
        color: viewer.color,
        isMod: viewer.isMod || false
      });
    }, intervalMs);
  }

  stopMockStream() {
    if (this.mockInterval) {
      clearInterval(this.mockInterval);
      this.mockInterval = null;
      this.isConnected = false;
    }
  }
}
