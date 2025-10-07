export const DEFAULT_CHAT_PANEL_STYLES = Object.freeze({
  background: 'rgba(255, 255, 255, 0.85)',
  borderColor: 'rgba(0, 0, 0, 0.2)',
  textColor: 'rgba(0, 0, 0, 0.9)',
  subtleTextColor: 'rgba(0, 0, 0, 0.7)',
});

export const DEFAULT_CHAT_THEME = 'light';

export const isLightLikeChatTheme = (theme) => theme === 'light' || theme === 'glass';
