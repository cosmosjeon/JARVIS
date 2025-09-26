import React, { useState } from "react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "components/ui/resizable";
import { dummyLibraryData } from "data/dummyData";

import Sidebar from "./Sidebar";
import TreeCanvas from "./TreeCanvas";

const LibraryApp = () => {
  const [selectedMemo, setSelectedMemo] = useState(null);
  const [libraryData, setLibraryData] = useState(dummyLibraryData);

  const handleMemoSelect = (memo) => {
    setSelectedMemo(memo);
  };

  const handleFolderCreate = (name, parentId = null) => {
    const newFolder = {
      id: `folder_${Date.now()}`,
      name,
      parentId,
      createdAt: Date.now(),
      expanded: true,
    };

    setLibraryData((prev) => ({
      ...prev,
      folders: [...prev.folders, newFolder],
    }));
  };

  const handleMemoCreate = (title, folderId) => {
    const newMemo = {
      id: `memo_${Date.now()}`,
      title,
      folderId,
      treeData: { nodes: [], links: [] },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    setLibraryData((prev) => ({
      ...prev,
      memos: [...prev.memos, newMemo],
    }));

    setSelectedMemo(newMemo);
  };

  return (
    <div className="h-screen bg-background text-foreground">
      <ResizablePanelGroup direction="horizontal" className="h-full">
        <ResizablePanel defaultSize={25} minSize={20} maxSize={40}>
          <Sidebar
            data={libraryData}
            selectedMemo={selectedMemo}
            onMemoSelect={handleMemoSelect}
            onFolderCreate={handleFolderCreate}
            onMemoCreate={handleMemoCreate}
          />
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize={75}>
          <TreeCanvas
            selectedMemo={selectedMemo}
            onMemoUpdate={(updatedMemo) => {
              setLibraryData((prev) => ({
                ...prev,
                memos: prev.memos.map((memo) =>
                  memo.id === updatedMemo.id ? updatedMemo : memo
                ),
              }));
              setSelectedMemo(updatedMemo);
            }}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
};

export default LibraryApp;
