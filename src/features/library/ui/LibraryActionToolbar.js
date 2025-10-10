import React from 'react';
import { Button } from 'shared/ui/button';
import { useSettings } from 'shared/hooks/SettingsContext';
import { RefreshCcw, Settings } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from 'shared/ui/dropdown-menu';

const FALLBACK_THEME_LABEL = '테마';

const LibraryActionToolbar = ({
  user,
  ActiveThemeIcon,
  activeThemeLabel,
  onCycleTheme,
  onRefresh,
  onSignOut,
  isRefreshing,
}) => {
  const ThemeIcon = ActiveThemeIcon;
  const userLabel = user?.email || user?.user_metadata?.full_name || '로그인 계정';
  const themeLabel = activeThemeLabel || FALLBACK_THEME_LABEL;
  const canSignOut = Boolean(user);
  const { inputMode = 'mouse', setInputMode } = useSettings();

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

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-full border-border bg-background/30 text-card-foreground hover:bg-background/50"
              title="설정 열기"
            >
              <Settings className="h-4 w-4" />
              <span className="sr-only">설정</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="text-xs text-muted-foreground/90">
              빠른 설정
            </DropdownMenuLabel>
            <DropdownMenuItem
              className="flex items-center gap-2 text-xs"
              onSelect={() => {
                onCycleTheme?.();
              }}
            >
              {ThemeIcon ? (
                <ThemeIcon className="h-3.5 w-3.5" />
              ) : (
                <span className="text-[11px]">🎨</span>
              )}
              <div className="flex-1">
                <span className="font-medium text-foreground">테마 변경</span>
                <p className="text-[11px] text-muted-foreground">현재: {themeLabel}</p>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="flex items-center gap-2 text-xs"
              disabled={isRefreshing}
              onSelect={() => {
                if (!isRefreshing) {
                  onRefresh?.();
                }
              }}
            >
              <RefreshCcw className="h-3.5 w-3.5" />
              <div className="flex-1">
                <span className="font-medium text-foreground">라이브러리 새로 고침</span>
                <p className="text-[11px] text-muted-foreground">데이터를 다시 불러옵니다</p>
              </div>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground/90">
              조작 모드
            </DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={inputMode}
              onValueChange={(value) => {
                setInputMode?.(value);
              }}
              className="space-y-1 px-1 py-1"
            >
              <DropdownMenuRadioItem value="mouse" className="flex items-start gap-2 text-xs">
                <div className="flex-1">
                  <span className="font-medium text-foreground">마우스 모드</span>
                  <p className="text-[11px] text-muted-foreground">좌클릭 드래그, 빠른 휠 확대</p>
                </div>
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="trackpad" className="flex items-start gap-2 text-xs">
                <div className="flex-1">
                  <span className="font-medium text-foreground">트랙패드 모드</span>
                  <p className="text-[11px] text-muted-foreground">두 손가락 이동 &amp; 핀치 감도 향상</p>
                </div>
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-xs font-medium text-red-500 focus:text-red-500"
              disabled={!canSignOut}
              onSelect={() => {
                if (canSignOut) {
                  onSignOut?.();
                }
              }}
            >
              로그아웃
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};

export default LibraryActionToolbar;
