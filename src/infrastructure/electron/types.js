/**
 * @typedef {Object} TreeWidgetBridge
 * @property {(options: {ignore: boolean, forward?: boolean}) => Promise<unknown>|unknown} setMousePassthrough
 *   Electron 창의 마우스 패스스루 상태를 제어합니다.
 * @property {(listener: (payload: {treeId?: string|null}) => void) => (() => void)} onSetActiveTree
 *   위젯이 활성 트리를 변경할 때 호출되는 핸들러를 등록합니다.
 * @property {() => Promise<unknown>|unknown} requestLibraryRefresh
 *   라이브러리 뷰 새로고침을 요청합니다.
 * @property {(payload: {question: string}) => Promise<{success?: boolean, keyword?: string, answer?: string}>|null} extractKeyword
 *   질문 텍스트에서 대표 키워드를 추출합니다.
 * @property {(level: 'info'|'warn'|'error', event: string, context?: Record<string, unknown>) => void} log
 *   로깅 브리지를 통해 이벤트를 전송합니다.
 * @property {{
 *   maximize: () => Promise<unknown>|unknown,
 *   close: () => Promise<unknown>|unknown,
 * }} windowControls
 *   창 제어 함수 모음입니다.
 * @property {() => Promise<unknown>|unknown} toggleWindow
 *   창 표시/숨김을 토글합니다.
 */

export {}; // JSDoc 타입 선언 전용 파일
