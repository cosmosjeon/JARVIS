const { contextBridge, ipcRenderer } = require('electron');

console.log('[preload] Starting preload script...');

if (process.env.ELECTRON_RUN_AS_NODE === '1') {
  console.log('[preload] Skipping jarvisAPI exposure (ELECTRON_RUN_AS_NODE set)');
} else {
  console.log('[preload] Loading channel modules...');
  
  const channelFactories = {
    system: require('./channels/system'),
    windowControls: require('./channels/windowControls'),
    admin: require('./channels/admin'),
    library: require('./channels/library'),
    settings: require('./channels/settings'),
    agent: require('./channels/agent'),
    logger: require('./channels/logger'),
    clipboard: require('./channels/clipboard'),
    tray: require('./channels/tray'),
    widget: require('./channels/widget'),
    oauth: require('./channels/oauth'),
  };

  console.log('[preload] Channel modules loaded successfully');

  const api = {};

  for (const [name, factory] of Object.entries(channelFactories)) {
    try {
      console.log(`[preload] Building API segment: ${name}`);
      const segment = typeof factory === 'function' ? factory(ipcRenderer) : factory;
      if (segment && typeof segment === 'object') {
        const keys = Object.keys(segment);
        console.log(`[preload] API segment ${name} added ${keys.length} methods:`, keys);
        Object.assign(api, segment);
      } else {
        console.warn(`[preload] API segment ${name} returned invalid type:`, typeof segment);
      }
    } catch (error) {
      console.error(`[preload] Failed to build API segment: ${name}`, error);
    }
  }

  console.log('[preload] Total API methods:', Object.keys(api).length);

  try {
    contextBridge.exposeInMainWorld('jarvisAPI', api);
    console.log('[preload] jarvisAPI exposed successfully with methods:', Object.keys(api));
    console.log('[preload] jarvisAPI ready ✓');
  } catch (error) {
    console.error('[preload] Failed to expose jarvisAPI', error);
  }
}
