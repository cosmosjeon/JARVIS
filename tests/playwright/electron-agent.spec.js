'use strict';

const { test, expect } = require('@playwright/test');
const { _electron: electron } = require('playwright');
const { spawn } = require('child_process');
const waitOn = require('wait-on');
const path = require('path');
const fs = require('fs');
const os = require('os');

const projectRoot = path.resolve(__dirname, '../../');
const logPath = path.join(os.homedir(), 'Library', 'Application Support', 'hierarchical-force-tree-react', 'logs', 'app.log');

let rendererProcess;
let rendererOwned = false;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isRendererAvailable = async () => {
  try {
    await waitOn({
      resources: ['http://127.0.0.1:3000'],
      timeout: 3_000,
      validateStatus: (status) => status >= 200 && status < 500,
    });
    return true;
  } catch (error) {
    return false;
  }
};

const startRendererServer = async () => {
  if (await isRendererAvailable()) {
    console.info('[playwright] renderer dev server already running on port 3000, reusing existing instance.');
    rendererOwned = false;
    return;
  }

  rendererProcess = spawn('npm', ['run', 'start:renderer'], {
    cwd: projectRoot,
    shell: true,
    env: {
      ...process.env,
      BROWSER: 'none',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  rendererOwned = true;

  rendererProcess.stdout.on('data', (data) => {
    process.stdout.write(`[renderer] ${data}`);
  });
  rendererProcess.stderr.on('data', (data) => {
    process.stderr.write(`[renderer:err] ${data}`);
  });

  let ready = false;
  const startupPromise = waitOn({
    resources: ['http://127.0.0.1:3000'],
    timeout: 120_000,
    validateStatus: (status) => status >= 200 && status < 500,
  }).then(() => {
    ready = true;
  });

  rendererProcess.once('exit', (code, signal) => {
    rendererProcess = null;
    rendererOwned = false;
    if (!ready) {
      throw new Error(`[playwright] renderer dev server exited prematurely (code=${code}, signal=${signal})`);
    }
  });

  await startupPromise;
};

const stopRendererServer = async () => {
  if (!rendererProcess || !rendererOwned) {
    return;
  }
  const proc = rendererProcess;
  rendererProcess = null;
  rendererOwned = false;
  proc.kill('SIGTERM');
  await wait(2_000);
  if (!proc.killed) {
    proc.kill('SIGKILL');
  }
};

const ensureJarvisAPI = async (page) => {
  await page.waitForFunction(() => {
    return typeof window !== 'undefined'
      && window.jarvisAPI
      && typeof window.jarvisAPI.askRoot === 'function';
  }, null, { timeout: 60_000 });
};

const launchElectronApp = async () => {
  const electronApp = await electron.launch({
    args: ['.'],
    cwd: projectRoot,
    env: {
      ...process.env,
      ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
      JARVIS_ALLOW_MULTIPLE_INSTANCES: 'true',
    },
  });

  const page = await electronApp.firstWindow();
  await ensureJarvisAPI(page);
  return { electronApp, page };
};

const getLogSize = () => {
  try {
    const stats = fs.statSync(logPath);
    return stats.size;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return 0;
    }
    throw error;
  }
};

const readLogTail = (offset) => {
  try {
    const content = fs.readFileSync(logPath, 'utf-8');
    if (offset <= 0) {
      return content;
    }
    if (offset >= content.length) {
      return '';
    }
    return content.slice(offset);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return '';
    }
    throw error;
  }
};

const waitForLogEntry = async (keyword, since, matchers = [], timeout = 120_000) => {
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    const snippet = readLogTail(since);
    const hasKeyword = snippet.includes(keyword);
    const hasAllMatchers = Array.isArray(matchers)
      ? matchers.every((matcher) => {
        if (typeof matcher === 'string') {
          return snippet.includes(matcher);
        }
        if (matcher instanceof RegExp) {
          return matcher.test(snippet);
        }
        if (typeof matcher === 'function') {
          return matcher(snippet);
        }
        return true;
      })
      : true;

    if (hasKeyword && hasAllMatchers) {
      return snippet;
    }

    await wait(1_000);
  }

  const tail = readLogTail(since);
  throw new Error(`Failed to find log entry "${keyword}". Recent log tail:\n${tail}`);
};

const buildMessages = (question) => ([
  {
    role: 'system',
    content: '당신은 전문적인 한국어 연구 어시스턴트입니다. 모든 대답은 한국어로 작성하세요.',
  },
  {
    role: 'user',
    content: question,
  },
]);

const invokeAskRoot = async (page, payload) => {
  return page.evaluate((args) => window.jarvisAPI.askRoot(args), payload);
};

test.describe.serial('Electron LLM 통합', () => {
  test.beforeAll(async () => {
    test.setTimeout(360_000);
    await startRendererServer();
  });

  test.afterAll(async () => {
    await stopRendererServer();
  });

  test('OpenAI 빠른 응답 및 웹검색 시나리오', async () => {
    const { electronApp, page } = await launchElectronApp();

    try {
      // 빠른 응답 모드 (gpt-5-mini)
      const fastLogOffset = getLogSize();
      const fastResult = await invokeAskRoot(page, {
        provider: 'openai',
        model: 'gpt-5-mini',
        webSearchEnabled: false,
        messages: buildMessages('전통적인 김치의 핵심 재료 세 가지와 간단한 설명을 120자 이내로 알려줘.'),
      });

      expect(fastResult?.success).toBeTruthy();
      expect(typeof fastResult?.answer).toBe('string');
      expect(fastResult.answer.trim().length).toBeGreaterThan(0);

      await waitForLogEntry(
        'openai_request_succeeded',
        fastLogOffset,
        [ /model:\s*'gpt-5-mini/, /webSearchEnabled:\s*false/ ],
      );

      // 웹검색 모드 (gpt-5)
      const searchLogOffset = getLogSize();
      const searchResult = await invokeAskRoot(page, {
        provider: 'openai',
        model: 'gpt-5',
        webSearchEnabled: true,
        messages: buildMessages('2024년 7월 이후의 대한민국 우주 탐사 소식을 요약하고, 가능한 경우 근거 출처를 명시해줘.'),
      });

      expect(searchResult?.success).toBeTruthy();
      expect(typeof searchResult?.answer).toBe('string');
      expect(searchResult.answer.trim().length).toBeGreaterThan(0);

      await waitForLogEntry(
        'openai_request_succeeded',
        searchLogOffset,
        [ /model:\s*'gpt-5/, /webSearchEnabled:\s*true/ ],
      );
    } finally {
      await electronApp.close();
    }
  });

  test('Google Gemini 기본 응답', async () => {
    const { electronApp, page } = await launchElectronApp();

    try {
      const logOffset = getLogSize();
      const result = await invokeAskRoot(page, {
        provider: 'gemini',
        model: 'gemini-2.5-pro',
        webSearchEnabled: false,
        messages: buildMessages('삼국시대 백제의 대표적인 문화유산 두 가지를 소개하고 특징을 요약해줘.'),
      });

      expect(result?.success).toBeTruthy();
      expect(typeof result?.answer).toBe('string');
      expect(result.answer.trim().length).toBeGreaterThan(0);

      await waitForLogEntry(
        'gemini_request_succeeded',
        logOffset,
        [ /model:\s*'gemini-2\.5-/, /webSearchEnabled:\s*false/ ],
      );
    } finally {
      await electronApp.close();
    }
  });

  test('Anthropic Claude 빠른 응답', async () => {
    const { electronApp, page } = await launchElectronApp();

    try {
      const logOffset = getLogSize();
      const result = await invokeAskRoot(page, {
        provider: 'claude',
        model: 'claude-3-5-haiku-latest',
        webSearchEnabled: false,
        messages: buildMessages('최근 12개월 동안의 인공지능 거버넌스 주요 이슈 세 가지를 간결하게 정리해줘.'),
      });

      expect(result?.success).toBeTruthy();
      expect(typeof result?.answer).toBe('string');
      expect(result.answer.trim().length).toBeGreaterThan(0);

      await waitForLogEntry(
        'claude_request_succeeded',
        logOffset,
        [ /model:\s*'claude-3-5-haiku/, /webSearchEnabled:\s*false/ ],
      );
    } finally {
      await electronApp.close();
    }
  });
});
