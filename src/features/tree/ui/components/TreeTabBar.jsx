import React, { useState } from 'react';
import { Plus, X, Network } from 'lucide-react';
import TreeSelectModal from './TreeSelectModal';
import { useTreeSelection } from 'features/tree/hooks/useTreeSelection';
import ContextMenu from 'shared/ui/ContextMenu';

const TreeTabBar = ({ theme, activeTreeId, activeTabId, tabs, onTabChange, onTabDelete }) => {
    const [isSelectModalOpen, setIsSelectModalOpen] = useState(false);

    const existingTabIds = tabs.map(tab => tab.id);
    const { trees, folders, loading, loadTreesAndFolders } = useTreeSelection({
        existingTabIds,
        maxTabs: 10,
    });

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
                        <ContextMenu
                            key={tab.id}
                            className="inline-flex"
                            items={[
                                {
                                    label: '닫기',
                                    icon: <X className="w-3 h-3" />,
                                    danger: true,
                                    onClick: async () => {
                                        if (onTabDelete) {
                                            await onTabDelete(tab.id);
                                        }
                                    },
                                },
                            ]}
                        >
                            <button
                                onClick={() => handleTabClick(tab)}
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
                        </ContextMenu>
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
