# Library Web Runbook

## 배포 절차
1. `npx dotenv -e .env.local -- npm run check:env`로 필수 환경 변수 검증
2. `npm run build:web`
3. `npm run smoke:web`
4. `git push` → Vercel main/preview 자동 배포 확인

> 참고: `npm run check:env`과 `npm run smoke:web`은 내부적으로 `.env.local`을 자동으로 읽도록 수정되어 있으므로 직접 실행해도 동일하게 동작합니다.

### 필수 환경 변수
- 클라이언트: `REACT_APP_SUPABASE_URL`, `REACT_APP_SUPABASE_ANON_KEY`, `REACT_APP_AGENT_HTTP_ENDPOINT`(프로덕션은 `/api/agent/:channel` 권장), `REACT_APP_AGENT_HTTP_TOKEN`
- 서버(Vercel Functions): `OPENAI_API_KEY`, `AGENT_HTTP_TOKEN`, 필요 시 `AGENT_HTTP_HEADER`

## 롤백
- Vercel에서 이전 배포로 Promote
- Supabase OAuth 리다이렉트 URL 변경이 있었다면 즉시 되돌림
- Vercel Functions(`/api/agent/[channel]`) 에 올린 AI 프록시 설정이 잘못됐을 경우, 이전 버전으로 롤백 후 `AGENT_HTTP_TOKEN`/`OPENAI_API_KEY` 재확인

## 모니터링
- Vercel 배포 로그 및 `/api/agent/*` 함수 응답 상태
- 브라우저 콘솔 오류, 사용자 문의 채널

## Vercel Functions (AI 프록시)
- 엔드포인트: `/api/agent/[channel]`
- 지원 채널: `askRoot`, `askChild`, `extractKeyword`
- 인증: 요청 헤더(`Authorization` 기본) 값은 `AGENT_HTTP_TOKEN`과 일치해야 함
- 환경 변수 `OPENAI_API_KEY`가 설정되지 않으면 OpenAI 호출이 실패하므로 반드시 프로젝트 Settings → Environment Variables에 추가

## 연락처
- FE On-call: `#jarvis-fe`
- 플랫폼 지원: `#jarvis-platform`
