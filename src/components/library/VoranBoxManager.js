import React, { useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    X,
    FolderTree as TreeIcon,
    Clock,
    MoreHorizontal,
    FolderPlus,
    Folder
} from "lucide-react";
import { Button } from "components/ui/button";
import { Input } from "components/ui/input";
import { cn } from "lib/utils";

const VoranBoxManager = ({
    isVisible,
    onClose,
    trees = [],
    folders = [],
    onTreeSelect,
    onTreeMoveToFolder,
    onTreeOpen,
    onFolderCreate,
    onFolderSelect,
    selectedTreeId,
    selectedFolderId,
    loading = false
}) => {
    const [draggedTreeId, setDraggedTreeId] = useState(null);
    const [dragOverTarget, setDragOverTarget] = useState(null);
    const [showCreateFolder, setShowCreateFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState("");
    const [navigationMode, setNavigationMode] = useState(false); // 탭 네비게이션 모드
    const [currentFolderIndex, setCurrentFolderIndex] = useState(0); // 현재 선택된 폴더 인덱스

    const formatDate = (timestamp) => {
        if (!timestamp) return "날짜 없음";
        return new Date(timestamp).toLocaleDateString("ko-KR", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    // VORAN BOX에 표시할 트리들 (폴더에 속하지 않은 트리들)
    const voranTrees = useMemo(() => {
        return trees.filter(tree => !tree.folderId);
    }, [trees]);

    // 폴더별 트리 개수 계산
    const folderTreeCounts = useMemo(() => {
        const counts = {};
        trees.forEach(tree => {
            if (tree.folderId) {
                counts[tree.folderId] = (counts[tree.folderId] || 0) + 1;
            }
        });
        return counts;
    }, [trees]);

    const handleTreeDragStart = useCallback((e, treeId) => {
        setDraggedTreeId(treeId);
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", treeId);

        // Create custom drag image (only if setDragImage is available)
        if (e.dataTransfer.setDragImage) {
            const dragImage = e.target.cloneNode(true);
            dragImage.style.transform = "rotate(5deg)";
            dragImage.style.opacity = "0.8";
            document.body.appendChild(dragImage);
            e.dataTransfer.setDragImage(dragImage, 0, 0);

            // Clean up drag image after a short delay
            setTimeout(() => {
                if (document.body.contains(dragImage)) {
                    document.body.removeChild(dragImage);
                }
            }, 0);
        }
    }, []);

    const handleTreeDragEnd = useCallback(() => {
        setDraggedTreeId(null);
        setDragOverTarget(null);
    }, []);

    const handleDragOver = useCallback((e, targetType, targetId) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setDragOverTarget({ type: targetType, id: targetId });
    }, []);

    const handleDragLeave = useCallback((e) => {
        // Only clear if we're actually leaving the drop zone
        if (!e.currentTarget.contains(e.relatedTarget)) {
            setDragOverTarget(null);
        }
    }, []);

    const handleDrop = useCallback((e, targetType, targetId) => {
        e.preventDefault();
        const treeId = e.dataTransfer.getData("text/plain");

        if (treeId && onTreeMoveToFolder) {
            const tree = trees.find(t => t.id === treeId);
            if (tree) {
                if (targetType === "voran") {
                    // Move to VORAN BOX (remove from folder)
                    onTreeMoveToFolder({ ...tree, targetFolderId: null });
                } else if (targetType === "folder") {
                    // Move to specific folder
                    onTreeMoveToFolder({ ...tree, targetFolderId: targetId });
                }
            }
        }

        setDragOverTarget(null);
    }, [trees, onTreeMoveToFolder]);

    const handleTreeClick = useCallback((tree) => {
        // 트리 선택 시 트리를 열지 않고 선택 상태만 업데이트
        if (onTreeSelect) {
            onTreeSelect(tree);
        }
        // 탭 네비게이션 모드 활성화
        setNavigationMode(true);
        setCurrentFolderIndex(0);
    }, [onTreeSelect]);

    const handleTreeDoubleClick = useCallback((tree) => {
        if (onTreeOpen) {
            onTreeOpen(tree.id);
        }
    }, [onTreeOpen]);

    const handleTreeMoveToFolder = useCallback((tree) => {
        if (onTreeMoveToFolder) {
            onTreeMoveToFolder(tree);
        }
    }, [onTreeMoveToFolder]);

    const handleFolderCreate = useCallback(() => {
        console.log('VoranBoxManager - 폴더 생성 시도:', {
            name: newFolderName.trim(),
            hasOnFolderCreate: !!onFolderCreate
        });

        if (newFolderName.trim() && onFolderCreate) {
            onFolderCreate({ name: newFolderName.trim() });
            setNewFolderName("");
            setShowCreateFolder(false);
        } else {
            console.log('폴더 생성 조건 불만족:', {
                hasName: !!newFolderName.trim(),
                hasOnFolderCreate: !!onFolderCreate
            });
        }
    }, [newFolderName, onFolderCreate]);

    // 키보드 네비게이션 핸들러
    const handleKeyDown = useCallback((e) => {
        // 폴더 생성 모드일 때는 기존 로직 사용
        if (showCreateFolder) {
            if (e.key === "Enter") {
                handleFolderCreate();
            } else if (e.key === "Escape") {
                setShowCreateFolder(false);
                setNewFolderName("");
            }
            return;
        }

        // 탭 네비게이션 모드일 때
        if (navigationMode && selectedTreeId) {
            if (e.key === "Tab") {
                e.preventDefault();
                // 다음 폴더로 이동
                setCurrentFolderIndex(prev => {
                    const nextIndex = (prev + 1) % folders.length;
                    return nextIndex;
                });
            } else if (e.key === "Enter") {
                e.preventDefault();
                // 선택된 폴더에 트리 저장
                const targetFolder = folders[currentFolderIndex];
                if (targetFolder && onTreeMoveToFolder) {
                    const selectedTree = trees.find(tree => tree.id === selectedTreeId);
                    if (selectedTree) {
                        onTreeMoveToFolder({
                            ...selectedTree,
                            targetFolderId: targetFolder.id
                        });
                        // 네비게이션 모드 종료
                        setNavigationMode(false);
                        setCurrentFolderIndex(0);
                    }
                }
            } else if (e.key === "Escape") {
                // 네비게이션 모드 취소
                setNavigationMode(false);
                setCurrentFolderIndex(0);
            }
        }
    }, [showCreateFolder, handleFolderCreate, navigationMode, selectedTreeId, folders, currentFolderIndex, onTreeMoveToFolder, trees]);


    // 키보드 이벤트 리스너 등록
    React.useEffect(() => {
        if (isVisible) {
            document.addEventListener('keydown', handleKeyDown);
            return () => {
                document.removeEventListener('keydown', handleKeyDown);
            };
        }
    }, [isVisible, handleKeyDown]);

    if (!isVisible) {
        return null;
    }

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    transition={{ type: "spring", duration: 0.3 }}
                    className="w-full max-w-6xl h-[80vh] mx-4 bg-slate-900 border border-slate-700 rounded-lg shadow-xl flex overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* VORAN BOX 영역 */}
                    <div
                        className={cn(
                            "flex-1 border-r border-slate-700/50 bg-slate-900/40 transition-colors",
                            dragOverTarget?.type === "voran" && "bg-blue-900/20 border-blue-500/50"
                        )}
                        onDragOver={(e) => handleDragOver(e, "voran", null)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, "voran", null)}
                    >
                        <div className="border-b border-slate-700/50 px-4 py-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <h3 className="text-lg font-semibold text-slate-200">VORAN BOX</h3>
                                    <span className="text-xs text-slate-400 bg-slate-800 px-2 py-1 rounded-full">
                                        {voranTrees.length}
                                    </span>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={onClose}
                                    className="h-6 w-6 p-0 text-slate-400 hover:text-slate-200"
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                            <p className="mt-1 text-xs text-slate-400">
                                저장된 트리들을 관리하세요
                            </p>
                            {navigationMode && selectedTreeId && (
                                <div className="mt-2 text-xs text-blue-400 font-medium">
                                    탭키로 폴더를 선택하고 엔터로 저장하세요
                                </div>
                            )}
                            {dragOverTarget?.type === "voran" && (
                                <div className="mt-2 text-xs text-blue-400 font-medium">
                                    여기에 트리를 놓으면 VORAN BOX로 이동합니다
                                </div>
                            )}
                        </div>

                        <div className="flex-1 overflow-y-auto px-4 py-3">
                            {loading ? (
                                <div className="flex items-center justify-center py-8">
                                    <div className="text-sm text-slate-400">로딩 중...</div>
                                </div>
                            ) : voranTrees.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-8 text-center">
                                    <TreeIcon className="h-8 w-8 text-slate-600 mb-2" />
                                    <p className="text-sm text-slate-400">저장된 트리가 없습니다</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {voranTrees.map((tree) => {
                                        const isSelected = tree.id === selectedTreeId;
                                        const isDragging = draggedTreeId === tree.id;

                                        return (
                                            <motion.div
                                                key={tree.id}
                                                initial={{ opacity: 0, y: -10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: -10 }}
                                                transition={{ duration: 0.2 }}
                                                draggable
                                                onDragStart={(e) => handleTreeDragStart(e, tree.id)}
                                                onDragEnd={handleTreeDragEnd}
                                                onClick={() => handleTreeClick(tree)}
                                                onDoubleClick={() => handleTreeDoubleClick(tree)}
                                                className={cn(
                                                    "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all cursor-pointer",
                                                    "hover:bg-slate-800/50 active:bg-slate-800/70",
                                                    isSelected && "bg-slate-700/50 border border-slate-600/50",
                                                    isDragging && "opacity-50 scale-95"
                                                )}
                                            >
                                                <TreeIcon className="h-4 w-4 text-slate-400 flex-shrink-0" />
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-medium text-slate-200 truncate">
                                                        {tree.title || "제목 없는 트리"}
                                                    </div>
                                                    <div className="flex items-center gap-2 text-xs text-slate-400">
                                                        <Clock className="h-3 w-3" />
                                                        <span>{formatDate(tree.updatedAt)}</span>
                                                        <span>•</span>
                                                        <span>{tree.treeData?.nodes?.length || 0}개 노드</span>
                                                    </div>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleTreeMoveToFolder(tree);
                                                    }}
                                                >
                                                    <MoreHorizontal className="h-3 w-3" />
                                                </Button>
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 폴더 관리 영역 */}
                    <div className="flex-1 bg-slate-900/40">
                        <div className="border-b border-slate-700/50 px-4 py-3">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-semibold text-slate-200">폴더 관리</h3>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setShowCreateFolder(true)}
                                    className="h-6 w-6 p-0 text-slate-400 hover:text-slate-200"
                                >
                                    <FolderPlus className="h-4 w-4" />
                                </Button>
                            </div>
                            <p className="mt-1 text-xs text-slate-400">
                                트리를 폴더별로 정리하세요
                            </p>
                        </div>

                        {/* 폴더 생성 폼 */}
                        <AnimatePresence>
                            {showCreateFolder && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="border-b border-slate-700/50 px-4 py-3"
                                >
                                    <div className="space-y-2">
                                        <Input
                                            value={newFolderName}
                                            onChange={(e) => setNewFolderName(e.target.value)}
                                            onKeyDown={handleKeyDown}
                                            placeholder="폴더 이름"
                                            className="h-8 text-sm bg-slate-800 border-slate-600 focus:border-blue-500"
                                            autoFocus
                                        />
                                        <div className="flex gap-2">
                                            <Button
                                                size="sm"
                                                onClick={handleFolderCreate}
                                                disabled={!newFolderName.trim()}
                                                className="h-6 px-2 text-xs"
                                            >
                                                생성
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => {
                                                    setShowCreateFolder(false);
                                                    setNewFolderName("");
                                                }}
                                                className="h-6 px-2 text-xs"
                                            >
                                                취소
                                            </Button>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* 폴더 목록 */}
                        <div className="flex-1 overflow-y-auto px-4 py-3">
                            {folders.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-8 text-center">
                                    <Folder className="h-8 w-8 text-slate-600 mb-2" />
                                    <p className="text-sm text-slate-400">폴더가 없습니다</p>
                                    <p className="text-xs text-slate-500 mt-1">
                                        + 버튼을 눌러 새 폴더를 만드세요
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    {folders.map((folder, index) => {
                                        const isNavigationSelected = navigationMode && index === currentFolderIndex;
                                        const isDragTarget = dragOverTarget?.type === "folder" && dragOverTarget?.id === folder.id;

                                        return (
                                            <motion.div
                                                key={folder.id}
                                                animate={isNavigationSelected ? {
                                                    scale: 1.02,
                                                    backgroundColor: "rgba(59, 130, 246, 0.1)"
                                                } : {}}
                                                transition={{ duration: 0.2 }}
                                                className={cn(
                                                    "group flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-all",
                                                    "hover:bg-slate-800/50",
                                                    selectedFolderId === folder.id && "bg-slate-700/50",
                                                    isNavigationSelected && "bg-blue-900/20 border border-blue-500/50 ring-2 ring-blue-500/30",
                                                    isDragTarget && "bg-blue-900/20 border border-blue-500/50"
                                                )}
                                                onClick={() => onFolderSelect && onFolderSelect(folder.id)}
                                                onDragOver={(e) => handleDragOver(e, "folder", folder.id)}
                                                onDragLeave={handleDragLeave}
                                                onDrop={(e) => handleDrop(e, "folder", folder.id)}
                                            >
                                                <Folder className="h-4 w-4 text-slate-400 flex-shrink-0" />
                                                <div className="flex-1 min-w-0">
                                                    <span className="text-slate-200 truncate">{folder.name}</span>
                                                    {isNavigationSelected && (
                                                        <div className="text-xs text-blue-400 font-medium mt-1">
                                                            선택됨 - 엔터로 저장
                                                        </div>
                                                    )}
                                                    {isDragTarget && (
                                                        <div className="text-xs text-blue-400 font-medium mt-1">
                                                            여기에 트리를 놓으면 이 폴더로 이동합니다
                                                        </div>
                                                    )}
                                                </div>
                                                {folderTreeCounts[folder.id] > 0 && (
                                                    <span className="text-xs text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded-full">
                                                        {folderTreeCounts[folder.id]}
                                                    </span>
                                                )}
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default VoranBoxManager;
