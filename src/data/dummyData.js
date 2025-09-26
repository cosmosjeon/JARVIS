export const dummyLibraryData = {
  folders: [
    {
      id: "folder_1",
      name: "학습 자료",
      parentId: null,
      createdAt: Date.now() - 86400000 * 7,
      expanded: true,
    },
    {
      id: "folder_2",
      name: "프로젝트",
      parentId: null,
      createdAt: Date.now() - 86400000 * 5,
      expanded: false,
    },
    {
      id: "folder_3",
      name: "React",
      parentId: "folder_1",
      createdAt: Date.now() - 86400000 * 3,
      expanded: true,
    },
    {
      id: "folder_4",
      name: "JavaScript",
      parentId: "folder_1",
      createdAt: Date.now() - 86400000 * 2,
      expanded: false,
    },
  ],
  memos: [
    {
      id: "memo_1",
      title: "React Hooks 이해하기",
      folderId: "folder_3",
      treeData: {
        nodes: [
          {
            id: "root",
            keyword: "React Hooks",
            fullText:
              "React Hooks는 함수형 컴포넌트에서 상태와 생명주기 기능을 사용할 수 있게 해주는 기능입니다.",
            level: 0,
            size: 20,
            status: "answered",
          },
          {
            id: "node_1",
            keyword: "useState",
            fullText:
              "useState는 함수형 컴포넌트에서 상태를 관리할 수 있게 해주는 Hook입니다.",
            level: 1,
            size: 15,
            status: "answered",
          },
          {
            id: "node_2",
            keyword: "useEffect",
            fullText: "useEffect는 컴포넌트의 사이드 이펙트를 처리하는 Hook입니다.",
            level: 1,
            size: 15,
            status: "answered",
          },
        ],
        links: [
          { source: "root", target: "node_1", value: 1 },
          { source: "root", target: "node_2", value: 1 },
        ],
      },
      createdAt: Date.now() - 86400000 * 3,
      updatedAt: Date.now() - 3600000,
    },
    {
      id: "memo_2",
      title: "JavaScript 비동기 처리",
      folderId: "folder_4",
      treeData: {
        nodes: [
          {
            id: "root",
            keyword: "비동기 처리",
            fullText: "JavaScript에서 비동기 처리는 Promise, async/await를 통해 구현됩니다.",
            level: 0,
            size: 20,
            status: "answered",
          },
          {
            id: "node_1",
            keyword: "Promise",
            fullText: "Promise는 비동기 작업의 완료 또는 실패를 나타내는 객체입니다.",
            level: 1,
            size: 15,
            status: "answered",
          },
        ],
        links: [{ source: "root", target: "node_1", value: 1 }],
      },
      createdAt: Date.now() - 86400000 * 2,
      updatedAt: Date.now() - 7200000,
    },
    {
      id: "memo_3",
      title: "프로젝트 아이디어",
      folderId: "folder_2",
      treeData: {
        nodes: [
          {
            id: "root",
            keyword: "프로젝트 기획",
            fullText: "새로운 웹 애플리케이션 프로젝트를 기획해보자",
            level: 0,
            size: 20,
            status: "answered",
          },
        ],
        links: [],
      },
      createdAt: Date.now() - 86400000,
      updatedAt: Date.now() - 86400000,
    },
  ],
};

export const getFolderChildren = (folders, folderId) => {
  return folders.filter((folder) => folder.parentId === folderId);
};

export const getMemosByFolder = (memos, folderId) => {
  return memos.filter((memo) => memo.folderId === folderId);
};

export const getRootFolders = (folders) => {
  return folders.filter((folder) => folder.parentId === null);
};

export const getAllMemos = (memos) => memos;
