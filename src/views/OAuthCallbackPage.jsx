import React, { useCallback, useEffect, useState } from 'react';

const buildJarvisUrl = () => {
  const params = new URLSearchParams(window.location.search);
  const query = params.toString();
  return `jarvis://auth-callback${query ? `?${query}` : ''}`;
};

const OAuthCallbackPage = () => {
  const [attempts, setAttempts] = useState(0);
  const jarvisUrl = buildJarvisUrl();

  const openJarvis = useCallback(() => {
    setAttempts((prev) => prev + 1);
    window.location.replace(jarvisUrl);
  }, [jarvisUrl]);

  useEffect(() => {
    openJarvis();
    const timer = setTimeout(() => {
      if (document.hidden) return;
      openJarvis();
    }, 1500);

    return () => clearTimeout(timer);
  }, [openJarvis]);

  useEffect(() => {
    const handler = () => {
      openJarvis();
    };
    window.addEventListener('focus', handler);
    return () => window.removeEventListener('focus', handler);
  }, [openJarvis]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f172a, #1e293b)',
      color: '#e2e8f0',
      fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
    }}>
      <div style={{
        textAlign: 'center',
        maxWidth: 360,
        padding: '32px 28px',
        borderRadius: 16,
        background: 'rgba(15, 23, 42, 0.75)',
        boxShadow: '0 24px 60px rgba(15, 23, 42, 0.35)',
        border: '1px solid rgba(148, 163, 184, 0.18)',
      }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>로그인 정보를 확인했어요</h1>
        <p style={{ fontSize: 14, lineHeight: 1.6, color: 'rgba(226, 232, 240, 0.8)' }}>
          앱으로 자동으로 돌아갑니다. 잠시 기다려 주세요.
          창이 닫히지 않으면 아래 버튼을 눌러 VORAN을 다시 열어 주세요.
        </p>
        <button
          type="button"
          onClick={openJarvis}
          style={{
            marginTop: 28,
            width: '100%',
            padding: '12px 16px',
            borderRadius: 12,
            border: 'none',
            background: 'linear-gradient(135deg, #38bdf8, #6366f1)',
            color: '#0f172a',
            fontSize: 15,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          앱으로 돌아가기
        </button>
        <p style={{ marginTop: 16, fontSize: 12, color: 'rgba(148, 163, 184, 0.75)' }}>
          시도 횟수: {attempts}
        </p>
      </div>
    </div>
  );
};

export default OAuthCallbackPage;
