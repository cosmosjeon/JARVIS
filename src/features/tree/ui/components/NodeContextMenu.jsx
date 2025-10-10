import React, { useState } from 'react';
import { Trash2, Edit3 } from 'lucide-react';
import { Button } from 'shared/ui/button';
import { Input } from 'shared/ui/input';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from 'shared/ui/dialog';

const NodeContextMenu = ({
    isOpen,
    position,
    node,
    theme,
    onClose,
    onDelete,
    onRename
}) => {
    const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
    const [newName, setNewName] = useState('');
    const [savedNode, setSavedNode] = useState(null);

    const isLightMode = theme === 'light';
    const nodeName = node?.name || node?.keyword || '제목 없음';

    const handleRenameClick = () => {
        setNewName(nodeName);
        setSavedNode(node);
        setIsRenameModalOpen(true);
        onClose();
    };

    const handleRenameSubmit = () => {
        if (newName.trim() && onRename && savedNode) {
            onRename(savedNode.id, newName.trim());
        }
        setIsRenameModalOpen(false);
        setNewName('');
        setSavedNode(null);
    };

    const handleDeleteClick = () => {
        if (onDelete && node) {
            onDelete(node.id);
        }
        onClose();
    };

    return (
        <>
            {/* 컨텍스트 메뉴 */}
            {isOpen && node && (
                <div
                    className={`
          fixed z-[9999] rounded-md shadow-lg border min-w-[160px]
          ${isLightMode
                            ? 'bg-white border-gray-200'
                            : 'bg-slate-900/95 border-white/15 backdrop-blur-sm'
                        }
        `}
                    style={{
                        left: position.x,
                        top: position.y,
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="py-1">
                        <button
                            onClick={handleRenameClick}
                            className={`
              flex items-center gap-2 px-3 py-2 text-sm transition w-full text-left
              ${isLightMode
                                    ? 'text-gray-700 hover:bg-gray-100'
                                    : 'text-gray-200 hover:bg-white/10'
                                }
            `}
                        >
                            <Edit3 className="w-4 h-4" />
                            <span>이름 바꾸기</span>
                        </button>

                        <button
                            onClick={handleDeleteClick}
                            className={`
              flex items-center gap-2 px-3 py-2 text-sm transition w-full text-left
              ${isLightMode
                                    ? 'text-red-600 hover:bg-red-50'
                                    : 'text-red-400 hover:bg-red-500/20'
                                }
            `}
                        >
                            <Trash2 className="w-4 h-4" />
                            <span>삭제</span>
                        </button>
                    </div>
                </div>
            )}

            {/* 이름 변경 모달 */}
            <Dialog
                open={isRenameModalOpen}
                onOpenChange={(open) => {
                    setIsRenameModalOpen(open);
                    if (!open) {
                        setNewName('');
                        setSavedNode(null);
                    }
                }}
            >
                <DialogContent className={isLightMode ? '' : 'bg-slate-900 border-white/15'}>
                    <DialogHeader>
                        <DialogTitle className={isLightMode ? '' : 'text-white'}>
                            노드 이름 바꾸기
                        </DialogTitle>
                        <DialogDescription className={isLightMode ? '' : 'text-gray-400'}>
                            새로운 이름을 입력하세요.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Input
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            placeholder="노드 이름"
                            className={isLightMode ? '' : 'bg-slate-800 border-white/15 text-white'}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    handleRenameSubmit();
                                }
                            }}
                            autoFocus
                        />
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setIsRenameModalOpen(false)}
                            className={isLightMode ? '' : 'border-white/15 text-white hover:bg-white/10'}
                        >
                            취소
                        </Button>
                        <Button
                            onClick={handleRenameSubmit}
                            disabled={!newName.trim()}
                            className={isLightMode ? '' : '!bg-slate-600 !hover:bg-slate-700 !text-white border-0'}
                        >
                            확인
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
};

export default NodeContextMenu;

