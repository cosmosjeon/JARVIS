const path = require('path');
const { pathToFileURL } = require('url');

const buildUrlWithParams = (baseUrl, mode, params = {}) => {
  const url = new URL(baseUrl);
  if (mode) {
    url.searchParams.set('mode', mode);
  }
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }
    url.searchParams.set(key, value);
  });
  return url.toString();
};

const resolveDevelopmentBaseUrl = () => {
  if (process.env.VITE_DEV_SERVER_URL) {
    return process.env.VITE_DEV_SERVER_URL;
  }
  if (process.env.ELECTRON_START_URL) {
    return process.env.ELECTRON_START_URL;
  }
  if (process.env.NODE_ENV !== 'production') {
    return 'http://localhost:3000';
  }
  return null;
};

const getRendererUrl = (mode, params = {}) => {
  const devBaseUrl = resolveDevelopmentBaseUrl();
  if (devBaseUrl) {
    return buildUrlWithParams(devBaseUrl, mode, params);
  }

  const fileUrl = pathToFileURL(path.join(__dirname, '..', '..', 'build', 'index.html')).toString();
  return buildUrlWithParams(fileUrl, mode, params);
};

module.exports = {
  getRendererUrl,
};
