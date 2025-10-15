# VORAN HTTP 에이전트 프록시

브라우저 런타임에서 VORAN API를 호출하려면, 비공개 LLM 키를 대신 보관하고 요청을 중계하는 HTTP 프록시가 필요합니다. 이 문서는 `npm run start:agent-proxy`로 실행되는 경량 프록시 서버를 구성하는 방법을 설명합니다.

## 1. 실행 방법

```bash
npm run start:agent-proxy
```

- 기본 포트는 `8787`이며 `http://0.0.0.0:8787` 에서 대기합니다.
- 종료는 `Ctrl + C`.
- Node 18 이상을 권장합니다(내장 `fetch` 사용).

## 2. 환경 변수

| 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `AGENT_PROXY_PORT` | `8787` | 프록시 서버 포트 |
| `AGENT_PROXY_HOST` | `0.0.0.0` | 바인딩 호스트 |
| `AGENT_PROXY_TOKEN` | _(없음)_ | 클라이언트 인증 토큰. 설정 시 `Authorization: Bearer <token>` 필요 |
| `AGENT_PROXY_HEADER` | `Authorization` | 토큰을 읽을 헤더 이름 |
| `AGENT_PROXY_CORS_ORIGIN` | `*` | CORS `Access-Control-Allow-Origin` 값 |
| `AGENT_PROXY_MAX_BODY_BYTES` | `1048576` | 요청 본문 최대 크기(바이트) |

LLM 호출에 필요한 키는 다음과 같이 표준 환경 변수로 주입합니다.

```bash
export OPENAI_API_KEY=...
export GEMINI_API_KEY=...
export ANTHROPIC_API_KEY=...
```

## 3. 클라이언트 설정

브라우저 번들에서는 아래 환경 변수를 통해 프록시 엔드포인트를 등록합니다.

```bash
REACT_APP_AGENT_HTTP_ENDPOINT=https://<proxy-host>/agent/:channel
REACT_APP_AGENT_HTTP_TOKEN=<AGENT_PROXY_TOKEN과 동일하거나 Bearer 포맷>
```

- `:channel` 플레이스홀더는 `askRoot`, `askChild`, `extractKeyword` 중 하나로 자동 치환됩니다.
- 토큰이 필요 없는 경우 `REACT_APP_AGENT_HTTP_TOKEN`은 생략합니다.
- 헤더 이름을 커스터마이징했다면 `REACT_APP_AGENT_HTTP_HEADER`도 동일하게 맞춰야 합니다.

## 4. 요청/응답 구조

- **요청** `POST /agent/askRoot`
  ```json
  {
    "messages": [...],
    "provider": "openai",
    "model": "gpt-5"
  }
  ```
- **응답**
  ```json
  {
    "success": true,
    "answer": "...",
    "provider": "openai",
    "model": "gpt-5",
    "latencyMs": 1234
  }
  ```

에러 시에는 `success: false`와 함께 `error.code`, `error.message`가 반환됩니다.

## 5. 보안 가이드

- 프로덕션에서는 반드시 `AGENT_PROXY_TOKEN`을 설정하고 HTTPS 뒤에 두세요.
- 필요 시 reverse proxy(Nginx, Cloudflare 등)에서 추가 IP 허용 목록을 적용하십시오.
- 브라우저 코드에는 절대 LLM 비밀 키를 직접 넣지 않습니다.
