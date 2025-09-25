# Sprint 2 – IPC 계약 초안

## 공통 규칙
- 모든 IPC 채널은 `snake-case` 접두사로 네임스페이스 구분 (`chat:*`, `highlight:*`, `state:*`)
- preload에서 contextBridge로 명시적으로 노출된 함수만 사용
- 모든 payload는 직렬화 가능한 객체/배열/원시 타입만 허용
- 에러 반환은 `{ success: false, error: { code, message } }` 형태

## 채팅 (chat)
| Channel | Direction | 요청 payload | 응답 payload | 설명 |
| --- | --- | --- | --- | --- |
| `chat:send` | Renderer → Main | `{ nodeId, message }` | `{ success, assistantMessage?, error? }` | 사용자가 입력한 질문을 메인 프로세스(혹은 백엔드 요청)로 전달 |
| `chat:history:get` | Renderer → Main | `{ nodeId }` | `{ success, messages: [] }` | 로컬 저장소/DB에서 대화 불러오기 |
| `chat:history:put` | Renderer → Main | `{ nodeId, messages }` | `{ success }` | 최신 대화를 저장 |
| `chat:typing` | Main → Renderer | `{ nodeId, progress }` | - | 실시간 스트리밍(선택) |

## 하이라이트 (highlight)
| Channel | Direction | 요청 payload | 응답 payload | 설명 |
| --- | --- | --- | --- | --- |
| `highlight:create` | Renderer → Main | `{ nodeId, texts: [] }` | `{ success, placeholderIds? }` | Electron 위젯에서 하이라이트 텍스트를 전달 |
| `highlight:clear` | Renderer → Main | `{ nodeId }` | `{ success }` | 저장된 하이라이트 초기화 |
| `highlight:preview` | Main → Renderer | `{ nodeId, texts }` | - | 하이라이트 반영(선택) |

## 상태 동기화 (state)
| Channel | Direction | 요청 payload | 응답 payload | 설명 |
| --- | --- | --- | --- | --- |
| `state:widget:update` | Renderer → Main | `{ expandedNodeId, layout }` | `{ success }` | 위젯 UI 상태를 저장 |
| `state:widget:get` | Renderer → Main | `{}` | `{ success, state }` | 마지막 UI 상태 복원 |
| `state:notify` | Main → Renderer | `{ type, message }` | - | 시스템 알림/오류 전달 |

## 시스템 (system)
| Channel | Direction | 요청 payload | 응답 payload | 설명 |
| --- | --- | --- | --- | --- |
| `system:ping` | Renderer → Main | `{}` | `{ success: true, data: 'pong' }` | 연결 헬스 체크 |
| `system:window:update` | Renderer → Main | `{ frameless?, transparent?, alwaysOnTop?, skipTaskbar? }` | `{ success, config }` | 창 옵션 실험용 (현재 `jarvisAPI.updateWindowConfig`에서 사용) |
| `logger:write` | Renderer → Main | `{ level?, message, meta? }` | `{ success }` | 렌더러 로그를 메인 로그/파일로 전달 |

## 권한/보안 노트
- Renderer → Main 요청은 모두 `ipcRenderer.invoke` 경로 사용 (Promise 기반)
- Main → Renderer 푸시는 `webContents.send`/`ipcRenderer.on`
- 채널 화이트리스트와 validation은 `ipcMain.handle`에서 수행
- 채널명/ payload 구조 변경 시 이 문서와 preload 인터페이스 동기화 필수
