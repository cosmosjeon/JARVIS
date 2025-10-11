import React, { useMemo } from 'react';
import { X, Folder, Network } from 'lucide-react';

/**
 * TreeSelectModal - Presentation Component
 * 
 * 역할: 폴더 구조의 트리 목록을 표시하고 선택할 수 있는 모달
 * 책임: UI 렌더링, 사용자 인터랙션 이벤트 발생
 */
const TreeSelectModal = ({
    isOpen,
    onClose,
    onSelectTree,
    trees = [],
    folders = [],
    theme = 'dark',
    existingTabIds = [],
}) => {
    const isLightMode = theme === 'light';

    // 폴더별로 트리 그룹화
    const groupedTrees = useMemo(() => {
        const groups = new Map();

        // 루트 트리들 (folderId가 null)
        groups.set(null, []);

        // 폴더별 그룹 초기화
        folders.forEach(folder => {
            groups.set(folder.id, []);
        });

        // 트리들을 폴더별로 분류
        trees.forEach(tree => {
            const folderId = tree.folderId || null;
            if (!groups.has(folderId)) {
                groups.set(folderId, []);
            }
            groups.get(folderId).push(tree);
        });

        return groups;
    }, [trees, folders]);

    if (!isOpen) return null;

    const handleTreeClick = (tree) => {
        onSelectTree(tree);
        onClose();
    };

    return (
        <div
            className="fixed inset-0 z-[9999] flex items-start justify-center pt-16"
            onClick={onClose}
        >
            {/* 배경 오버레이 */}
            <div className="absolute inset-0 -z-10" />

            {/* 모달 콘텐츠 */}
            <div
                className={`
          relative z-10 w-[480px] min-w-[480px] max-h-[600px] rounded-xl shadow-2xl overflow-hidden
          ${isLightMode
                        ? 'bg-white border border-gray-200'
                        : 'bg-slate-900/95 border border-white/10'
                    }
        `}
                onClick={(e) => e.stopPropagation()}
            >
                {/* 헤더 */}
                <div className={`
          flex items-center justify-between px-5 py-4 border-b
          ${isLightMode ? 'border-gray-200' : 'border-white/10'}
        `}>
                    <h2 className={`text-base font-semibold ${isLightMode ? 'text-gray-900' : 'text-white'}`}>
                        트리 선택
                    </h2>
                    <button
                        onClick={onClose}
                        className={`
              p-1.5 rounded-lg transition-colors
              ${isLightMode
                                ? 'hover:bg-gray-100 text-gray-600'
                                : 'hover:bg-white/10 text-white/70'
                            }
            `}
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* 트리 목록 */}
                <div className="overflow-y-auto max-h-[480px] px-3 py-3">
                    {/* 루트 트리들 */}
                    {groupedTrees.get(null)?.length > 0 && (
                        <div className="mb-4">
                            <div className={`
                px-3 py-1.5 text-xs font-medium
                ${isLightMode ? 'text-gray-500' : 'text-white/50'}
              `}>
                                루트
                            </div>
                            <div className="space-y-1">
                                {groupedTrees.get(null).map(tree => {
                                    return (
                                        <button
                                            key={tree.id}
                                            onClick={() => handleTreeClick(tree)}
                                            className={`
                        w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-colors
                        ${isLightMode
                                                    ? 'hover:bg-gray-50 text-gray-900'
                                                    : 'hover:bg-white/5 text-white'
                                                }
                      `}
                                        >
                                            <Network className="w-4 h-4 flex-shrink-0" />
                                            <span className="text-sm truncate">{tree.title || '제목 없음'}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* 폴더별 트리들 */}
                    {folders.map(folder => {
                        const folderTrees = groupedTrees.get(folder.id) || [];
                        if (folderTrees.length === 0) return null;

                        return (
                            <div key={folder.id} className="mb-4">
                                <div className={`
                  flex items-center gap-2 px-3 py-1.5 text-xs font-medium
                  ${isLightMode ? 'text-gray-700' : 'text-white/70'}
                `}>
                                    <Folder className="w-3.5 h-3.5" />
                                    <span>{folder.name}</span>
                                </div>
                                <div className="space-y-1">
                                    {folderTrees.map(tree => {
                                        return (
                                            <button
                                                key={tree.id}
                                                onClick={() => handleTreeClick(tree)}
                                                className={`
                          w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-colors
                          ${isLightMode
                                                        ? 'hover:bg-gray-50 text-gray-900'
                                                        : 'hover:bg-white/5 text-white'
                                                    }
                        `}
                                            >
                                                <Network className="w-4 h-4 flex-shrink-0" />
                                                <span className="text-sm truncate">{tree.title || '제목 없음'}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}

                    {/* 트리가 없는 경우 */}
                    {trees.length === 0 && (
                        <div className={`
              text-center py-12 text-sm
              ${isLightMode ? 'text-gray-500' : 'text-white/50'}
            `}>
                            저장된 트리가 없습니다
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TreeSelectModal;

