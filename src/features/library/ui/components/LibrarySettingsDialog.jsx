import React, { useMemo, useState } from 'react';
import { useSettings } from 'shared/hooks/SettingsContext';
import { 
  Palette, 
  MousePointer, 
  User, 
  LogOut, 
  Monitor,
  Smartphone,
  Settings as SettingsIcon,
  ChevronDown,
  Sun,
  Moon,
  Monitor as MonitorIcon
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from 'shared/ui/dialog';
import { Button } from 'shared/ui/button';
import { Separator } from 'shared/ui/separator';
import { Switch } from 'shared/ui/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from 'shared/ui/dropdown-menu';
import { cn } from 'shared/utils';

const FALLBACK_THEME_LABEL = '테마';

// 테마 옵션들
const THEME_OPTIONS = [
  { id: 'light', label: '라이트', icon: Sun },
  { id: 'dark', label: '다크', icon: Moon },
  { id: 'system', label: '시스템', icon: MonitorIcon },
];

const SETTINGS_SECTIONS = [
  {
    id: 'theme',
    title: '테마',
    icon: Palette,
  },
  {
    id: 'interaction',
    title: '주 캔버스 조작',
    icon: MousePointer,
  },
  {
    id: 'account',
    title: '계정',
    icon: User,
  },
];

/**
 * 노션 스타일 설정 Dialog 컴포넌트
 * 사이드바와 메인 콘텐츠 영역으로 구성됩니다.
 */
const LibrarySettingsDialog = ({
  open,
  onOpenChange,
  user,
  ActiveThemeIcon,
  activeThemeLabel,
  onCycleTheme,
  onRefresh,
  onSignOut,
  isRefreshing,
}) => {
  const [activeSection, setActiveSection] = useState('theme');
  const ThemeIcon = ActiveThemeIcon;
  const userLabel = user?.email || user?.user_metadata?.full_name || '로그인 계정';
  const themeLabel = activeThemeLabel || FALLBACK_THEME_LABEL;
  const canSignOut = Boolean(user);
  const {
    inputMode = 'mouse',
    setInputMode,
    zoomOnClickEnabled = true,
    setZoomOnClickEnabled,
    widgetTheme = 'glass',
    setWidgetThemePreference,
  } = useSettings();

  const widgetThemeOptions = useMemo(() => ([
    { id: 'glass', label: '반투명', description: '위젯 전용 반투명 테마' },
    { id: 'light', label: '라이트', description: '밝은 배경으로 가독성 확보' },
    { id: 'dark', label: '다크', description: '어두운 배경으로 눈부심 감소' },
  ]), []);

  const currentWidgetThemeOption = useMemo(
    () => widgetThemeOptions.find((option) => option.id === widgetTheme) || widgetThemeOptions[0],
    [widgetTheme, widgetThemeOptions],
  );

  const handleThemeSelect = (themeId) => {
    // 테마 변경 로직 (현재는 기존 onCycleTheme 사용)
    onCycleTheme?.();
  };

  const handleWidgetThemeSelect = (themeId) => {
    setWidgetThemePreference?.(themeId);
  };

  const getCurrentThemeOption = () => {
    // 현재 테마에 맞는 옵션 찾기 (간단한 구현)
    return THEME_OPTIONS.find(option => option.label.toLowerCase().includes(themeLabel.toLowerCase())) || THEME_OPTIONS[1];
  };

  const handleSignOut = () => {
    if (canSignOut) {
      onSignOut?.();
      onOpenChange?.(false);
    }
  };

  const handleInputModeChange = (mode) => {
    setInputMode?.(mode);
  };

  const renderSidebar = () => (
    <div className="w-72 border-r border-border bg-muted/30 p-6 flex-shrink-0">
      <div className="space-y-2">
        {SETTINGS_SECTIONS.map((section) => {
          const Icon = section.icon;
          const isActive = activeSection === section.id;
          
          return (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                isActive 
                  ? "bg-accent text-accent-foreground shadow-sm" 
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/30"
              )}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{section.title}</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderMainContent = () => {
    switch (activeSection) {
      case 'theme':
        return (
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-semibold text-foreground mb-2">테마</h2>
              <p className="text-sm text-muted-foreground">
                앱의 색상 테마를 변경합니다.
              </p>
            </div>
            
            <div className="space-y-4">
              <div className="p-6 border border-border rounded-xl bg-card shadow-sm">
                <div className="flex items-center gap-4 mb-4">
                  {ThemeIcon ? (
                    <ThemeIcon className="h-6 w-6 text-muted-foreground" />
                  ) : (
                    <Palette className="h-6 w-6 text-muted-foreground" />
                  )}
                  <div>
                    <p className="text-base font-medium text-foreground">테마 선택</p>
                    <p className="text-sm text-muted-foreground">앱의 색상 테마를 선택합니다</p>
                  </div>
                </div>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-between px-4 py-3 h-auto"
                    >
                      <div className="flex items-center gap-3">
                        {React.createElement(getCurrentThemeOption().icon, { className: "h-5 w-5" })}
                        <div className="text-left">
                          <p className="text-sm font-medium">{getCurrentThemeOption().label}</p>
                          <p className="text-xs text-muted-foreground">현재 선택된 테마</p>
                        </div>
                      </div>
                      <ChevronDown className="h-4 w-4 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-full min-w-[200px]">
                    {THEME_OPTIONS.map((option) => {
                      const IconComponent = option.icon;
                      return (
                        <DropdownMenuItem
                          key={option.id}
                          onClick={() => handleThemeSelect(option.id)}
                          className="flex items-center gap-3 px-3 py-2.5"
                        >
                          <IconComponent className="h-5 w-5" />
                          <div className="flex-1">
                            <p className="text-sm font-medium">{option.label}</p>
                            <p className="text-xs text-muted-foreground">
                              {option.id === 'light' && '밝은 테마'}
                              {option.id === 'dark' && '어두운 테마'}
                              {option.id === 'system' && '시스템 설정 따름'}
                            </p>
                          </div>
                          {getCurrentThemeOption().id === option.id && (
                            <div className="h-2 w-2 rounded-full bg-primary" />
                          )}
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="p-6 border border-border rounded-xl bg-card shadow-sm">
                <div className="flex items-center gap-4 mb-4">
                  <Palette className="h-6 w-6 text-muted-foreground" />
                  <div>
                    <p className="text-base font-medium text-foreground">위젯 테마 선택</p>
                    <p className="text-sm text-muted-foreground">Electron 위젯 모드에서 사용할 테마</p>
                  </div>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-between px-4 py-3 h-auto"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col text-left">
                          <p className="text-sm font-medium">{currentWidgetThemeOption.label}</p>
                          <p className="text-xs text-muted-foreground">위젯 현재 테마</p>
                        </div>
                      </div>
                      <ChevronDown className="h-4 w-4 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-full min-w-[200px]">
                    {widgetThemeOptions.map((option) => (
                      <DropdownMenuItem
                        key={option.id}
                        onClick={() => handleWidgetThemeSelect(option.id)}
                        className="flex items-start gap-3 px-3 py-2.5"
                      >
                        <div className="flex flex-col">
                          <p className="text-sm font-medium">{option.label}</p>
                          <p className="text-xs text-muted-foreground">{option.description}</p>
                        </div>
                        {currentWidgetThemeOption.id === option.id && (
                          <div className="ml-auto h-2 w-2 rounded-full bg-primary" />
                        )}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        );

      case 'interaction':
        return (
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-semibold text-foreground mb-2">주 캔버스 조작</h2>
              <p className="text-sm text-muted-foreground">
                캔버스에서의 조작 방식을 설정합니다. 두 모드 모두 향상된 감도로 동작합니다.
              </p>
            </div>
            
            <div className="space-y-4">
              <button
                onClick={() => handleInputModeChange('mouse')}
                className={cn(
                  "w-full flex items-center gap-4 p-6 border rounded-xl transition-colors text-left",
                  inputMode === 'mouse'
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border bg-card hover:bg-accent/20"
                )}
              >
                <div
                  className={cn(
                    "h-5 w-5 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                    inputMode === 'mouse' ? "border-primary" : "border-muted-foreground"
                  )}
                >
                  {inputMode === 'mouse' && (
                    <div className="h-2.5 w-2.5 rounded-full bg-primary" />
                  )}
                </div>
                <div className="flex-1">
                      <p className="text-base font-medium text-foreground">마우스 모드</p>
                      <p className="text-sm text-muted-foreground">좌클릭 드래그, 마우스 휠 확대/축소</p>
                    </div>
              </button>

              <button
                onClick={() => handleInputModeChange('trackpad')}
                className={cn(
                  "w-full flex items-center gap-4 p-6 border rounded-xl transition-colors text-left",
                  inputMode === 'trackpad'
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border bg-card hover:bg-accent/20"
                )}
              >
                <div
                  className={cn(
                    "h-5 w-5 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                    inputMode === 'trackpad' ? "border-primary" : "border-muted-foreground"
                  )}
                >
                  {inputMode === 'trackpad' && (
                    <div className="h-2.5 w-2.5 rounded-full bg-primary" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-base font-medium text-foreground">트랙패드 모드</p>
                  <p className="text-sm text-muted-foreground">두 손가락 이동 및 핀치 줌 유지</p>
                </div>
              </button>

              <div className="pt-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">노드 동작</p>
                <div className="p-6 border border-border rounded-xl bg-card shadow-sm">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <p className="text-base font-medium text-foreground">클릭 시 확대</p>
                      <p className="text-sm text-muted-foreground">
                        노드 클릭 시 자동으로 확대합니다
                      </p>
                    </div>
                    <Switch
                      checked={zoomOnClickEnabled}
                      onCheckedChange={setZoomOnClickEnabled}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'account':
        return (
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-semibold text-foreground mb-2">계정</h2>
              <p className="text-sm text-muted-foreground">
                계정 정보 및 로그인 상태를 관리합니다.
              </p>
            </div>
            
            <div className="space-y-6">
              <div className="p-6 border border-border rounded-xl bg-card shadow-sm">
                <div className="flex items-center gap-4">
                  <User className="h-6 w-6 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-base font-medium text-foreground">로그인된 계정</p>
                    <p className="text-sm text-muted-foreground">{userLabel}</p>
                    {!canSignOut && (
                      <p className="text-xs text-muted-foreground mt-1">로그인이 필요합니다</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-6 border border-border rounded-xl bg-card shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-base font-medium text-foreground">로그아웃</p>
                    <p className="text-sm text-muted-foreground">현재 계정에서 로그아웃합니다</p>
                  </div>
                  <Button
                    variant="destructive"
                    onClick={handleSignOut}
                    disabled={!canSignOut}
                    className="ml-4 px-6"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    로그아웃
                  </Button>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[90vw] h-[85vh] p-0 flex flex-col gap-0">
        <DialogHeader className="px-6 py-4 flex-shrink-0 space-y-0">
          <DialogTitle className="text-xl font-semibold flex items-center gap-2">
            <SettingsIcon className="h-5 w-5" />
            설정
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 min-h-0 border-t border-border">
          {renderSidebar()}
          <div className="flex-1 p-6 overflow-y-auto">
            {renderMainContent()}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LibrarySettingsDialog;
