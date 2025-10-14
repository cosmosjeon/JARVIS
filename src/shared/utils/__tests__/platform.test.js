import { getRuntime, isElectron, isWeb, constants } from '../platform';

describe('platform utils', () => {
  const originalWindow = global.window;
  const originalProcess = global.process;

  afterEach(() => {
    if (originalWindow) {
      global.window = originalWindow;
    } else {
      delete global.window;
    }
    global.process = originalProcess;
  });

  it('should detect electron when window.jarvisAPI exists', () => {
    global.window = {
      jarvisAPI: {},
      navigator: { userAgent: '' },
    };

    expect(getRuntime()).toBe(constants.RUNTIME_ELECTRON);
    expect(isElectron()).toBe(true);
    expect(isWeb()).toBe(false);
  });

  it('should detect electron when process.versions.electron exists', () => {
    delete global.window;
    global.process = {
      env: {},
      versions: { electron: '30.0.0' },
    };

    expect(getRuntime()).toBe(constants.RUNTIME_ELECTRON);
    expect(isElectron()).toBe(true);
    expect(isWeb()).toBe(false);
  });

  it('should treat unknown runtime as web', () => {
    delete global.window;
    global.process = { env: {} };

    expect(getRuntime()).toBe(constants.RUNTIME_UNKNOWN);
    expect(isElectron()).toBe(false);
    expect(isWeb()).toBe(true);
  });

  it('should respect REACT_APP_PLATFORM override', () => {
    delete global.window;
    global.process = {
      env: { REACT_APP_PLATFORM: 'electron' },
    };

    expect(getRuntime()).toBe(constants.RUNTIME_ELECTRON);
    expect(isElectron()).toBe(true);
    expect(isWeb()).toBe(false);
  });
});
