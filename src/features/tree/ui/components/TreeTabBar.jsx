import React, { useState, useEffect } from 'react';
import { Plus, X, Network } from 'lucide-react';
import TreeSelectModal from './TreeSelectModal';
import { useTreeSelection } from 'features/tree/hooks/useTreeSelection';

const TreeTabBar = ({ theme, activeTreeId, activeTabId, tabs, onTabChange, onTabDelete }) => {
    const [contextMenu, setContextMenu] = useState({ open: false, tabId: null, x: 0, y: 0 });
    const [isSelectModalOpen, setIsSelectModalOpen] = useState(false);

    const existingTabIds = tabs.map(tab => tab.id);
    const { trees, folders, loading, loadTreesAndFolders } = useTreeSelection({
        existingTabIds,
        maxTabs: 10,
    });

    // 컨텍스트 메뉴 외부 클릭 시 닫기
    useEffect(() => {
        if (!contextMenu.open) return;

        const handleClickOutside = () => {
            setContextMenu({ open: false, tabId: null, x: 0, y: 0 });
        };

        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, [contextMenu.open]);

    const handleTabClick = (tab) => {
        if (onTabChange && tab?.id) {
            onTabChange({
                treeId: tab.treeId || tab.id,
                tabId: tab.id,
                title: tab.title,
                isExistingTab: true
            });
        }
    };

    const handleTabContextMenu = (event, tab) => {
        event.preventDefault();
        event.stopPropagation();

        // 메뉴 크기와 화면 경계를 고려한 위치 계산
        const menuWidth = 100; // 실제 메뉴 너비 (더 정확한 값)
        const menuHeight = 36; // 실제 메뉴 높이 (더 정확한 값)
        const offset = 5; // 마우스에서 약간 떨어진 위치

        let x = event.clientX + offset;
        let y = event.clientY + offset;

        // 화면 오른쪽 경계 체크 - 메뉴가 넘어가면 왼쪽으로 이동
        if (x + menuWidth > window.innerWidth) {
            x = event.clientX - menuWidth - offset;
        }

        // 화면 아래쪽 경계 체크 - 메뉴가 넘어가면 위쪽으로 이동
        if (y + menuHeight > window.innerHeight) {
            y = event.clientY - menuHeight - offset;
        }

        // 최소 위치 보장 (화면 가장자리에서 벗어나지 않도록)
        x = Math.max(5, Math.min(x, window.innerWidth - menuWidth - 5));
        y = Math.max(5, Math.min(y, window.innerHeight - menuHeight - 5));

        setContextMenu({
            open: true,
            tabId: tab.id,
            x: x,
            y: y,
        });
    };

    const handleDeleteTab = async () => {
        if (onTabDelete && contextMenu.tabId) {
            await onTabDelete(contextMenu.tabId);
        }
        setContextMenu({ open: false, tabId: null, x: 0, y: 0 });
    };

    const handleAddNew = async () => {
        // 모달 열기 전에 트리 목록 로드
        await loadTreesAndFolders();
        setIsSelectModalOpen(true);
    };

    const handleSelectTree = (tree) => {
        if (onTabChange && tree?.id) {
            onTabChange({ treeId: tree.id, title: tree.title });
        }
    };

    if (!tabs || tabs.length === 0) {
        return null;
    }

    const isLightMode = theme === 'light';
    const MAX_TREES = 10;
    const canAddMore = tabs.length < MAX_TREES;

    return (
        <div className="flex items-center gap-1">
            {/* 트리 탭들 - 파일 아이콘 형태 */}
            <div className="flex items-center gap-1">
                {tabs.map((tab, index) => {
                    const isActive = tab.id === activeTabId;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => handleTabClick(tab)}
                            onContextMenu={(e) => handleTabContextMenu(e, tab)}
                            className={`
                flex items-center justify-center flex-shrink-0 transition-all
                ${isActive
                                    ? isLightMode
                                        ? 'text-black'
                                        : 'text-white'
                                    : isLightMode
                                        ? 'text-black/40 hover:text-black/60'
                                        : 'text-white/40 hover:text-white/60'
                                }
              `}
                            title={tab.title || `트리 ${index + 1}`}
                        >
                            <Network className="w-3.5 h-3.5" />
                        </button>
                    );
                })}
            </div>

            {/* 새 트리 추가 버튼 - 9개까지만 표시 */}
            {canAddMore && (
                <button
                    onClick={handleAddNew}
                    className={`
          flex items-center justify-center w-3.5 h-3.5 flex-shrink-0 rounded-full border transition-all
          ${isLightMode
                            ? 'bg-black/15 border-black/35 text-black/55 hover:bg-black/25 hover:border-black/45'
                            : 'bg-white/15 border-white/35 text-white/55 hover:bg-white/25 hover:border-white/45'
                        }
        `}
                    title="새 트리 추가"
                >
                    <Plus className="w-2.5 h-2.5" />
                </button>
            )}

            {/* 컨텍스트 메뉴 - 탭 삭제 */}
            {contextMenu.open && (
                <div
                    className={`
            fixed z-[9999] rounded-md shadow-lg border
            ${isLightMode
                            ? 'bg-white border-gray-200'
                            : 'bg-black/90 border-white/15'
                        }
          `}
                    style={{
                        left: contextMenu.x,
                        top: contextMenu.y,
                        transform: 'translate(0, 0)', // transform을 사용하여 더 정확한 위치 지정
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <button
                        onClick={handleDeleteTab}
                        className={`
              flex items-center gap-2 px-3 py-2 text-xs transition w-full text-left
              ${isLightMode
                                ? 'text-red-600 hover:bg-red-50'
                                : 'text-red-400 hover:bg-red-500/20'
                            }
            `}
                    >
                        <X className="w-3 h-3" />
                        <span>닫기</span>
                    </button>
                </div>
            )}

            {/* 트리 선택 모달 */}
            <TreeSelectModal
                isOpen={isSelectModalOpen}
                onClose={() => setIsSelectModalOpen(false)}
                onSelectTree={handleSelectTree}
                trees={trees}
                folders={folders}
                theme={theme}
                existingTabIds={existingTabIds}
            />
        </div>
    );
};

export default TreeTabBar;
