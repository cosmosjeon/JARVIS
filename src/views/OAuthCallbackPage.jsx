import React, { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from 'shared/ui/card';

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
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <Card className="backdrop-blur-xl bg-card/95 border-border shadow-xl">
          <CardHeader className="space-y-3 pb-6">
            <div className="flex items-center justify-center mb-2">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <svg 
                  className="h-10 w-10 text-primary" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M5 13l4 4L19 7" 
                  />
                </svg>
              </div>
            </div>
            <CardTitle className="text-2xl text-center font-bold">
              로그인이 완료되었습니다
            </CardTitle>
            <CardDescription className="text-center leading-relaxed">
              JARVIS 앱으로 돌아가는 중입니다.
              <br />
              브라우저 창은 닫아도 됩니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            <div className="mt-4 p-3 rounded-lg bg-muted/50">
              <p className="text-center text-xs text-muted-foreground">
                자동으로 앱으로 돌아갑니다...
              </p>
            </div>
          </CardContent>
        </Card>
        <p className="text-center text-xs text-muted-foreground mt-6">
          로그인하시면 <span className="text-foreground font-medium">서비스 이용약관</span> 및{' '}
          <span className="text-foreground font-medium">개인정보처리방침</span>에 동의하는 것으로 간주됩니다.
        </p>
      </div>
    </div>
  );
};

export default OAuthCallbackPage;
