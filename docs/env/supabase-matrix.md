# Supabase OAuth Redirect Matrix

| Environment | Redirect URL | Notes |
| --- | --- | --- |
| Local (Electron) | `http://localhost:3000/auth/callback` | Defined by `ELECTRON_SUPABASE_REDIRECT_URL` |
| Local (Web) | `http://localhost:3000/auth/callback` | Falling back to current origin when not specified |
| Preview | `https://preview-your-domain.vercel.app/auth/callback` | Configure `REACT_APP_SUPABASE_REDIRECT_URL_PREVIEW` |
| Production | `https://app.your-domain.com/auth/callback` | Configure `REACT_APP_SUPABASE_REDIRECT_URL_PRODUCTION` |

## 환경 변수 매핑

- `REACT_APP_SUPABASE_URL`
- `REACT_APP_SUPABASE_ANON_KEY`
- `REACT_APP_SUPABASE_REDIRECT_URL`
- `REACT_APP_SUPABASE_REDIRECT_URL_PREVIEW`
- `REACT_APP_SUPABASE_REDIRECT_URL_PRODUCTION`
- `ELECTRON_SUPABASE_REDIRECT_URL`

로컬 개발 시에는 위 변수들을 `.env.local`(CRA 기본 오버라이드 파일)에 배치하는 것을 권장하고, 배포용 값은 `.env.web`/`.env.electron`을 복사해 사용하십시오.

CI에서는 `npm run check:env`를 실행해 필수 값 누락 시 빌드를 중단한다.
