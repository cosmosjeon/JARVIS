import React, { useState } from "react";
import { Button } from "components/ui/button";
import { Input } from "components/ui/input";
import { ScrollArea } from "components/ui/scroll-area";
import { Folder, Plus, Search } from "lucide-react";

import CreateDialog from "./CreateDialog";
import FolderTree from "./FolderTree";

const Sidebar = ({
  data,
  selectedMemo,
  onMemoSelect,
  onFolderCreate,
  onMemoCreate,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createType, setCreateType] = useState("memo");

  const filteredMemos = data.memos.filter((memo) =>
    memo.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex h-full flex-col border-r bg-card">
      <div className="space-y-3 border-b p-4">
        <div className="flex gap-2">
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
        </div>

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
          />
        </div>
      </ScrollArea>

      <CreateDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        type={createType}
        folders={data.folders}
        onFolderCreate={onFolderCreate}
        onMemoCreate={onMemoCreate}
      />
    </div>
  );
};

export default Sidebar;
