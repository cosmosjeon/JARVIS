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
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100">
        <div className="space-y-3 text-center">
          <div className="animate-spin h-10 w-10 border-2 border-slate-400 border-t-transparent rounded-full mx-auto" />
          <p className="text-sm text-slate-300">세션을 확인하는 중...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100 px-4">
        <Card className="w-full max-w-md bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-lg">
              {mode === 'library' ? '라이브러리에 접속하려면 로그인하세요' : 'VORAN을 사용하려면 로그인하세요'}
            </CardTitle>
            <CardDescription>
              Google 또는 카카오 계정으로 빠르게 로그인할 수 있어요. 한번 로그인하면 위젯과 라이브러리를 모두 사용할 수 있습니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {providerConfigs.map((provider) => (
              <Button
                key={provider.id}
                onClick={() => signInWithOAuth(provider.id, { mode })}
                className="w-full"
                variant="secondary"
              >
                {provider.label}
              </Button>
            ))}
            {error ? (
              <p className="text-xs text-red-400">
                로그인 중 오류가 발생했습니다: {error.message}
              </p>
            ) : null}
          </CardContent>
        </Card>
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
