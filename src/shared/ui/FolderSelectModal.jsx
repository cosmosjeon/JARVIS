import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './dialog';
import { Button } from './button';
import { cn } from 'shared/utils';
import { Box, Folder as FolderIcon } from 'lucide-react';

const FolderSelectModal = ({
  open,
  onOpenChange,
  folders = [],
  onSelect,
  onCancel,
  title = "폴더 선택",
  selectedItemName = "항목"
}) => {
  const handleSelect = (folderId, folderName) => {
    onSelect(folderId, folderName);
    onOpenChange(false);
  };

  const handleCancel = () => {
    onCancel?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{selectedItemName}을(를) 어디로 옮기시겠습니까?</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-2 py-4">
          {/* BOX 옵션 */}
          <Button
            variant="outline"
            className="w-full justify-start gap-2 h-auto p-3"
            onClick={() => handleSelect(null, "BOX")}
          >
            <Box className="h-4 w-4 text-muted-foreground" />
            <div className="flex flex-col items-start">
              <span className="font-medium">BOX</span>
              <span className="text-xs text-muted-foreground">기본 저장소</span>
            </div>
          </Button>

          {/* 폴더 옵션들 */}
          {folders.map((folder) => (
            <Button
              key={folder.id}
              variant="outline"
              className="w-full justify-start gap-2 h-auto p-3"
              onClick={() => handleSelect(folder.id, folder.name)}
            >
              <FolderIcon className="h-4 w-4 text-muted-foreground" />
              <div className="flex flex-col items-start">
                <span className="font-medium">{folder.name}</span>
                <span className="text-xs text-muted-foreground">폴더</span>
              </div>
            </Button>
          ))}

          {folders.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <FolderIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">사용 가능한 폴더가 없습니다</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={handleCancel}>
            취소
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FolderSelectModal;
