const WINDOW_CHROME_HEIGHT = 48;

export const getViewportDimensions = () => {
  if (typeof window === 'undefined') {
    return { width: 1024, height: 720 - WINDOW_CHROME_HEIGHT };
  }

  return {
    width: window.innerWidth,
    height: Math.max(window.innerHeight - WINDOW_CHROME_HEIGHT, 0),
  };
};

export const calculateNodeScaleFactor = (dimensions) => {
  const BASE_WIDTH = 1024;
  const BASE_HEIGHT = 720 - WINDOW_CHROME_HEIGHT;

  const currentWidth = dimensions?.width || BASE_WIDTH;
  const currentHeight = dimensions?.height || BASE_HEIGHT;

  const widthScale = currentWidth / BASE_WIDTH;
  const heightScale = currentHeight / BASE_HEIGHT;
  const scaleFactor = Math.min(widthScale, heightScale);

  return Math.max(0.4, Math.min(2.0, scaleFactor));
};

export default {
  getViewportDimensions,
  calculateNodeScaleFactor,
};
