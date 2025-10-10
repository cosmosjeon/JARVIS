import React from 'react';
import { Button } from 'shared/ui/button';
import { Settings } from 'lucide-react';

const FALLBACK_THEME_LABEL = '테마';

const LibraryActionToolbar = ({
  user,
  ActiveThemeIcon,
  activeThemeLabel,
  onCycleTheme,
  onRefresh,
  onSignOut,
  isRefreshing,
  onOpenSettings,
}) => {
  const ThemeIcon = ActiveThemeIcon;
  const userLabel = user?.email || user?.user_metadata?.full_name || '로그인 계정';
  const themeLabel = activeThemeLabel || FALLBACK_THEME_LABEL;

  return (
    <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 bg-card px-6 py-4 text-card-foreground flex-shrink-0">
      <div className="space-y-1">
        <span className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground/80">
          Library Viewer
        </span>
        {user ? (
          <span className="text-sm text-card-foreground">{userLabel}</span>
        ) : (
          <span className="text-sm text-muted-foreground">로그인 필요</span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9 rounded-full border-border bg-background/30 text-card-foreground"
          onClick={onCycleTheme}
          title={`테마 변경 (현재: ${themeLabel})`}
        >
          {ThemeIcon ? <ThemeIcon className="h-4 w-4" /> : <span className="text-xs">🎨</span>}
          <span className="sr-only">테마 변경</span>
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="border-border bg-background/30 text-card-foreground hover:bg-background/50"
        >
          {isRefreshing ? '새로고침 중' : '새로고침'}
        </Button>

        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9 rounded-full border-border bg-background/30 text-card-foreground hover:bg-background/50"
          onClick={onOpenSettings}
          title="설정 열기"
        >
          <Settings className="h-4 w-4" />
          <span className="sr-only">설정</span>
        </Button>
      </div>
    </header>
  );
};

export default LibraryActionToolbar;
