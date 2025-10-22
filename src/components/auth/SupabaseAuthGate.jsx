import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { useSupabaseAuth } from 'shared/hooks/useSupabaseAuth';
import { Button } from 'shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from 'shared/ui/card';

const providerConfigs = [
  {
    id: 'google',
    label: 'Continue with Google',
    variant: 'outline',
    className:
      'bg-white text-neutral-900 border border-input hover:bg-neutral-50 active:bg-neutral-100',
    imgSrcs: [
      '/logos/google.svg',
      'https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg',
      'https://www.gstatic.com/images/branding/product/1x/gsa_64dp.png',
    ],
  },
  {
    id: 'kakao',
    label: 'Continue with kakao',
    variant: 'default',
    className:
      'bg-[#FEE500] text-[#191600] hover:bg-[#FEE500]/90 active:bg-[#FEE500]/80',
    imgSrcs: [
      '/logos/kakao-real.png',
      '/logos/kakao-official.svg',
      '/logos/kakao-talk-logo.svg',
      'https://developers.kakao.com/assets/img/about/logos/kakaolink/kakaolink_btn_medium.png',
    ],
  },
];

const ProviderLogo = ({ sources, alt }) => {
  const [index, setIndex] = useState(0);
  const currentSrc = sources?.[index];

  if (!currentSrc) return null;

  return (
    <img
      src={currentSrc}
      alt={alt}
      className="h-5 w-5 object-contain"
      onError={() => {
        setIndex((prev) => (prev + 1 < (sources?.length || 0) ? prev + 1 : prev));
      }}
    />
  );
};

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
            <CardHeader className="space-y-2 pb-4">
              <div className="flex items-center justify-center">
                <img
                  src="/logotree_page-0001 (1).jpg"
                  alt="Treedi Logo"
                  className="h-16 w-auto max-w-[200px] rounded-2xl object-contain"
                />
              </div>
              <div className="text-center">
                <p className="text-base text-muted-foreground font-medium">SNS 계정으로 로그인</p>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              {providerConfigs.map((provider) => (
                <Button
                  key={provider.id}
                  onClick={() => signInWithOAuth(provider.id, { mode })}
                  className={`w-full h-12 text-base font-medium ${provider.className || ''}`}
                  variant={provider.variant || 'secondary'}
                >
                  <span className="flex items-center justify-center gap-2">
                    {provider.imgSrcs ? (
                      <ProviderLogo sources={provider.imgSrcs} alt={`${provider.id} logo`} />
                    ) : null}
                    <span>{provider.label}</span>
                  </span>
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
