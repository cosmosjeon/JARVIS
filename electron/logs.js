const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const exportLogs = async ({ targetDir } = {}) => {
  const userData = app.getPath('userData');
  const logFile = path.join(userData, 'logs', 'app.log');

  if (!fs.existsSync(logFile)) {
    return { success: false, error: { code: 'not_found', message: 'Log file not found' } };
  }

  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `jarvis-log-${timestamp}.log`;
    const destinationDir = targetDir || app.getPath('desktop');
    const destinationPath = path.join(destinationDir, fileName);

    fs.copyFileSync(logFile, destinationPath);

    return {
      success: true,
      path: destinationPath,
    };
  } catch (error) {
    return {
      success: false,
      error: { code: 'export_failed', message: error?.message },
    };
  }
};

module.exports = {
  exportLogs,
};
