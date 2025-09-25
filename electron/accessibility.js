const { shell, systemPreferences } = require('electron');

const isMac = process.platform === 'darwin';

const checkAccessibilityPermission = () => {
  if (!isMac || typeof systemPreferences?.isTrustedAccessibilityClient !== 'function') {
    return true;
  }
  try {
    return systemPreferences.isTrustedAccessibilityClient(false);
  } catch (error) {
    return false;
  }
};

const requestAccessibilityPermission = () => {
  if (!isMac || typeof systemPreferences?.isTrustedAccessibilityClient !== 'function') {
    return { granted: true };
  }
  try {
    const granted = systemPreferences.isTrustedAccessibilityClient(true);
    if (!granted) {
      shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility');
    }
    return { granted };
  } catch (error) {
    return { granted: false, error: error?.message };
  }
};

module.exports = {
  isMac,
  checkAccessibilityPermission,
  requestAccessibilityPermission,
};
