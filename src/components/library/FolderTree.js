import React, { useState } from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "components/ui/context-menu";
import { Badge } from "components/ui/badge";
import { cn } from "lib/utils";
import {
  getFolderChildren,
  getMemosByFolder,
  getRootFolders,
} from "data/dummyData";
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  FolderOpen,
} from "lucide-react";

const FolderItem = ({ folder, folders, memos, level = 0, selectedMemo, onMemoSelect }) => {
  const [isExpanded, setIsExpanded] = useState(folder.expanded ?? false);
  const children = getFolderChildren(folders, folder.id);
  const folderMemos = getMemosByFolder(memos, folder.id);
  const hasChildren = children.length > 0 || folderMemos.length > 0;

  return (
    <div className="space-y-1">
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            className={cn(
              "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
              isExpanded && "bg-accent/30"
            )}
            style={{ paddingLeft: `${level * 16 + 8}px` }}
            onClick={() => setIsExpanded((prev) => !prev)}
          >
            {hasChildren ? (
              <button
                type="button"
                className="flex h-5 w-5 items-center justify-center rounded hover:bg-muted"
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
            ) : (
              <span className="inline-block h-5 w-5" />
            )}

            {isExpanded ? (
              <FolderOpen className="h-4 w-4 text-primary" />
            ) : (
              <Folder className="h-4 w-4 text-primary" />
            )}

            <span className="flex-1 truncate font-medium">{folder.name}</span>
            {folderMemos.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {folderMemos.length}
              </Badge>
            )}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem>새 메모</ContextMenuItem>
          <ContextMenuItem>새 폴더</ContextMenuItem>
          <ContextMenuItem>이름 변경</ContextMenuItem>
          <ContextMenuItem className="text-destructive">삭제</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {isExpanded && (
        <div className="space-y-1">
          {children.map((child) => (
            <FolderItem
              key={child.id}
              folder={child}
              folders={folders}
              memos={memos}
              level={level + 1}
              selectedMemo={selectedMemo}
              onMemoSelect={onMemoSelect}
            />
          ))}

          {folderMemos.map((memo) => (
            <MemoItem
              key={memo.id}
              memo={memo}
              level={level + 1}
              isSelected={selectedMemo?.id === memo.id}
              onSelect={() => onMemoSelect(memo)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const MemoItem = ({ memo, level, isSelected, onSelect }) => {
  const nodeCount = memo.treeData?.nodes?.length ?? 0;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          className={cn(
            "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
            isSelected && "bg-accent text-accent-foreground"
          )}
          style={{ paddingLeft: `${level * 16 + 28}px` }}
          onClick={onSelect}
        >
          <FileText className="h-4 w-4 text-emerald-500" />
          <span className="flex-1 truncate">{memo.title}</span>
          {nodeCount > 0 && (
            <Badge variant="outline" className="text-xs">
              {nodeCount}개
            </Badge>
          )}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem>이름 변경</ContextMenuItem>
        <ContextMenuItem>복제</ContextMenuItem>
        <ContextMenuItem className="text-destructive">삭제</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};

const FolderTree = ({ folders, memos, selectedMemo, onMemoSelect }) => {
  const rootFolders = getRootFolders(folders);

  return (
    <div className="space-y-1">
      {rootFolders.map((folder) => (
        <FolderItem
          key={folder.id}
          folder={folder}
          folders={folders}
          memos={memos}
          selectedMemo={selectedMemo}
          onMemoSelect={onMemoSelect}
        />
      ))}
    </div>
  );
};

export default FolderTree;
