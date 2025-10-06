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
  onMemoCreate,
}) => {
  const [name, setName] = useState("");
  const [selectedFolderId, setSelectedFolderId] = useState("");

  useEffect(() => {
    if (open) {
      setName("");
      setSelectedFolderId(type === "folder" ? ROOT_FOLDER_VALUE : "");
    }
  }, [open, type]);

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

    if (type === "folder") {
      const parentId = selectedFolderId === ROOT_FOLDER_VALUE ? null : selectedFolderId || null;
      onFolderCreate(name.trim(), parentId);
    } else if (type === "memo" && selectedFolderId) {
      onMemoCreate(name.trim(), selectedFolderId);
    }

    onOpenChange(false);
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.nativeEvent.isComposing) {
      event.preventDefault();
      handleSubmit();
    }
  };

  const isSubmitDisabled =
    !name.trim() || (type === "memo" && !selectedFolderId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>
            {type === "folder" ? "새 폴더 만들기" : "새 메모 만들기"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="library-create-name">
              {type === "folder" ? "폴더 이름" : "메모 제목"}
            </Label>
            <Input
              id="library-create-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              placeholder={type === "folder" ? "폴더 이름" : "메모 제목"}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="library-select-folder">
              {type === "folder" ? "상위 폴더" : "저장할 폴더"}
            </Label>
            <Select value={selectedFolderId || undefined} onValueChange={setSelectedFolderId}>
              <SelectTrigger id="library-select-folder">
                <SelectValue
                  placeholder={
                    type === "folder"
                      ? "루트 폴더 (선택사항)"
                      : "폴더를 선택하세요"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {type === "folder" && (
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
