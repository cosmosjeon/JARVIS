# Library Web Runbook

## 배포 절차
1. `npm run check:env`로 필수 환경 변수 검증
2. `npm run build:web`
3. `npm run smoke:web`
4. `git push` → Vercel main/preview 자동 배포 확인

## 롤백
- Vercel에서 이전 배포로 Promote
- Supabase OAuth 리다이렉트 URL 변경이 있었다면 즉시 되돌림

## 모니터링
- Vercel 배포 로그
- 브라우저 콘솔 오류, 사용자 문의 채널

## 연락처
- FE On-call: `#jarvis-fe`
- 플랫폼 지원: `#jarvis-platform`
