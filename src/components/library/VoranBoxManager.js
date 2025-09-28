import React, { useState, useCallback, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    X,
    FolderTree as TreeIcon,
    Clock,
    MoreHorizontal,
    FolderPlus,
    Folder,
    Edit,
    Trash2
} from "lucide-react";
import { Button } from "components/ui/button";
import { Input } from "components/ui/input";
import { cn } from "lib/utils";
import Logo from "assets/admin-widget/logo.svg";

const VoranBoxManager = ({
    isVisible,
    onClose,
    trees = [],
    folders = [],
    onTreeSelect,
    onTreeMoveToFolder,
    onTreeOpen,
    onTreeRename,
    onTreeDelete,
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
    const [localSelectedTreeId, setLocalSelectedTreeId] = useState(null); // 로컬 선택된 트리 ID
    const [contextMenuTreeId, setContextMenuTreeId] = useState(null); // 컨텍스트 메뉴가 열린 트리 ID
    const [editingTreeId, setEditingTreeId] = useState(null); // 편집 중인 트리 ID
    const [editingTreeName, setEditingTreeName] = useState(""); // 편집 중인 트리 이름

    // 박스 레이아웃을 나갈 때 폴더 선택 초기화
    const handleClose = useCallback(() => {
        // 폴더 선택 초기화
        if (onFolderSelect) {
            onFolderSelect(null);
        }
        // 네비게이션 모드 종료
        setNavigationMode(false);
        setCurrentFolderIndex(0);
        setLocalSelectedTreeId(null);
        // 원래 onClose 호출
        if (onClose) {
            onClose();
        }
    }, [onFolderSelect, onClose]);

    // VoranBoxManager가 열릴 때 폴더 선택 초기화 및 첫 번째 트리 자동 선택
    React.useEffect(() => {
        if (isVisible) {
            if (onFolderSelect) {
                onFolderSelect(null);
            }
            // 첫 번째 VORAN BOX 트리 자동 선택
            const voranTrees = trees.filter(tree => !tree.folderId);
            if (voranTrees.length > 0) {
                setLocalSelectedTreeId(voranTrees[0].id);
                setNavigationMode(true);
                setCurrentFolderIndex(0);
            }
        }
    }, [isVisible, onFolderSelect]); // trees 의존성 제거

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

        // 드래그 시작 시 트리 선택만 처리 (폴더 이동은 하지 않음)
        const tree = trees.find(t => t.id === treeId);
        if (tree) {
            // 트리 선택 시 선택 상태 업데이트만
            setLocalSelectedTreeId(tree.id);
            // 네비게이션 모드는 활성화하지 않음
        }

        // Create custom drag image (only if setDragImage is available)
        if (e.dataTransfer.setDragImage) {
            const dragImage = e.target.cloneNode(true);
            dragImage.style.transform = "rotate(5deg)";
            dragImage.style.opacity = "0.8";
            dragImage.style.position = "absolute";
            dragImage.style.top = "-1000px";
            dragImage.style.left = "-1000px";
            document.body.appendChild(dragImage);

            // 드래그 이미지의 중심을 마우스 커서 위치로 설정
            const rect = dragImage.getBoundingClientRect();
            e.dataTransfer.setDragImage(dragImage, rect.width / 2, rect.height / 2);

            // Clean up drag image after a short delay
            setTimeout(() => {
                if (document.body.contains(dragImage)) {
                    document.body.removeChild(dragImage);
                }
            }, 0);
        }
    }, [trees]);

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
        // 트리 선택 시 선택 상태 업데이트만
        setLocalSelectedTreeId(tree.id);

        // VORAN BOX의 트리인 경우에만 네비게이션 모드 활성화
        const isVoranTree = !tree.folderId;
        if (isVoranTree) {
            setNavigationMode(true);
            setCurrentFolderIndex(0);
            if (onFolderSelect) {
                onFolderSelect(null);
            }
        }
    }, [onFolderSelect]);

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

    // 트리 이름 변경 핸들러
    const handleTreeRename = useCallback((treeId, newName) => {
        if (onTreeRename && newName?.trim()) {
            onTreeRename(treeId, newName.trim());
            setEditingTreeId(null);
            setEditingTreeName("");
        }
    }, [onTreeRename]);

    // 트리 삭제 핸들러
    const handleTreeDelete = useCallback((treeId) => {
        if (onTreeDelete) {
            onTreeDelete(treeId);
        }
        setContextMenuTreeId(null);
    }, [onTreeDelete]);

    // 컨텍스트 메뉴 토글
    const toggleContextMenu = useCallback((treeId) => {
        setContextMenuTreeId(prev => prev === treeId ? null : treeId);
    }, []);

    // 편집 모드 시작
    const startEditing = useCallback((tree) => {
        setEditingTreeId(tree.id);
        setEditingTreeName(tree.title || "");
        setContextMenuTreeId(null);
    }, []);

    // 편집 취소
    const cancelEditing = useCallback(() => {
        setEditingTreeId(null);
        setEditingTreeName("");
    }, []);

    // 컨텍스트 메뉴 외부 클릭 시 닫기
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (contextMenuTreeId && !event.target.closest('.context-menu-container')) {
                setContextMenuTreeId(null);
            }
        };

        if (contextMenuTreeId) {
            document.addEventListener('click', handleClickOutside);
            return () => document.removeEventListener('click', handleClickOutside);
        }
    }, [contextMenuTreeId]);

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

        // 좌우 방향키로 폴더 이동
        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
            e.preventDefault();
            setCurrentFolderIndex(prev => {
                const totalItems = folders.length + 1; // VORAN BOX 포함
                let nextIndex;

                if (e.key === "ArrowLeft") {
                    // 왼쪽 방향키: 이전 폴더
                    nextIndex = prev === 0 ? totalItems - 1 : prev - 1;
                } else {
                    // 오른쪽 방향키: 다음 폴더
                    nextIndex = (prev + 1) % totalItems;
                }

                if (nextIndex === 0) {
                    // VORAN BOX 선택
                    if (onFolderSelect) {
                        onFolderSelect(null);
                    }
                } else {
                    // 실제 폴더 선택
                    const targetFolder = folders[nextIndex - 1];
                    if (targetFolder && onFolderSelect) {
                        onFolderSelect(targetFolder.id);
                    }
                }
                return nextIndex;
            });
        }

        // 위아래 방향키로 트리 이동 (VORAN BOX에서만)
        if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();

            // VORAN BOX의 트리들만 가져오기
            const voranTrees = trees.filter(tree => !tree.folderId);

            if (voranTrees.length > 0) {
                const currentIndex = voranTrees.findIndex(tree => tree.id === localSelectedTreeId);
                let nextIndex;

                if (e.key === "ArrowUp") {
                    // 위쪽 방향키: 이전 트리
                    nextIndex = currentIndex === -1 ? 0 : (currentIndex === 0 ? voranTrees.length - 1 : currentIndex - 1);
                } else {
                    // 아래쪽 방향키: 다음 트리
                    nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % voranTrees.length;
                }

                if (voranTrees[nextIndex]) {
                    setLocalSelectedTreeId(voranTrees[nextIndex].id);
                    // 트리 이동 시에는 폴더 선택을 변경하지 않음
                }
            }
        }

        // 탭키는 VoranBoxManager가 포커스를 받고 있을 때만 동작
        if (e.key === "Tab") {
            e.preventDefault();
            // 다음 폴더로 이동하고 실제로 선택 (VORAN BOX 포함)
            setCurrentFolderIndex(prev => {
                const totalItems = folders.length + 1; // VORAN BOX 포함
                const nextIndex = (prev + 1) % totalItems;

                if (nextIndex === 0) {
                    // VORAN BOX 선택
                    if (onFolderSelect) {
                        onFolderSelect(null);
                    }
                } else {
                    // 실제 폴더 선택
                    const targetFolder = folders[nextIndex - 1];
                    if (targetFolder && onFolderSelect) {
                        onFolderSelect(targetFolder.id);
                    }
                }
                return nextIndex;
            });
        }

        // 엔터키와 스페이스바로 트리 저장
        if (localSelectedTreeId) {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                // 선택된 폴더에 트리 저장 (VORAN BOX 포함)
                if (currentFolderIndex === 0) {
                    // VORAN BOX에 저장 (트리를 VORAN BOX로 이동)
                    const selectedTree = trees.find(tree => tree.id === localSelectedTreeId);
                    if (selectedTree && onTreeMoveToFolder) {
                        onTreeMoveToFolder({
                            ...selectedTree,
                            targetFolderId: null
                        });
                    }
                } else {
                    // 실제 폴더에 저장
                    const targetFolder = folders[currentFolderIndex - 1];
                    if (targetFolder && onTreeMoveToFolder) {
                        const selectedTree = trees.find(tree => tree.id === localSelectedTreeId);
                        if (selectedTree) {
                            onTreeMoveToFolder({
                                ...selectedTree,
                                targetFolderId: targetFolder.id
                            });
                        }
                    }
                }

                // 다음 트리 자동 선택 (공통 로직)
                const voranTrees = trees.filter(tree => !tree.folderId);
                const currentIndex = voranTrees.findIndex(tree => tree.id === localSelectedTreeId);
                const nextIndex = (currentIndex + 1) % voranTrees.length;

                if (voranTrees.length > 1) {
                    // 다음 트리가 있으면 선택
                    setLocalSelectedTreeId(voranTrees[nextIndex].id);
                    // 현재 폴더 인덱스 유지 (리셋하지 않음)
                } else {
                    // 마지막 트리이거나 트리가 없으면
                    if (currentFolderIndex === 0) {
                        // VORAN BOX에 저장했으면 트리 계속 선택 유지
                        setNavigationMode(true);
                        // 현재 폴더 인덱스 유지 (VORAN BOX)
                    } else {
                        // 실제 폴더에 저장했으면 트리 포커싱 멈춤
                        setNavigationMode(false);
                        setLocalSelectedTreeId(null);
                    }
                }
            } else if (e.key === "Escape") {
                // 오버레이 닫기
                handleClose();
            }
        }
    }, [showCreateFolder, handleFolderCreate, navigationMode, localSelectedTreeId, folders, currentFolderIndex, onTreeMoveToFolder, onFolderSelect, trees]);


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
                onClick={handleClose}
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
                        <div className="border-b border-slate-700/50 px-4 h-[87px] flex flex-col justify-center">
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
                                    onClick={handleClose}
                                    className="h-6 w-6 p-0 text-slate-400 hover:text-slate-200"
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                            <p className="mt-1 text-xs text-slate-400">
                                저장된 트리들을 관리하세요
                            </p>
                            {navigationMode && localSelectedTreeId && (
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
                                <div className="space-y-0">
                                    {voranTrees.map((tree, index) => {
                                        const isSelected = tree.id === localSelectedTreeId;
                                        const isDragging = draggedTreeId === tree.id;

                                        return (
                                            <div key={tree.id}>
                                                {index > 0 && (
                                                    <div className="border-t border-slate-600/50 my-1"></div>
                                                )}
                                                <motion.div
                                                    initial={{ opacity: 0, y: -10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, y: -10 }}
                                                    transition={{ duration: 0.2 }}
                                                    draggable={editingTreeId !== tree.id}
                                                    onDragStart={(e) => editingTreeId !== tree.id && handleTreeDragStart(e, tree.id)}
                                                    onDragEnd={handleTreeDragEnd}
                                                    onClick={() => editingTreeId !== tree.id && handleTreeClick(tree)}
                                                    onDoubleClick={() => editingTreeId !== tree.id && handleTreeDoubleClick(tree)}
                                                    className={cn(
                                                        "group relative flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-all",
                                                        editingTreeId !== tree.id && "cursor-pointer hover:bg-slate-800/50 active:bg-slate-800/70",
                                                        isSelected && "bg-slate-700/50 border border-slate-600/50",
                                                        isDragging && "opacity-50 scale-95"
                                                    )}
                                                >
                                                    <TreeIcon className="h-3 w-3 text-slate-400 flex-shrink-0" />
                                                    <div className="flex-1 min-w-0">
                                                        {editingTreeId === tree.id ? (
                                                            <Input
                                                                value={editingTreeName}
                                                                onChange={(e) => setEditingTreeName(e.target.value)}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') {
                                                                        handleTreeRename(tree.id, editingTreeName);
                                                                    } else if (e.key === 'Escape') {
                                                                        cancelEditing();
                                                                    }
                                                                }}
                                                                onBlur={() => handleTreeRename(tree.id, editingTreeName)}
                                                                className="h-6 text-xs bg-slate-700 border-slate-600 text-slate-200"
                                                                autoFocus
                                                            />
                                                        ) : (
                                                            <>
                                                                <div className="font-medium text-slate-200 truncate text-xs">
                                                                    {tree.title || "제목 없는 트리"}
                                                                </div>
                                                                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                                                                    <Clock className="h-2.5 w-2.5" />
                                                                    <span className="text-xs">{formatDate(tree.updatedAt)}</span>
                                                                    <span>•</span>
                                                                    <span className="text-xs">{tree.treeData?.nodes?.length || 0}개 노드</span>
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                    {editingTreeId !== tree.id && (
                                                        <div className="relative context-menu-container">
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-6 w-6 p-0 opacity-60 group-hover:opacity-100 transition-opacity bg-slate-700/50 hover:bg-slate-600/50"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    toggleContextMenu(tree.id);
                                                                }}
                                                            >
                                                                <MoreHorizontal className="h-3 w-3" />
                                                            </Button>
                                                            
                                                            {/* 컨텍스트 메뉴 */}
                                                            {contextMenuTreeId === tree.id && (
                                                                <div className="absolute right-0 top-6 z-50 bg-slate-800 border border-slate-600 rounded-md shadow-lg py-1 min-w-[120px]">
                                                                    <button
                                                                        className="w-full px-3 py-1.5 text-left text-xs text-slate-200 hover:bg-slate-700 flex items-center gap-2"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            startEditing(tree);
                                                                        }}
                                                                    >
                                                                        <Edit className="h-3 w-3" />
                                                                        이름 고치기
                                                                    </button>
                                                                    <button
                                                                        className="w-full px-3 py-1.5 text-left text-xs text-red-400 hover:bg-slate-700 flex items-center gap-2"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleTreeDelete(tree.id);
                                                                        }}
                                                                    >
                                                                        <Trash2 className="h-3 w-3" />
                                                                        지우기
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </motion.div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 폴더 관리 영역 */}
                    <div className="flex-1 bg-slate-900/40 flex flex-col">
                        <div className="px-4 pt-3 pb-0">
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
                        </div>

                        {/* 폴더 목록 (상단 1행) */}
                        <div className="px-4 py-2 border-b border-slate-700/50">
                            <div className="flex gap-2 overflow-x-auto">
                                {/* VORAN BOX 항목 (첫 번째) */}
                                <button
                                    className={cn(
                                        "flex-shrink-0 flex items-center gap-1.5 px-1.5 py-1 rounded-md text-xs transition-all bg-slate-800/80 border border-slate-700/50",
                                        "focus:outline-none focus:ring-0", // 주황 테두리 제거
                                        // 선택된 상태가 아닐 때만 호버 디자인 적용
                                        !(selectedFolderId === null || (navigationMode && currentFolderIndex === 0)) && "hover:bg-slate-700/80 hover:border-slate-600/50",
                                        (selectedFolderId === null || (navigationMode && currentFolderIndex === 0)) && "bg-blue-600/30 border-blue-500/70",
                                        dragOverTarget?.type === "voran" && "bg-blue-900/30 border-blue-500/70"
                                    )}
                                    onClick={() => {
                                        if (onFolderSelect) {
                                            onFolderSelect(null);
                                        }
                                        // VORAN BOX 클릭 시에도 네비게이션 모드 활성화
                                        if (localSelectedTreeId) {
                                            setNavigationMode(true);
                                            setCurrentFolderIndex(0);
                                        }
                                    }}
                                    onDragOver={(e) => handleDragOver(e, "voran", null)}
                                    onDragLeave={handleDragLeave}
                                    onDrop={(e) => handleDrop(e, "voran", null)}
                                >
                                    <TreeIcon className="h-3 w-3 text-slate-400" />
                                    <span className="text-slate-200">VORAN BOX</span>
                                    <span className="text-xs text-slate-400 bg-slate-700 px-1 py-0.5 rounded-full">
                                        {voranTrees.length}
                                    </span>
                                </button>

                                {/* 실제 폴더들 */}
                                {folders.length === 0 ? (
                                    <div className="flex items-center justify-center py-4 text-center">
                                        <p className="text-sm text-slate-400">폴더가 없습니다</p>
                                    </div>
                                ) : (
                                    folders.map((folder, index) => {
                                        const folderIndex = index + 1; // VORAN BOX가 0번이므로 +1
                                        const isNavigationSelected = navigationMode && folderIndex === currentFolderIndex;
                                        const isDragTarget = dragOverTarget?.type === "folder" && dragOverTarget?.id === folder.id;

                                        return (
                                            <button
                                                key={folder.id}
                                                className={cn(
                                                    "flex-shrink-0 flex items-center gap-1.5 px-1.5 py-1 rounded-md text-xs transition-all bg-slate-800/80 border border-slate-700/50",
                                                    "focus:outline-none focus:ring-0", // 주황 테두리 제거
                                                    // 선택된 상태가 아닐 때만 호버 디자인 적용
                                                    !(selectedFolderId === folder.id || isNavigationSelected) && "hover:bg-slate-700/80 hover:border-slate-600/50",
                                                    (selectedFolderId === folder.id || isNavigationSelected) && "bg-blue-600/30 border-blue-500/70",
                                                    isDragTarget && "bg-blue-900/30 border-blue-500/70"
                                                )}
                                                onClick={() => {
                                                    if (onFolderSelect) {
                                                        onFolderSelect(folder.id);
                                                    }
                                                    // 폴더 클릭 시에도 네비게이션 모드 활성화
                                                    if (localSelectedTreeId) {
                                                        setNavigationMode(true);
                                                        setCurrentFolderIndex(folderIndex);
                                                    }
                                                }}
                                                onDragOver={(e) => handleDragOver(e, "folder", folder.id)}
                                                onDragLeave={handleDragLeave}
                                                onDrop={(e) => handleDrop(e, "folder", folder.id)}
                                            >
                                                <Folder className="h-3 w-3 text-slate-400" />
                                                <span className="text-slate-200">{folder.name}</span>
                                                <span className="text-xs text-slate-400 bg-slate-700 px-1 py-0.5 rounded-full">
                                                    {folderTreeCounts[folder.id] || 0}
                                                </span>
                                            </button>
                                        );
                                    })
                                )}
                            </div>
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

                        {/* 선택된 폴더의 트리 목록 - 전체 영역 사용 */}
                        <div className="flex-1 overflow-y-auto px-4 py-3 transition-colors">
                            {selectedFolderId ? (
                                <div
                                    className={cn(
                                        "h-full",
                                        dragOverTarget?.type === "folder" && dragOverTarget?.id === selectedFolderId && "bg-blue-900/20"
                                    )}
                                    onDragOver={(e) => handleDragOver(e, "folder", selectedFolderId)}
                                    onDragLeave={handleDragLeave}
                                    onDrop={(e) => handleDrop(e, "folder", selectedFolderId)}
                                >
                                    {(() => {
                                        const selectedFolder = folders.find(f => f.id === selectedFolderId);
                                        const folderTrees = trees.filter(tree => tree.folderId === selectedFolderId);

                                        return (
                                            <div className="space-y-0 h-full">
                                                {folderTrees.length === 0 ? (
                                                    <div className="flex flex-col items-center justify-center py-8 text-center h-full">
                                                        <TreeIcon className="h-8 w-8 text-slate-600 mb-2" />
                                                        <p className="text-sm text-slate-400">이 폴더에 트리가 없습니다</p>
                                                        {dragOverTarget?.type === "folder" && dragOverTarget?.id === selectedFolderId && (
                                                            <div className="mt-2 text-xs text-blue-400 font-medium">
                                                                여기에 트리를 놓으면 이 폴더로 이동합니다
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="space-y-0">
                                                        {folderTrees.map((tree, index) => {
                                                            const isSelected = tree.id === localSelectedTreeId;
                                                            const isDragging = draggedTreeId === tree.id;

                                                            return (
                                                                <div key={tree.id}>
                                                                    {index > 0 && (
                                                                        <div className="border-t border-slate-600/50 my-1"></div>
                                                                    )}
                                                                    <motion.div
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
                                                                            "group relative flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-all cursor-pointer",
                                                                            "hover:bg-slate-800/50 active:bg-slate-800/70",
                                                                            isSelected && "bg-slate-700/50 border border-slate-600/50",
                                                                            isDragging && "opacity-50 scale-95"
                                                                        )}
                                                                    >
                                                                        <TreeIcon className="h-3 w-3 text-slate-400 flex-shrink-0" />
                                                                        <div className="flex-1 min-w-0">
                                                                            <div className="font-medium text-slate-200 truncate text-xs">
                                                                                {tree.title || "제목 없는 트리"}
                                                                            </div>
                                                                            <div className="flex items-center gap-1.5 text-xs text-slate-400">
                                                                                <Clock className="h-2.5 w-2.5" />
                                                                                <span className="text-xs">{formatDate(tree.updatedAt)}</span>
                                                                                <span>•</span>
                                                                                <span className="text-xs">{tree.treeData?.nodes?.length || 0}개 노드</span>
                                                                            </div>
                                                                        </div>
                                                                        <div className="relative context-menu-container">
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                className="h-6 w-6 p-0 opacity-60 group-hover:opacity-100 transition-opacity bg-slate-700/50 hover:bg-slate-600/50"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    toggleContextMenu(tree.id);
                                                                                }}
                                                                            >
                                                                                <MoreHorizontal className="h-3 w-3" />
                                                                            </Button>
                                                                            
                                                                            {/* 컨텍스트 메뉴 */}
                                                                            {contextMenuTreeId === tree.id && (
                                                                                <div className="absolute right-0 top-6 z-50 bg-slate-800 border border-slate-600 rounded-md shadow-lg py-1 min-w-[120px]">
                                                                                    <button
                                                                                        className="w-full px-3 py-1.5 text-left text-xs text-slate-200 hover:bg-slate-700 flex items-center gap-2"
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            startEditing(tree);
                                                                                        }}
                                                                                    >
                                                                                        <Edit className="h-3 w-3" />
                                                                                        이름 고치기
                                                                                    </button>
                                                                                    <button
                                                                                        className="w-full px-3 py-1.5 text-left text-xs text-red-400 hover:bg-slate-700 flex items-center gap-2"
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            handleTreeDelete(tree.id);
                                                                                        }}
                                                                                    >
                                                                                        <Trash2 className="h-3 w-3" />
                                                                                        지우기
                                                                                    </button>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </motion.div>
                                                                </div>
                                                            );
                                                        })}
                                                        {dragOverTarget?.type === "folder" && dragOverTarget?.id === selectedFolderId && folderTrees.length > 0 && (
                                                            <div className="mt-2 text-xs text-blue-400 font-medium text-center">
                                                                여기에 트리를 놓으면 이 폴더로 이동합니다
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-center">
                                    <div className="flex items-center gap-3 mb-4">
                                        <img src={Logo} alt="VORAN" className="h-12 w-12 opacity-80" />
                                        <div className="text-left">
                                            <h3 className="text-lg font-semibold text-slate-200 mb-1">라이브러리</h3>
                                            <p className="text-sm text-slate-400">라이브러리에서 열 트리를 선택하세요.</p>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-center gap-2 text-xs text-slate-500">
                                        <p>• 폴더를 클릭하여 트리를 확인하세요</p>
                                        <p>• 키보드로 빠르게 탐색할 수 있습니다</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 조작키 안내 */}
                        <div className="border-t border-slate-700/50 px-4 py-2 bg-slate-800/30">
                            <div className="text-xs text-slate-400 space-y-1">
                                <div className="flex items-center gap-4">
                                    <span className="flex items-center gap-1">
                                        <kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-xs">←</kbd>
                                        <kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-xs">→</kbd>
                                        <span className="text-slate-500">폴더 이동</span>
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-xs">↑</kbd>
                                        <kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-xs">↓</kbd>
                                        <span className="text-slate-500">트리 선택</span>
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-xs">Tab</kbd>
                                        <span className="text-slate-500">폴더 순환</span>
                                    </span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className="flex items-center gap-1">
                                        <kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-xs">Enter</kbd>
                                        <span className="text-slate-500">트리 저장</span>
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-xs">Esc</kbd>
                                        <span className="text-slate-500">닫기</span>
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <span className="text-slate-500">드래그로 이동</span>
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default VoranBoxManager;
