# Sprint 3 – 클립보드 기반 텍스트 캡처 계획

## 범위
- 전역 단축키 실행 시 클립보드 텍스트 읽기 → 위젯에 전달
- 권한 부족/빈 텍스트 시 사용자 안내
- 추후 OS별 실시간 캡처(Phase 4)를 위한 인터페이스 유지

## 흐름
```
핫키 발생
  └─ main.processClipboard()
       ├─ 클립보드 텍스트 읽기 (Electron clipboard API)
       ├─ plaintext <= 10KB 제한
       ├─ sanitize (trim, normalize whitespace)
       ├─ 결과 IPC `highlight:create` OR `state:notify`
```

## 단계별 작업
1. `electron/clipboard.js`
   - `getText()` → `{ success, text, error? }`
   - `sanitizeText(text)` → 줄바꿈/공백 정리
   - 실패 사유 코드: `empty`, `too_large`, `error`
2. main 프로세스
   - 핫키 핸들러에서 `clipboard.getText()` 호출
   - 결과를 renderer로 `widget:showFromClipboard` IPC
3. renderer
   - `jarvisAPI.onClipboard(payload)` (preload 확장)
   - NodeAssistantPanel에 `initialClipboardText` 전달 → 하이라이트 placeholder로 변환
4. UI
   - 안내 토스트: "클립보드가 비어 있습니다" / "복사 후 다시 시도"
   - 설정에서 "자동 붙여넣기" 토글 제공 (기본 ON)

## 보안 고려
- 텍스트는 메모리 내 일시 저장, 로그에는 마스킹(`***`) 처리
- 10KB 초과 텍스트는 `too_large` 에러와 함께 클립보드 수동 붙여넣기 안내

## TODO
- [ ] `sanitizeText` 유닛 테스트 추가 (trim, whitespace collapse)
- [ ] Renderer 입력 필드 자동 채우기 UX 정의
- [ ] 클립보드 권한 문구 (macOS) 번역 검토
