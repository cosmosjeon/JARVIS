# Library Web Smoke Checklist

- [ ] 로그인 플로우 (Google/Kakao) 성공 및 `/auth/callback` 리다이렉트 확인
- [ ] 트리/폴더 CRUD 작업 (생성, 이름 변경, 삭제) 정상 동작
- [ ] 테마 토글(라이트/다크) 및 로컬 저장 확인
- [ ] 반응형 레이아웃 (1024px, 768px) 에서 사이드바/콘텐츠 배치 검증
- [ ] Electron 전용 UI 요소(BOX 관리, 창 제어)가 웹에서 노출되지 않는지 확인
- [ ] 위젯 모드 요청(`?mode=widget`) 시 라이브러리 모드로 정규화되는지 확인
- [ ] Supabase 에러/오류 메시지 로그 확인 (개발자 도구 콘솔 에러 없음)
