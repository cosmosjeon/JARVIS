const path = require('path');

const getRendererUrl = (route, params = {}) => {
  if (process.env.VITE_DEV_SERVER_URL) {
    const url = new URL(process.env.VITE_DEV_SERVER_URL);
    url.hash = route;
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') {
        return;
      }
      url.searchParams.set(key, value);
    });
    return url.toString();
  }

  let startPath = path.join(__dirname, '../../renderer/index.html');
  if (route) {
    startPath += `#${route}`;
  }
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }
    query.set(key, value);
  });
  const queryString = query.toString();
  return `${startPath}${queryString ? `?${queryString}` : ''}`;
};

module.exports = {
  getRendererUrl,
};
