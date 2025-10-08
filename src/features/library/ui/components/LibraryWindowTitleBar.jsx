import React from 'react';
import { Minus, Square, X } from 'lucide-react';
import { createWindowControlsBridge } from 'infrastructure/electron/bridges';

const PLATFORM_WINDOWS = 'win32';

const getPlatform = () => {
    if (typeof window === 'undefined') {
        return null;
    }
    return window.jarvisAPI?.process?.platform || null;
};

const LibraryWindowTitleBar = () => {
    const platform = getPlatform();
    const isWindows = platform === PLATFORM_WINDOWS;

    if (!isWindows) {
        return null;
    }

    const bridge = createWindowControlsBridge();

    const handleMinimize = () => {
        bridge.minimize?.();
    };

    const handleMaximize = () => {
        bridge.maximize?.();
    };

    const handleClose = () => {
        bridge.close?.();
    };

    return (
        <div
            className="flex items-center justify-between h-8 bg-background/80 backdrop-blur-sm border-b border-border/50"
            style={{ WebkitAppRegion: 'drag' }}
        >
            {/* 타이틀 영역 */}
            <div className="flex-1 px-3 text-xs text-muted-foreground font-medium select-none">
                JARVIS Library
            </div>

            {/* 윈도우 컨트롤 버튼 */}
            <div className="flex items-center h-full" style={{ WebkitAppRegion: 'no-drag' }}>
                {/* 최소화 버튼 */}
                <button
                    onClick={handleMinimize}
                    className="h-full px-4 hover:bg-accent/50 transition-colors flex items-center justify-center group"
                    aria-label="최소화"
                >
                    <Minus className="w-4 h-4 text-muted-foreground group-hover:text-foreground" />
                </button>

                {/* 최대화 버튼 */}
                <button
                    onClick={handleMaximize}
                    className="h-full px-4 hover:bg-accent/50 transition-colors flex items-center justify-center group"
                    aria-label="최대화/복원"
                >
                    <Square className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground" />
                </button>

                {/* 닫기 버튼 */}
                <button
                    onClick={handleClose}
                    className="h-full px-4 hover:bg-destructive transition-colors flex items-center justify-center group"
                    aria-label="닫기"
                >
                    <X className="w-4 h-4 text-muted-foreground group-hover:text-destructive-foreground" />
                </button>
            </div>
        </div>
    );
};

export default LibraryWindowTitleBar;

