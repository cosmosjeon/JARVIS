import React, { useState } from "react";
import { Button } from "shared/ui/button";
import { Input } from "shared/ui/input";
import { ScrollArea } from "shared/ui/scroll-area";
import { Folder, Plus, Search } from "lucide-react";

import CreateDialog from "./CreateDialog";
import FolderTree from "./FolderTree";

const Sidebar = ({
  data,
  selectedMemo,
  onMemoSelect,
  onFolderCreate,
  onMemoCreate,
  onMemoDelete,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createType, setCreateType] = useState("memo");

  const filteredMemos = data.memos.filter((memo) =>
    memo.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const canCreateMemo = typeof onMemoCreate === "function";
  const canCreateFolder = typeof onFolderCreate === "function";

  return (
    <div className="flex h-full flex-col border-r bg-card">
      <div className="space-y-3 border-b p-4">
        {(canCreateMemo || canCreateFolder) && (
          <div className="flex gap-2">
            {canCreateMemo ? (
              <Button
                className="flex-1"
                variant="outline"
                size="sm"
                onClick={() => {
                  setCreateType("memo");
                  setShowCreateDialog(true);
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                새 메모
              </Button>
            ) : null}
            {canCreateFolder ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setCreateType("folder");
                  setShowCreateDialog(true);
                }}
              >
                <Folder className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        )}

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="메모 검색..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2">
          <FolderTree
            folders={data.folders}
            memos={filteredMemos}
            selectedMemo={selectedMemo}
            onMemoSelect={onMemoSelect}
            onMemoDelete={onMemoDelete}
          />
        </div>
      </ScrollArea>

      {(canCreateMemo || canCreateFolder) && (
        <CreateDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          type={createType}
          folders={data.folders}
          onFolderCreate={onFolderCreate}
          onMemoCreate={onMemoCreate}
        />
      )}
    </div>
  );
};

export default Sidebar;
