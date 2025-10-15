import React, { useEffect, useMemo, useState } from "react";
import { Button } from "shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "shared/ui/dialog";
import { Input } from "shared/ui/input";
import { Label } from "shared/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "shared/ui/select";

const ROOT_FOLDER_VALUE = "__root__";

const CreateDialog = ({
  open,
  onOpenChange,
  type,
  folders,
  onFolderCreate,
}) => {
  const [name, setName] = useState("");
  const [selectedFolderId, setSelectedFolderId] = useState("");
  const isFolderMode = type === "folder";

  useEffect(() => {
    if (open) {
      setName("");
      setSelectedFolderId(isFolderMode ? ROOT_FOLDER_VALUE : "");
    }
  }, [open, isFolderMode]);

  const folderOptions = useMemo(
    () =>
      folders.map((folder) => ({
        value: folder.id,
        label: folder.name,
      })),
    [folders]
  );

  const handleSubmit = () => {
    if (!name.trim()) return;

    if (isFolderMode) {
      const parentId = selectedFolderId === ROOT_FOLDER_VALUE ? null : selectedFolderId || null;
      onFolderCreate(name.trim(), parentId);
    }

    onOpenChange(false);
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.nativeEvent.isComposing) {
      event.preventDefault();
      handleSubmit();
    }
  };

  const isSubmitDisabled = !name.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>
            {isFolderMode ? "새 폴더 만들기" : "새 항목 만들기"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="library-create-name">
              {isFolderMode ? "폴더 이름" : "항목 이름"}
            </Label>
            <Input
              id="library-create-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              placeholder={isFolderMode ? "폴더 이름" : "항목 이름"}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="library-select-folder">
              {isFolderMode ? "상위 폴더" : "저장할 폴더"}
            </Label>
            <Select value={selectedFolderId || undefined} onValueChange={setSelectedFolderId}>
              <SelectTrigger id="library-select-folder">
                <SelectValue
                  placeholder={
                    isFolderMode
                      ? "루트 폴더 (선택사항)"
                      : "폴더를 선택하세요"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {isFolderMode && (
                  <SelectItem value={ROOT_FOLDER_VALUE}>루트 폴더</SelectItem>
                )}
                {folderOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitDisabled}>
            만들기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateDialog;
