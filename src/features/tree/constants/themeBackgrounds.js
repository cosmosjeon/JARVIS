export const TREE_BACKGROUND_BY_THEME = Object.freeze({
  glass: 'linear-gradient(135deg, rgba(30, 41, 59, 0.12), rgba(30, 41, 59, 0.18))',
  light: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(240, 240, 240, 0.95))',
  dark: 'rgb(26, 26, 26)',
});

export const resolveTreeBackground = (theme) => {
  if (!theme) {
    return TREE_BACKGROUND_BY_THEME.glass;
  }
  return TREE_BACKGROUND_BY_THEME[theme] || TREE_BACKGROUND_BY_THEME.glass;
};

export default resolveTreeBackground;
