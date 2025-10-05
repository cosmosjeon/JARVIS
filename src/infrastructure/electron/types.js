/**
* @typedef {Object} TreeWidgetBridge
 * @property {(options: {ignore: boolean, forward?: boolean}) => Promise<unknown>|unknown} setMousePassthrough
 *   Electron 창의 마우스 패스스루 상태를 제어합니다.
 * @property {(listener: (payload: {treeId?: string|null}) => void) => (() => void)} onSetActiveTree
 *   위젯이 활성 트리를 변경할 때 호출되는 핸들러를 등록합니다.
 * @property {() => Promise<unknown>|unknown} requestLibraryRefresh
 *   라이브러리 뷰 새로고침을 요청합니다.
 * @property {(payload: {treeId: string, reusePrimary?: boolean, fresh?: boolean}) => Promise<{success?: boolean, error?: Error}>|null} openWidget
 *   주어진 트리를 위젯 창으로 띄웁니다.
 * @property {(payload: {question: string}) => Promise<{success?: boolean, keyword?: string, answer?: string}>|null} extractKeyword
 *   질문 텍스트에서 대표 키워드를 추출합니다.
 * @property {(level: 'info'|'warn'|'error', event: string, context?: Record<string, unknown>) => void} log
 *   로깅 브리지를 통해 이벤트를 전송합니다.
 * @property {{
 *   maximize: () => Promise<unknown>|unknown,
 *   toggleFullScreen: () => Promise<unknown>|unknown,
 *   close: () => Promise<unknown>|unknown,
 * }} windowControls
 *   창 제어 함수 모음입니다.
 * @property {() => Promise<unknown>|unknown} toggleWindow
 *   창 표시/숨김을 토글합니다.
 */

/**
 * @typedef {Object} AgentBridge
 * @property {(payload: any) => Promise<{ success?: boolean }>|null} askRoot
 *   루트 노드용 답변을 요청합니다.
 * @property {(payload: any) => Promise<{ success?: boolean }>|null} askChild
 *   자식 노드용 답변을 요청합니다.
 * @property {(payload: { question: string }) => Promise<{ success?: boolean, keyword?: string }>|null} extractKeyword
 *   질문에서 대표 키워드를 추출합니다.
 */

/**
 * @typedef {Object} WindowControlsBridge
 * @property {() => Promise<{success?: boolean, state?: { maximized?: boolean, fullscreen?: boolean }}>|null} getState
 *   현재 창 상태를 조회합니다.
 * @property {(listener: (state: { maximized?: boolean, fullscreen?: boolean }) => void) => (() => void)} onStateChange
 *   창 상태 변경 이벤트를 구독합니다.
 * @property {() => Promise<unknown>|unknown} maximize
 *   창을 최대화합니다.
 * @property {() => Promise<unknown>|unknown} toggleFullScreen
 *   전체 화면 모드로 전환하거나 해제합니다.
 * @property {() => Promise<unknown>|unknown} minimize
 *   창을 최소화합니다.
 * @property {() => Promise<unknown>|unknown} restore
 *   창을 복원합니다.
 * @property {() => Promise<unknown>|unknown} close
 *   창을 닫습니다.
 * @property {() => Promise<unknown>|unknown} toggleWindow
 *   창 표시/숨김을 전환합니다.
 */

/**
 * @typedef {Object} ClipboardBridge
 * @property {(listener: (payload: { text?: string }) => void) => (() => void)} onClipboard
 *   클립보드 텍스트 공유 이벤트를 구독합니다.
 * @property {(listener: (payload: { error?: { code?: string } }) => void) => (() => void)} onClipboardError
 *   클립보드 오류 이벤트를 구독합니다.
 */

/**
 * @typedef {Object} SettingsBridge
 * @property {() => Promise<{ settings?: Record<string, unknown> }>|null} getSettings
 *   현재 설정을 조회합니다.
 * @property {(partial: Record<string, unknown>) => Promise<unknown>|unknown} updateSettings
 *   설정을 부분 업데이트합니다.
 * @property {(listener: (settings: Record<string, unknown>) => void) => (() => void)} onSettings
 *   설정 변경 이벤트를 구독합니다.
 */

/**
 * @typedef {Object} LoggerBridge
 * @property {(level: 'info'|'warn'|'error', message: string, meta?: Record<string, unknown>) => Promise<unknown>|unknown} log
 *   로그를 기록합니다.
 * @property {(listener: (payload: any) => void) => (() => void)} onLog
 *   로그 이벤트를 구독합니다.
 * @property {(options?: Record<string, unknown>) => Promise<{ success?: boolean, path?: string, error?: any }>|null} exportLogs
 *   로그 파일을 내보냅니다.
 */

/**
 * @typedef {Object} TrayBridge
 * @property {(listener: (payload: { command?: string, timestamp?: number }) => void) => (() => void)} onTrayCommand
 *   트레이 명령 이벤트를 구독합니다.
 */

/**
 * @typedef {Object} SystemBridge
 * @property {() => Promise<{ success?: boolean, granted?: boolean }>|null} checkAccessibilityPermission
 *   접근성 권한 상태를 조회합니다.
 * @property {() => Promise<{ success?: boolean, granted?: boolean }>|null} requestAccessibilityPermission
 *   접근성 권한을 요청합니다.
 */

/**
 * @typedef {Object} OAuthBridge
 * @property {(listener: (url: string) => void) => (() => void)} onOAuthCallback
 *   OAuth 콜백 URL을 구독합니다.
 * @property {(options?: { mode?: string }) => Promise<{ success?: boolean, url?: string }>|null} getOAuthRedirect
 *   Electron OAuth 리다이렉트 URL을 요청합니다.
 * @property {(url: string) => Promise<{ success?: boolean }>|null} launchOAuth
 *   외부 OAuth 페이지를 브라우저로 엽니다.
 */

/**
 * @typedef {Object} LibraryBridge
 * @property {() => Promise<{ success?: boolean }>|null} showLibrary
 *   라이브러리 창을 표시합니다.
 * @property {() => Promise<{ success?: boolean }>|null} requestLibraryRefresh
 *   라이브러리 데이터를 새로고침합니다.
 * @property {(listener: () => void) => (() => void)} onLibraryRefresh
 *   라이브러리 새로고침 이벤트를 구독합니다.
 */

/**
 * @typedef {Object} AdminBridge
 * @property {() => Promise<{ success?: boolean }>|null} openAdminPanel
 *   Admin 패널을 엽니다.
 * @property {() => Promise<{ success?: boolean }>|null} closeAdminPanel
 *   Admin 패널을 닫습니다.
 */

export {}; // JSDoc 타입 선언 전용 파일
