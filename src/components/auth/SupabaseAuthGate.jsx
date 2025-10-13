import React from 'react';
import PropTypes from 'prop-types';
import { useSupabaseAuth } from 'shared/hooks/useSupabaseAuth';
import { Button } from 'shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from 'shared/ui/card';

const providerConfigs = [
  {
    id: 'google',
    label: 'Google 계정으로 계속하기',
  },
  {
    id: 'kakao',
    label: '카카오 계정으로 계속하기',
  },
];

const SupabaseAuthGate = ({ children, mode = 'widget' }) => {
  const {
    user,
    loading,
    error,
    signInWithOAuth,
  } = useSupabaseAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="space-y-4 text-center">
          <div className="relative">
            <div className="animate-spin h-12 w-12 border-3 border-primary/20 border-t-primary rounded-full mx-auto" />
          </div>
          <p className="text-sm text-muted-foreground font-medium">세션을 확인하는 중...</p>
        </div>
      </div>
    );
  }

  if (!user) {
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
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" 
                    />
                  </svg>
                </div>
              </div>
              <CardTitle className="text-2xl text-center font-bold">
                {mode === 'library' ? '라이브러리에 접속하기' : 'VORAN에 오신 것을 환영합니다'}
              </CardTitle>
              <CardDescription className="text-center leading-relaxed">
                Google 또는 카카오 계정으로 빠르게 로그인하세요.
                <br />
                한 번의 로그인으로 위젯과 라이브러리를 모두 사용할 수 있습니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-2">
              {providerConfigs.map((provider) => (
                <Button
                  key={provider.id}
                  onClick={() => signInWithOAuth(provider.id, { mode })}
                  className="w-full h-12 text-base font-medium"
                  variant="secondary"
                >
                  {provider.label}
                </Button>
              ))}
              {error ? (
                <div className="mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <p className="text-sm text-destructive font-medium">
                    로그인 중 오류가 발생했습니다
                  </p>
                  <p className="text-xs text-destructive/80 mt-1">
                    {error.message}
                  </p>
                </div>
              ) : null}
            </CardContent>
          </Card>
          <p className="text-center text-xs text-muted-foreground mt-6">
            로그인하시면 <span className="text-foreground font-medium">서비스 이용약관</span> 및{' '}
            <span className="text-foreground font-medium">개인정보처리방침</span>에 동의하는 것으로 간주됩니다.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

SupabaseAuthGate.propTypes = {
  children: PropTypes.node.isRequired,
  mode: PropTypes.oneOf(['widget', 'library']),
};

export default SupabaseAuthGate;
