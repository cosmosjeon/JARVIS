import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import * as d3 from 'd3';
import { motion, AnimatePresence } from 'framer-motion';
import { treeData } from 'data/treeData';
import TreeAnimationService from 'features/tree/services/TreeAnimationService';
import QuestionService from 'features/tree/services/QuestionService';
import useTreeViewController from 'features/tree/hooks/useTreeViewController';
import { markNewLinks } from 'shared/utils/linkAnimationUtils';
import NodeAssistantPanel from 'features/tree/ui/components/NodeAssistantPanel';
import ForceDirectedTree from 'features/tree/ui/tree2/ForceDirectedTree';
import TidyTreeView from 'features/tree/ui/tree1/TidyTreeView';
import TreeTabBar from 'features/tree/ui/components/TreeTabBar';
import { useSupabaseAuth } from 'shared/hooks/useSupabaseAuth';
import { useTheme } from 'shared/components/library/ThemeProvider';
import { useSettings } from 'shared/hooks/SettingsContext';
import { Sun, Moon, Sparkles, Settings } from 'lucide-react';
import { useTreeViewport } from 'features/tree/hooks/useTreeViewport';
import { useTreePersistence } from 'features/tree/hooks/useTreePersistence';
import useTreeDataController from 'features/tree/hooks/useTreeDataController';
import {
  sanitizeConversationMessages,
  buildFallbackConversation,
} from 'features/tree/utils/conversation';
import useConversationStore from 'features/tree/state/useConversationStore';
import { useTreeDataSource } from 'features/tree/services/useTreeDataSource';
import { createTreeWidgetBridge } from 'infrastructure/electron/bridges/treeWidgetBridge';
import AgentClient from 'infrastructure/ai/agentClient';
import { useAIModelPreference } from 'shared/hooks/useAIModelPreference';
import { useTreeState } from 'features/tree/state/useTreeState';
import { stopTrackingEmptyTree, isTrackingEmptyTree, cleanupEmptyTrees } from 'features/tree/services/treeCreation';
import {
  forwardPanZoomGesture as applyPanZoomGesture,
  focusNodeToCenter as focusNodeToCenterUtil,
  createNodeDragHandler,
  applyNodeDragHandlers,
  raiseNodeLayer,
} from 'features/tree/ui/d3Renderer';
import { resolveTreeBackground } from 'features/tree/constants/themeBackgrounds';

const ORTHO_PATH_DEFAULTS = {
  cornerRadius: 20,
  nodePadding: 18,
};

import {
  buildRoundedPath,
  buildOrthogonalPath,
} from 'features/tree/ui/renderUtils';

const TIDY_ASSISTANT_PANEL_RATIO = 0.38;
const TIDY_ASSISTANT_PANEL_MIN_WIDTH = 360;
const TIDY_ASSISTANT_PANEL_MAX_WIDTH = 640;
const TIDY_ASSISTANT_PANEL_GAP = 0;

const HierarchicalForceTree = () => {
  const { user } = useSupabaseAuth();
  const {
    loadTrees,
    saveTreeMetadata,
    saveTreeNodes,
    removeTree,
  } = useTreeDataSource();
  const treeBridge = useMemo(() => createTreeWidgetBridge(), []);
  const { theme, setTheme, mode } = useTheme();
  const { zoomOnClickEnabled, setZoomOnClickEnabled } = useSettings();
  const {
    provider: selectedProvider,
    model: selectedModel,
    temperature: preferredTemperature,
    webSearchEnabled,
    reasoningEnabled,
  } = useAIModelPreference();

  // 테마 옵션 정의
  const themeOptions = useMemo(() => {
    return [
      { label: "반투명", value: "glass", icon: Sparkles },
      { label: "라이트", value: "light", icon: Sun },
      { label: "다크", value: "dark", icon: Moon },
    ];
  }, []);

  const activeTheme = themeOptions.find((option) => option.value === theme) || themeOptions[0];
  const ActiveThemeIcon = activeTheme.icon;

  // 테마 순환 함수
  const cycleTheme = useCallback(() => {
    const currentIndex = themeOptions.findIndex(option => option.value === theme);
    const nextIndex = (currentIndex + 1) % themeOptions.length;
    setTheme(themeOptions[nextIndex].value);
  }, [theme, themeOptions, setTheme]);

  const treeBackground = useMemo(() => resolveTreeBackground(theme), [theme]);

  const svgRef = useRef(null);
  const { dimensions: baseDimensions, nodeScaleFactor, viewTransform, setViewTransform } = useTreeViewport();
  const [isHandleMenuOpen, setIsHandleMenuOpen] = useState(false);
  const handleMenuRef = useRef(null);
  const handleMenuButtonRef = useRef(null);
  const [nodes, setNodes] = useState([]);
  const [links, setLinks] = useState([]);
  const [sessionTabs, setSessionTabs] = useState([]);
  const [activeTabId, setActiveTabId] = useState(null);
  const {
    viewMode,
    setViewMode,
    isForceView,
    isTidyView,
  } = useTreeViewController({ initialMode: 'tree1' });

  const closeHandleMenu = useCallback(() => {
    setIsHandleMenuOpen(false);
  }, []);
  const toggleHandleMenu = useCallback(() => {
    setIsHandleMenuOpen((previous) => !previous);
  }, []);
  const handleViewSwitch = useCallback((nextMode) => {
    if (!nextMode || nextMode === viewMode) {
      setIsHandleMenuOpen(false);
      return;
    }
    setViewMode(nextMode);
    setIsHandleMenuOpen(false);
  }, [setViewMode, viewMode]);
  useEffect(() => {
    setIsHandleMenuOpen(false);
  }, [viewMode]);
  useEffect(() => {
    if (!isHandleMenuOpen) {
      return;
    }

    const handlePointerDown = (event) => {
      const menuElement = handleMenuRef.current;
      const buttonElement = handleMenuButtonRef.current;
      if (menuElement && menuElement.contains(event.target)) {
        return;
      }
      if (buttonElement && buttonElement.contains(event.target)) {
        return;
      }
      closeHandleMenu();
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        closeHandleMenu();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isHandleMenuOpen, closeHandleMenu]);
  const [linkValidationError, setLinkValidationError] = useState(null);
  const [expandedNodeId, setExpandedNodeId] = useState(null);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const treeState = useTreeState(treeData);
  const {
    data,
    setData,
    loadTree,
    activeTreeId,
    setActiveTreeId,
    initializingTree,
    setInitializingTree,
    treeSyncError,
    setTreeSyncError,
    isTreeSyncing,
    setIsTreeSyncing,
  } = treeState;
  const [hoveredLinkId, setHoveredLinkId] = useState(null);
  const dataRef = useRef(data);
  const simulationRef = useRef(null);
  const treeAnimationService = useRef(new TreeAnimationService());
  const animationRef = useRef(null);
  const questionService = useRef(new QuestionService());
  const hasInitializedViewRef = useRef(false);

  // activeTreeId 변경 시 탭 목록에 추가 (초기 로드 시에만)
  const isInitialLoadRef = useRef(true);
  useEffect(() => {
    if (!activeTreeId) return;

    // 초기 로드 시에만 탭 추가
    if (isInitialLoadRef.current) {
      setSessionTabs((prev) => {
        if (prev.some(tab => tab.treeId === activeTreeId)) {
          return prev;
        }
        const newTabId = `${activeTreeId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        setActiveTabId(newTabId);
        return [...prev, {
          id: newTabId,
          treeId: activeTreeId,
          title: `트리 ${prev.length + 1}`
        }];
      });
      isInitialLoadRef.current = false;
    }
  }, [activeTreeId]);

  // 키보드 탭(→ 다음 탭), Shift+Tab(← 이전 탭)으로 탭 전환 (Ref를 통해 안전 호출)
  useEffect(() => {
    const handleKeyDown = (event) => {
      const target = event.target;
      const tag = (target?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || target?.isContentEditable) {
        return;
      }
      if (event.key !== 'Tab') return;

      const tabs = Array.isArray(sessionTabs) ? sessionTabs : [];
      if (tabs.length === 0) return;

      event.preventDefault();

      const currentIndex = Math.max(0, tabs.findIndex(t => t?.id === activeTabId));
      const delta = event.shiftKey ? -1 : 1;
      const nextIndex = (currentIndex + delta + tabs.length) % tabs.length;
      const next = tabs[nextIndex];
      if (next && next.id !== activeTabId) {
        setActiveTabId(next.id);
        loadActiveTreeRef.current?.({ treeId: next.treeId });
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [sessionTabs, activeTabId]);

  const {
    hydrateFromNodes,
    getConversation,
    setConversation: upsertConversation,
    deleteConversation,
    hasConversation,
    ensureBootstrap,
    clearBootstrap,
    clearAll: clearConversationStore,
  } = useConversationStore();
  const pendingTreeIdRef = useRef(null);
  const treeLibrarySyncRef = useRef(new Map());
  const zoomBehaviourRef = useRef(null);
  const pendingFocusNodeIdRef = useRef(null);
  const expandTimeoutRef = useRef(null);
  const linkValidationTimeoutRef = useRef(null);
  const outsidePointerRef = useRef({
    active: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    moved: false,
  });

  const sessionInfo = useMemo(() => {
    if (typeof window === 'undefined') {
      return {
        sessionId: null,
        initialTreeId: null,
        fresh: false,
      };
    }

    const currentUrl = new URL(window.location.href);
    let sessionId = currentUrl.searchParams.get('session');
    let mutated = false;
    if (!sessionId) {
      sessionId = `sess_${Date.now().toString(36)}_${Math.random().toString(16).slice(2, 8)}`;
      currentUrl.searchParams.set('session', sessionId);
      mutated = true;
    }

    const initialTreeId = currentUrl.searchParams.get('treeId');
    const freshFlag = currentUrl.searchParams.get('fresh') === '1';

    if (mutated) {
      window.history.replaceState({}, '', currentUrl.toString());
    }

    return {
      sessionId,
      initialTreeId: initialTreeId || null,
      fresh: freshFlag,
    };
  }, []);

  const sessionStorageKey = useMemo(() => (
    sessionInfo.sessionId ? `jarvis.widget.session.${sessionInfo.sessionId}.activeTreeId` : null
  ), [sessionInfo.sessionId]);

  const readSessionTreeId = useCallback(() => {
    if (!sessionStorageKey || typeof window === 'undefined') {
      return null;
    }
    try {
      const storedValue = window.sessionStorage.getItem(sessionStorageKey);
      return storedValue || null;
    } catch (error) {
      return null;
    }
  }, [sessionStorageKey]);

  const writeSessionTreeId = useCallback((treeId) => {
    if (!sessionStorageKey || typeof window === 'undefined') {
      return;
    }
    try {
      if (!treeId) {
        window.sessionStorage.removeItem(sessionStorageKey);
      } else {
        window.sessionStorage.setItem(sessionStorageKey, treeId);
      }
    } catch (error) {
      // ignore storage errors
    }
  }, [sessionStorageKey]);

  useEffect(() => {
    if (!sessionStorageKey || typeof window === 'undefined') {
      return;
    }
    if (sessionInfo.fresh) {
      try {
        window.sessionStorage.removeItem(sessionStorageKey);
      } catch (error) {
        // ignore storage errors
      }
    }
  }, [sessionInfo.fresh, sessionStorageKey]);



  useEffect(() => () => {
    if (linkValidationTimeoutRef.current) {
      const clear = typeof window !== 'undefined' ? window.clearTimeout : clearTimeout;
      clear(linkValidationTimeoutRef.current);
      linkValidationTimeoutRef.current = null;
    }
  }, []);

  const createClientGeneratedId = useCallback((prefix = 'tree') => {
    try {
      const uuid = crypto?.randomUUID?.();
      if (uuid) {
        return `${prefix}_${uuid}`;
      }
    } catch (error) {
      // ignore and fallback below
    }
    return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
  }, []);

  const { loadActiveTree, requestedTreeIdRef } = useTreeDataController({
    user,
    baseTreeData: treeData,
    loadTrees,
    loadTree,
    hydrateFromNodes,
    clearConversationStore,
    setData,
    setActiveTreeId,
    writeSessionTreeId,
    readSessionTreeId,
    setTreeSyncError,
    setInitializingTree,
    treeBridge,
    sessionInfo,
    createClientGeneratedId,
    treeLibrarySyncRef,
    saveTreeMetadata,
  });

  // loadActiveTree를 안정적으로 참조하기 위한 Ref (초기화 순서 이슈 방지)
  const loadActiveTreeRef = useRef(loadActiveTree);
  useEffect(() => {
    loadActiveTreeRef.current = loadActiveTree;
  }, [loadActiveTree]);


  const linkKeysRef = useRef(new Set());
  const hasCleanedQ2Ref = useRef(false);
  const [collapsedNodeIds, setCollapsedNodeIds] = useState(new Set());
  const contentGroupRef = useRef(null);
  const overlayContainerRef = useRef(null);
  const [overlayElement, setOverlayElement] = useState(null);
  const [isResizing, setIsResizing] = useState(false);
  const isIgnoringMouseRef = useRef(false);
  const treeSyncDebounceRef = useRef(null);
  const [showBootstrapChat, setShowBootstrapChat] = useState(false);
  const [bootstrapChatHeight, setBootstrapChatHeight] = useState(400); // 초기 400, 확장 후 600
  const [bootstrapChatTop, setBootstrapChatTop] = useState('55%'); // 초기 55%, 확장 후 조절 가능
  const [pendingAttachmentsByNode, setPendingAttachmentsByNode] = useState({});
  const [tidyPanelWidthOverride, setTidyPanelWidthOverride] = useState(null);
  const [isTidyPanelResizing, setIsTidyPanelResizing] = useState(false);
  const tidyPanelResizeStateRef = useRef({
    isDragging: false,
    pointerId: null,
    startX: 0,
    startWidth: TIDY_ASSISTANT_PANEL_MIN_WIDTH,
  });
  const tidyPanelResizeCleanupRef = useRef(null);

  useEffect(() => {
    setOverlayElement(overlayContainerRef.current);
  }, []);

  useEffect(() => () => {
    if (typeof tidyPanelResizeCleanupRef.current === 'function') {
      tidyPanelResizeCleanupRef.current();
    }
  }, []);


  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const setAttachmentsForNode = useCallback((nodeId, nextAttachments) => {
    if (!nodeId) {
      return;
    }

    setPendingAttachmentsByNode((previous) => {
      const normalized = Array.isArray(nextAttachments) ? nextAttachments : [];
      if (normalized.length === 0) {
        if (!previous[nodeId]) {
          return previous;
        }
        const { [nodeId]: _removed, ...rest } = previous;
        return rest;
      }
      return { ...previous, [nodeId]: normalized };
    });
  }, []);

  const addAttachmentForNode = useCallback((nodeId, attachment) => {
    if (!nodeId || !attachment) {
      return;
    }

    setPendingAttachmentsByNode((previous) => {
      const existing = Array.isArray(previous[nodeId]) ? previous[nodeId] : [];
      return {
        ...previous,
        [nodeId]: [...existing, attachment],
      };
    });
  }, []);

  useEffect(() => {
    setPendingAttachmentsByNode({});
  }, [activeTreeId]);

  const setWindowMousePassthrough = useCallback((shouldIgnore = true) => {
    if (isIgnoringMouseRef.current === shouldIgnore) {
      return;
    }

    try {
      const result = treeBridge.setMousePassthrough({ ignore: shouldIgnore, forward: true });
      isIgnoringMouseRef.current = shouldIgnore;
      if (result && typeof result.catch === 'function') {
        result.catch(() => {
          // 실패 시 다음 이벤트에서 재시도할 수 있도록 상태를 되돌려 둔다
          isIgnoringMouseRef.current = !shouldIgnore;
        });
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.error('마우스 패스스루 설정 실패:', error);
      }
    }
  }, [treeBridge]);





  const hierarchicalLinks = useMemo(() => (
    Array.isArray(data?.links)
      ? data.links.filter((link) => link?.relationship !== 'connection')
      : []
  ), [data?.links]);
  // tidyTreeData는 visibleGraph가 계산된 이후에 의존하도록 아래로 이동했습니다.

  // Color scheme for different levels
  const colorScheme = d3.scaleOrdinal(d3.schemeCategory10);

  // 현재 데이터에서 루트 노드 ID 계산 (부모 링크의 타겟이 아닌 노드)
  const getRootNodeId = useCallback(() => {
    const targetIds = new Set(hierarchicalLinks.map((l) => (
      typeof l.target === 'object' && l.target !== null ? l.target.id : l.target
    )));
    const rootNode = data.nodes.find((n) => !targetIds.has(n.id));
    return rootNode ? rootNode.id : null;
  }, [hierarchicalLinks, data.nodes]);

  const normalizeLinkEndpoint = useCallback((endpoint) => (
    typeof endpoint === 'object' && endpoint !== null ? endpoint.id : endpoint
  ), []);

  useTreePersistence({
    user,
    data,
    hierarchicalLinks,
    getRootNodeId,
    normalizeLinkEndpoint,
    activeTreeId,
    setActiveTreeId,
    writeSessionTreeId,
    saveTreeMetadata,
    saveTreeNodes,
    treeBridge,
    requestedTreeIdRef,
    treeLibrarySyncRef,
    setTreeSyncError,
    setIsTreeSyncing,
    isTrackingEmptyTree,
    stopTrackingEmptyTree,
    cleanupEmptyTrees,
    initializingTree,
  });

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }
    const handleFocus = () => {
      if (!user) return;
      const sessionTree = readSessionTreeId();
      const normalized = sessionTree || null;
      if (normalized !== activeTreeId) {
        loadActiveTree({ treeId: normalized || undefined });
      }
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [activeTreeId, loadActiveTree, readSessionTreeId, user]);

  // 노드 추가 함수
  const addNode = (parentId, nodeData) => {
    // 부모 ID 검증: 유효하지 않으면 루트로 대체
    const isValidParent = data.nodes.some(n => n.id === parentId);
    const resolvedParentId = isValidParent ? parentId : getRootNodeId();

    const now = Date.now();
    const newNode = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `node_${now}_${Math.random().toString(36).substr(2, 9)}`,
      keyword: nodeData.keyword,
      fullText: nodeData.fullText,
      level: getNodeLevel(resolvedParentId) + 1,
      size: nodeData.size || 10,
      createdAt: now,
      updatedAt: now,
      conversation: [],
    };

    // 새 노드를 데이터에 추가
    if (willCreateCycle(resolvedParentId, newNode.id)) {
      showLinkValidationMessage('사이클이 생기기 때문에 연결할 수 없습니다.');
      return;
    }

    const newData = {
      ...data,
      nodes: [...data.nodes, newNode],
      links: [...data.links, { source: resolvedParentId, target: newNode.id, value: 1 }]
    };

    setData(newData);
    setConversationForNode(newNode.id, []);
  };

  // 노드 레벨 계산
  const getNodeLevel = (nodeId) => {
    const node = data.nodes.find(n => n.id === nodeId);
    return node ? node.level : 0;
  };

  const extractImportantKeyword = useCallback(async (questionText) => {
    const trimmed = typeof questionText === 'string' ? questionText.trim() : '';
    const fallbackToken = trimmed.split(/\s+/).find(Boolean) || 'Q';
    const fallbackKeyword = fallbackToken.slice(0, 48);

    if (!trimmed) {
      return fallbackKeyword;
    }

    try {
      const result = await treeBridge.extractKeyword({ question: trimmed });
      const candidate = typeof result?.keyword === 'string' ? result.keyword.trim() : '';
      if (result?.success && candidate) {
        const token = candidate.split(/\s+/).find(Boolean);
        if (token) {
          return token.slice(0, 48);
        }
      }

      const fallbackCandidate = candidate || (typeof result?.answer === 'string' ? result.answer : '');
      const fallbackWord = typeof fallbackCandidate === 'string'
        ? fallbackCandidate.trim().split(/\s+/).find(Boolean)
        : null;
      if (fallbackWord) {
        return fallbackWord.slice(0, 48);
      }
    } catch (error) {
      try {
        treeBridge.log('warn', 'keyword_extraction_failed', { message: error?.message || 'unknown error' });
      } catch (loggingError) {
        if (process.env.NODE_ENV === 'development') {
          // eslint-disable-next-line no-console
          console.warn('Keyword extraction logging failed', loggingError);
        }
      }
    }

    return fallbackKeyword;
  }, [treeBridge]);

  // 2번째 질문 처리 함수 (handleRequestAnswer 정의 후로 이동)

  // 부모 -> 자식 맵 계산 (원본 데이터 기준)
  const childrenByParent = React.useMemo(() => {
    const map = new Map();
    const normalizeId = (value) => (typeof value === 'object' && value !== null ? value.id : value);
    hierarchicalLinks.forEach((l) => {
      const sourceId = normalizeId(l.source);
      const targetId = normalizeId(l.target);
      if (!map.has(sourceId)) map.set(sourceId, []);
      map.get(sourceId).push(targetId);
    });
    return map;
  }, [hierarchicalLinks]);

  const parentByChild = React.useMemo(() => {
    const map = new Map();
    const normalizeId = (value) => (typeof value === 'object' && value !== null ? value.id : value);
    hierarchicalLinks.forEach((link) => {
      const sourceId = normalizeId(link.source);
      const targetId = normalizeId(link.target);
      map.set(targetId, sourceId);
    });
    return map;
  }, [hierarchicalLinks]);

  // 접힘 토글
  const toggleCollapse = (nodeId) => {
    setCollapsedNodeIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId); else next.add(nodeId);
      return next;
    });
  };

  const showLinkValidationMessage = useCallback((message) => {
    setLinkValidationError(message);
    if (linkValidationTimeoutRef.current) {
      const clear = typeof window !== 'undefined' ? window.clearTimeout : clearTimeout;
      clear(linkValidationTimeoutRef.current);
    }
    const schedule = typeof window !== 'undefined' ? window.setTimeout : setTimeout;
    linkValidationTimeoutRef.current = schedule(() => {
      setLinkValidationError(null);
      linkValidationTimeoutRef.current = null;
    }, 2600);
  }, []);

  const willCreateCycle = useCallback((sourceId, targetId, additionalLinks = []) => {
    const normalize = (value) => (typeof value === 'object' && value !== null ? value.id : value);
    const normalizedSource = normalize(sourceId);
    const normalizedTarget = normalize(targetId);

    if (!normalizedSource || !normalizedTarget) {
      return false;
    }

    if (normalizedSource === normalizedTarget) {
      return true;
    }

    const adjacency = new Map();

    const appendEdge = (from, to) => {
      if (!from || !to) {
        return;
      }
      if (!adjacency.has(from)) {
        adjacency.set(from, new Set());
      }
      adjacency.get(from).add(to);
    };

    const baseLinks = Array.isArray(hierarchicalLinks) ? hierarchicalLinks : [];
    baseLinks.forEach((link) => {
      appendEdge(normalize(link.source), normalize(link.target));
    });

    additionalLinks.forEach((link) => {
      if (link?.relationship === 'connection') {
        return;
      }
      appendEdge(normalize(link.source), normalize(link.target));
    });

    appendEdge(normalizedSource, normalizedTarget);

    const stack = [normalizedTarget];
    const visited = new Set();

    while (stack.length > 0) {
      const current = stack.pop();
      if (current === normalizedSource) {
        return true;
      }
      if (visited.has(current)) {
        continue;
      }
      visited.add(current);
      const neighbors = adjacency.get(current);
      if (!neighbors) {
        continue;
      }
      neighbors.forEach((next) => {
        if (!visited.has(next)) {
          stack.push(next);
        }
      });
    }

    return false;
  }, [hierarchicalLinks]);

  // 접힘 상태에 따른 보이는 노드/링크 계산
  const visibleGraph = React.useMemo(() => {
    const normalizeId = (value) => (typeof value === 'object' && value !== null ? value.id : value);
    const rootId = getRootNodeId();
    if (!rootId) {
      return {
        nodes: data.nodes.slice(),
        links: hierarchicalLinks.slice(),
        visibleSet: new Set(data.nodes.map((n) => n.id)),
      };
    }

    const visible = new Set();
    const stack = [rootId];
    while (stack.length > 0) {
      const current = stack.pop();
      if (visible.has(current)) continue;
      visible.add(current);
      if (collapsedNodeIds.has(current)) continue; // 하위는 숨김
      const children = childrenByParent.get(current) || [];
      for (const child of children) stack.push(child);
    }

    const filteredNodes = data.nodes.filter((n) => visible.has(n.id));
    const filteredLinks = hierarchicalLinks.filter((l) => {
      const s = normalizeId(l.source);
      const t = normalizeId(l.target);
      return visible.has(s) && visible.has(t) && !collapsedNodeIds.has(s);
    });

    return { nodes: filteredNodes, links: filteredLinks, visibleSet: visible };
  }, [data, collapsedNodeIds, childrenByParent, hierarchicalLinks, getRootNodeId]);

  // visibleGraph 이후에 의존하여 계산되는 tidyTreeData
  const tidyTreeData = useMemo(() => {
    const normalize = (value) => (typeof value === 'object' && value !== null ? value.id : value);

    const safeNodes = Array.isArray(visibleGraph.nodes) ? visibleGraph.nodes : [];
    const safeLinks = Array.isArray(visibleGraph.links) ? visibleGraph.links : [];

    return {
      nodes: safeNodes.map((node) => ({ ...node })),
      links: safeLinks.map((link) => ({
        source: normalize(link.source),
        target: normalize(link.target),
        relationship: link.relationship || 'hierarchy',
      })),
    };
  }, [visibleGraph.nodes, visibleGraph.links]);

  const tidyAssistantNode = useMemo(() => {
    if (!expandedNodeId) {
      return null;
    }
    const safeVisibleNodes = Array.isArray(visibleGraph.nodes) ? visibleGraph.nodes : [];
    const candidateInVisible = safeVisibleNodes.find((node) => node.id === expandedNodeId);
    if (candidateInVisible) {
      return candidateInVisible;
    }
    const safeAllNodes = Array.isArray(data.nodes) ? data.nodes : [];
    return safeAllNodes.find((node) => node.id === expandedNodeId) || null;
  }, [expandedNodeId, visibleGraph.nodes, data.nodes]);

  const viewportWidth = Number.isFinite(baseDimensions?.width) ? baseDimensions.width : null;
  const clampTidyPanelWidth = useCallback((rawWidth) => {
    const safeRaw = Number.isFinite(rawWidth) ? rawWidth : TIDY_ASSISTANT_PANEL_MIN_WIDTH;
    const minWidth = TIDY_ASSISTANT_PANEL_MIN_WIDTH;
    const viewportAllowance = viewportWidth
      ? Math.max(minWidth, viewportWidth - 320)
      : TIDY_ASSISTANT_PANEL_MAX_WIDTH;
    const maxWidth = Math.max(minWidth, Math.min(TIDY_ASSISTANT_PANEL_MAX_WIDTH, viewportAllowance));
    return Math.max(minWidth, Math.min(safeRaw, maxWidth));
  }, [viewportWidth]);
  const tidyAssistantPanelVisible = Boolean(expandedNodeId) && Boolean(tidyAssistantNode);
  const tidyAssistantDefaultWidth = useMemo(() => {
    const referenceWidth = viewportWidth && viewportWidth > 0
      ? viewportWidth * TIDY_ASSISTANT_PANEL_RATIO
      : (typeof window !== 'undefined' ? window.innerWidth * TIDY_ASSISTANT_PANEL_RATIO : TIDY_ASSISTANT_PANEL_MAX_WIDTH);
    return clampTidyPanelWidth(referenceWidth);
  }, [viewportWidth, clampTidyPanelWidth]);
  const tidyAssistantPanelWidth = tidyAssistantPanelVisible
    ? clampTidyPanelWidth(tidyPanelWidthOverride ?? tidyAssistantDefaultWidth)
    : 0;
  const tidyAssistantPanelOffset = tidyAssistantPanelVisible
    ? tidyAssistantPanelWidth + TIDY_ASSISTANT_PANEL_GAP
    : 0;

  // 트리는 항상 전체 화면 사용 (채팅창은 오버레이로 표시)
  const dimensions = useMemo(() => {
    if (!baseDimensions) return baseDimensions;
    return {
      ...baseDimensions,
    };
  }, [baseDimensions]);
  const tidyAssistantAttachments = useMemo(() => {
    if (!expandedNodeId) {
      return [];
    }
    const candidate = pendingAttachmentsByNode[expandedNodeId];
    return Array.isArray(candidate) ? candidate : [];
  }, [expandedNodeId, pendingAttachmentsByNode]);
  const tidyAssistantIsRoot = tidyAssistantNode ? !parentByChild.has(tidyAssistantNode.id) : false;
  const beginTidyPanelResize = useCallback((event) => {
    if (!tidyAssistantPanelVisible) {
      return;
    }
    if (typeof tidyPanelResizeCleanupRef.current === 'function') {
      tidyPanelResizeCleanupRef.current();
    }
    event.preventDefault();
    event.stopPropagation();

    const pointerId = typeof event.pointerId === 'number' ? event.pointerId : null;
    const startX = typeof event.clientX === 'number' ? event.clientX : 0;
    tidyPanelResizeStateRef.current = {
      isDragging: true,
      pointerId,
      startX,
      startWidth: tidyAssistantPanelWidth,
    };

    setIsTidyPanelResizing(true);

    const cleanup = () => {
      tidyPanelResizeStateRef.current = {
        isDragging: false,
        pointerId: null,
        startX: 0,
        startWidth: TIDY_ASSISTANT_PANEL_MIN_WIDTH,
      };
      document.removeEventListener('pointermove', handlePointerMove, true);
      document.removeEventListener('pointerup', handlePointerUp, true);
      document.removeEventListener('pointercancel', handlePointerUp, true);
      if (typeof document !== 'undefined' && document.body) {
        document.body.style.cursor = '';
      }
      setIsTidyPanelResizing(false);
      tidyPanelResizeCleanupRef.current = null;
    };

    function handlePointerMove(moveEvent) {
      if (!tidyPanelResizeStateRef.current.isDragging) {
        cleanup();
        return;
      }
      if (pointerId !== null && moveEvent.pointerId !== pointerId) {
        return;
      }
      moveEvent.preventDefault();
      const currentX = typeof moveEvent.clientX === 'number' ? moveEvent.clientX : tidyPanelResizeStateRef.current.startX;
      const delta = tidyPanelResizeStateRef.current.startX - currentX;
      const nextWidth = clampTidyPanelWidth(tidyPanelResizeStateRef.current.startWidth + delta);
      setTidyPanelWidthOverride(nextWidth);
    }

    function handlePointerUp(upEvent) {
      if (pointerId !== null && upEvent.pointerId !== pointerId) {
        return;
      }
      upEvent.preventDefault();
      cleanup();
    }

    document.addEventListener('pointermove', handlePointerMove, true);
    document.addEventListener('pointerup', handlePointerUp, true);
    document.addEventListener('pointercancel', handlePointerUp, true);
    if (typeof document !== 'undefined' && document.body) {
      document.body.style.cursor = 'col-resize';
    }
    tidyPanelResizeCleanupRef.current = cleanup;
  }, [tidyAssistantPanelVisible, tidyAssistantPanelWidth, clampTidyPanelWidth]);

  const getInitialConversationForNode = useCallback((nodeId) => getConversation(nodeId), [getConversation]);

  const setConversationForNode = useCallback((nodeId, messages) => {
    upsertConversation(nodeId, messages);
  }, [upsertConversation]);

  useEffect(() => {
    const isEmpty = !Array.isArray(data.nodes) || data.nodes.length === 0;
    setShowBootstrapChat(isEmpty);

    if (isEmpty) {
      setSelectedNodeId(null);
      setExpandedNodeId(null);
      ensureBootstrap();
    } else {
      clearBootstrap();
    }
  }, [data.nodes, ensureBootstrap, clearBootstrap]);

  const clearPendingExpansion = useCallback(() => {
    pendingFocusNodeIdRef.current = null;
    if (expandTimeoutRef.current) {
      clearTimeout(expandTimeoutRef.current);
      expandTimeoutRef.current = null;
    }
  }, []);

  const collapseAssistantPanel = useCallback(() => {
    clearPendingExpansion();
    setExpandedNodeId(null);
  }, [clearPendingExpansion]);

  // 배경 클릭 핸들러 (채팅창 닫기)
  const handleBackgroundClick = useCallback(() => {
    // 채팅창 닫기 + 선택 해제
    collapseAssistantPanel();
    setSelectedNodeId(null);
  }, [collapseAssistantPanel]);

  const forwardPanZoomGesture = useCallback((event) => applyPanZoomGesture({
    event,
    svgElement: svgRef.current,
    zoomBehaviour: zoomBehaviourRef.current,
  }), []);

  // 부트스트랩 채팅창 위치 (화면 상단 중앙)
  // 초기 부팅 시(빈 그래프) 드래그 핸들 바로 아래에 채팅창 표시
  const handleConversationChange = (nodeId, messages) => {

    setConversationForNode(nodeId, messages);

  };

  const handleCloseNode = (nodeId) => {
    if (!nodeId) {
      collapseAssistantPanel();
      setSelectedNodeId(null);
      return;
    }
    if (expandedNodeId === nodeId) {
      collapseAssistantPanel();
    }
    setSelectedNodeId((current) => (current === nodeId ? null : current));
  };

  const buildContextMessages = useCallback((nodeId) => {
    if (!nodeId) return [];

    const chain = [];
    const guard = new Set();
    let current = nodeId;

    while (current) {
      if (guard.has(current)) break;
      guard.add(current);
      chain.unshift(current);
      current = parentByChild.get(current) || null;
    }

    const collected = [];
    chain.forEach((id) => {
      const history = getConversation(id);
      history.forEach((entry) => {
        if (!entry || typeof entry.text !== 'string') {
          return;
        }
        const text = entry.text.trim();
        if (!text) {
          return;
        }
        const role = entry.role === 'assistant' ? 'assistant' : 'user';
        collected.push({ role, content: text });
      });
    });

    const MAX_HISTORY_MESSAGES = 12;
    return collected.length > MAX_HISTORY_MESSAGES
      ? collected.slice(collected.length - MAX_HISTORY_MESSAGES)
      : collected;
  }, [parentByChild]);

  const invokeAgent = useCallback(async (channel, payload = {}) => {
    const requestPayload = {
      ...payload,
      provider: selectedProvider,
      webSearchEnabled,
    };

    if (!requestPayload.model) {
      requestPayload.model = selectedModel;
    }

    const hasPreferredTemperature = typeof preferredTemperature === 'number' && Number.isFinite(preferredTemperature);
    if ((!Number.isFinite(requestPayload.temperature)) && hasPreferredTemperature) {
      requestPayload.temperature = preferredTemperature;
    }

    const providerId = (requestPayload.provider || '').toLowerCase();
    const modelId = typeof requestPayload.model === 'string' ? requestPayload.model.toLowerCase() : '';
    if (reasoningEnabled) {
      if (providerId === 'auto' || (providerId === 'openai' && modelId.startsWith('gpt-5'))) {
        if (!requestPayload.reasoning) {
          requestPayload.reasoning = { effort: modelId.includes('high') ? 'high' : 'medium' };
        }
        requestPayload.reasoningEnabled = true;
      }
    }

    return AgentClient.request(channel, requestPayload);
  }, [preferredTemperature, reasoningEnabled, selectedModel, selectedProvider, webSearchEnabled]);

  const handleRequestAnswer = useCallback(
    async ({ node: targetNode, question, isRootNode, autoSelectionHint }) => {
      const trimmedQuestion = (question || '').trim();
      if (!trimmedQuestion) {
        throw new Error('질문이 비어있습니다.');
      }

      const nodeId = targetNode?.id;
      const historyMessages = buildContextMessages(nodeId);

      const focusKeywordSet = new Set();
      const appendFocusKeyword = (value) => {
        if (typeof value !== 'string') {
          return;
        }
        const normalized = value.trim();
        if (!normalized) {
          return;
        }
        focusKeywordSet.add(normalized);
      };

      appendFocusKeyword(targetNode?.keyword);
      if (Array.isArray(targetNode?.keywords)) {
        targetNode.keywords.forEach(appendFocusKeyword);
      }
      if (typeof targetNode?.name === 'string') {
        appendFocusKeyword(targetNode.name);
      }
      if (Array.isArray(targetNode?.aliases)) {
        targetNode.aliases.forEach(appendFocusKeyword);
      }
      if (targetNode?.placeholder) {
        const { keyword: placeholderKeyword, keywords: placeholderKeywords, sourceText } = targetNode.placeholder;
        appendFocusKeyword(placeholderKeyword);
        appendFocusKeyword(sourceText);
        if (Array.isArray(placeholderKeywords)) {
          placeholderKeywords.forEach(appendFocusKeyword);
        }
      }

      const focusKeywords = Array.from(focusKeywordSet);

      const originalQuestion = typeof targetNode?.questionData?.question === 'string'
        ? targetNode.questionData.question.trim()
        : '';

      const contextPhrases = [];
      if (focusKeywords.length === 1) {
        contextPhrases.push(`현재 노드는 "${focusKeywords[0]}"라는 용어를 설명하기 위해 생성되었습니다. 사용자가 "이 단어" 혹은 "이 표현"이라고 말하면 이 용어를 지칭합니다.`);
      } else if (focusKeywords.length > 1) {
        const keywordList = focusKeywords.map((keyword) => `"${keyword}"`).join(', ');
        contextPhrases.push(`현재 노드는 ${keywordList} 등의 용어를 설명하기 위해 생성되었습니다. 사용자가 "이 단어" 혹은 "이 표현"이라고 말하면 이들 가운데 해당 맥락의 용어를 의미합니다.`);
      }

      if (originalQuestion) {
        contextPhrases.push(`이 노드는 처음에 "${originalQuestion}"이라는 질문으로 생성되었습니다.`);
      }

      const contextNote = contextPhrases.join(' ');
      const userMessageContent = contextNote
        ? `${contextNote}\n\n질문: ${trimmedQuestion}`
        : trimmedQuestion;

      const messages = [
        ...historyMessages,
        { role: 'user', content: userMessageContent },
      ];

      const payload = {
        question: trimmedQuestion,
        messages,
        nodeId,
        isRootNode,
      };

      if (focusKeywords.length > 0) {
        payload.focusKeywords = focusKeywords;
      }

      if (contextNote) {
        payload.questionContext = contextNote;
      }

      const response = await invokeAgent(isRootNode ? 'askRoot' : 'askChild', {
        ...payload,
        autoSelectionHint,
      });

      return response;
    },
    [buildContextMessages, invokeAgent],
  );

  const handleBootstrapSubmit = useCallback(async (text, attachments = []) => {
    const trimmed = typeof text === 'string' ? text.trim() : '';
    if (!trimmed && (!Array.isArray(attachments) || attachments.length === 0)) {
      return;
    }

    const timestamp = Date.now();

    // 윈도우를 부드럽게 확장 (600x480 → 1024x720)
    if (typeof window !== 'undefined' && window.jarvisAPI?.windowControls?.resize) {
      window.jarvisAPI.windowControls.resize(1024, 720, true)
        .then(result => {
          console.log('✅ Window resized:', result);
          // 채팅창 높이 & 위치 변경
          setBootstrapChatHeight(645);  // 400 → 600
          setBootstrapChatTop('54%');   // 55% → 50% (더 위로)
        })
        .catch(err => console.error('❌ Window resize failed:', err));
    }

    setConversationForNode('__bootstrap__', [
      {
        id: `${timestamp}-user`,
        role: 'user',
        text: trimmed,
        attachments: Array.isArray(attachments) && attachments.length ? attachments : undefined,
        timestamp,
      },
      { id: `${timestamp}-assistant`, role: 'assistant', text: '', status: 'pending', timestamp: Date.now() },
    ]);

    try {
      const response = await handleRequestAnswer({
        node: { id: '__bootstrap__' },
        question: trimmed,
        isRootNode: true,
      });

      const rootId = createClientGeneratedId('root');
      const answer = typeof response?.answer === 'string' ? response.answer.trim() : '';
      const keyword = await extractImportantKeyword(trimmed);

      const rawConversation = [
        {
          id: `${timestamp}-user`,
          role: 'user',
          text: trimmed,
          attachments: Array.isArray(attachments) && attachments.length ? attachments : undefined,
          timestamp,
        },
        { id: `${timestamp}-assistant`, role: 'assistant', text: answer, status: 'complete', metadata: response, timestamp },
      ];

      const sanitizedConversation = sanitizeConversationMessages(rawConversation);

      const rootNode = {
        id: rootId,
        keyword: keyword || trimmed,
        fullText: answer || trimmed,
        level: 0,
        size: 20,
        status: 'answered',
        question: trimmed,
        answer,
        createdAt: timestamp,
        updatedAt: timestamp,
        conversation: sanitizedConversation,
      };

      setData(() => {
        const nextState = { nodes: [rootNode], links: [] };
        dataRef.current = nextState;
        return nextState;
      });

      setConversationForNode(rootId, sanitizedConversation);
      clearBootstrap();

      questionService.current.setQuestionCount(rootId, 1);
      setExpandedNodeId(rootId);
      setSelectedNodeId(rootId);
      setShowBootstrapChat(false);
    } catch (error) {
      setConversationForNode('__bootstrap__', [
        { id: `${timestamp}-user`, role: 'user', text: trimmed, timestamp },
        { id: `${timestamp}-assistant`, role: 'assistant', text: '⚠️ 루트 노드 생성 중 오류가 발생했습니다.', status: 'error', timestamp: Date.now() },
      ]);

      if (process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.error('bootstrap_submit_failed', error);
      }
    }
  }, [createClientGeneratedId, extractImportantKeyword, handleRequestAnswer, setConversationForNode, setShowBootstrapChat]);

  // 2번째 질문 처리 함수
  const handleSecondQuestion = useCallback(async (parentNodeId, question, answerFromLLM, metadata = {}) => {
    const trimmedQuestion = typeof question === 'string' ? question.trim() : '';
    const latestData = dataRef.current;
    const parentNode = latestData.nodes.find((n) => n.id === parentNodeId);
    if (!parentNode) {
      return;
    }

    const keyword = await extractImportantKeyword(trimmedQuestion || question);

    // 새 노드 생성 (빈 답변으로 시작)
    const newNodeData = questionService.current.createSecondQuestionNode(
      parentNodeId,
      trimmedQuestion || question,
      '', // 빈 답변으로 시작
      latestData.nodes,
      { keyword }
    );

    if (willCreateCycle(parentNodeId, newNodeData.id)) {
      showLinkValidationMessage('사이클이 생기기 때문에 연결할 수 없습니다.');
      return;
    }

    const timestamp = Date.now();
    const initialConversation = [
      { id: `${timestamp}-user`, role: 'user', text: trimmedQuestion || question },
      { id: `${timestamp}-assistant`, role: 'assistant', text: '', status: 'pending' }
    ];

    setConversationForNode(newNodeData.id, initialConversation);

    setData((prev) => ({
      ...prev,
      nodes: [...prev.nodes, newNodeData],
      links: [...prev.links, { source: parentNodeId, target: newNodeData.id, value: 1 }]
    }));

    questionService.current.setQuestionCount(parentNodeId, 1);

    // 즉시 새 노드 열기
    setExpandedNodeId(newNodeData.id);
    setSelectedNodeId(newNodeData.id);

    // 새 노드에서 AI 답변 요청
    try {
      const result = await handleRequestAnswer({
        node: newNodeData,
        question: trimmedQuestion,
        isRootNode: false, // 자식 노드이므로 false
      });

      const answerText = result?.answer ?? '';
      const answerMetadata = result || {};

      // AI 답변으로 대화 업데이트
      const updatedConversation = [
        { id: `${timestamp}-user`, role: 'user', text: trimmedQuestion || question },
        { id: `${timestamp}-assistant`, role: 'assistant', text: answerText, status: 'complete', metadata: answerMetadata }
      ];

      setConversationForNode(newNodeData.id, updatedConversation);
    } catch (error) {
      console.error('AI 답변 요청 실패:', error);
      // AI 답변 실패 시 fallback 답변 사용
      const fallbackAnswer = `${parentNode.keyword || parentNode.id} 관련 질문 "${trimmedQuestion}"에 대한 답변입니다. 이는 ${parentNode.fullText || '관련된 내용'}과 연관되어 있습니다.`;

      const fallbackConversation = [
        { id: `${timestamp}-user`, role: 'user', text: trimmedQuestion || question },
        { id: `${timestamp}-assistant`, role: 'assistant', text: fallbackAnswer, status: 'complete' }
      ];

      setConversationForNode(newNodeData.id, fallbackConversation);
    }

    setTimeout(() => {
      const input = document.querySelector('textarea[placeholder="Ask anything..."]');
      if (input) {
        input.focus();
      }
    }, 50);
  }, [extractImportantKeyword, handleRequestAnswer, showLinkValidationMessage, willCreateCycle]);

  const handlePlaceholderCreate = (parentNodeId, keywords) => {
    if (!Array.isArray(keywords) || keywords.length === 0) return;
    const parentExists = data.nodes.some((node) => node.id === parentNodeId);
    if (!parentExists) return;

    const parentLevel = getNodeLevel(parentNodeId);
    const timestamp = Date.now();

    const placeholderNodes = keywords.map((keyword, index) => {
      const id = `placeholder_${timestamp}_${index}_${Math.random().toString(36).slice(2, 8)}`;
      const label = keyword && keyword.trim().length > 0 ? keyword.trim() : `Placeholder ${index + 1}`;
      return {
        id,
        keyword: label,
        fullText: '',
        level: parentLevel + 1,
        size: 12,
        status: 'placeholder',
        conversation: [],
        placeholder: {
          parentNodeId,
          createdAt: timestamp,
          sourceText: label,
        },
      };
    });

    const placeholderLinks = placeholderNodes.map((node) => ({
      source: parentNodeId,
      target: node.id,
      value: 1,
    }));

    if (placeholderLinks.some((link) => willCreateCycle(link.source, link.target))) {
      showLinkValidationMessage('사이클이 생기기 때문에 연결할 수 없습니다.');
      return;
    }

    const newData = {
      ...data,
      nodes: [...data.nodes, ...placeholderNodes],
      links: [...data.links, ...placeholderLinks],
    };

    setData(newData);
    placeholderNodes.forEach((node) => {
      setConversationForNode(node.id, []);
    });

    setSelectedNodeId(parentNodeId);
    setExpandedNodeId(parentNodeId);
  };

  const handleAnswerComplete = useCallback(async (nodeId, payload = {}) => {
    if (!nodeId) return;

    const question = typeof payload.question === 'string' ? payload.question.trim() : '';
    const answer = typeof payload.answer === 'string' ? payload.answer.trim() : '';
    const nodeSnapshot = dataRef.current.nodes.find((n) => n.id === nodeId);

    if (!nodeSnapshot) {
      return;
    }

    const resolvedAnswer = answer || nodeSnapshot.answer || '';
    const fallbackToken = question ? question.split(/\s+/).find(Boolean) : '';

    const isPlaceholderNode = nodeSnapshot.status === 'placeholder';
    const rawSourceText = typeof nodeSnapshot.placeholder?.sourceText === 'string'
      ? nodeSnapshot.placeholder.sourceText.trim()
      : '';
    const shouldPreserveKeyword = isPlaceholderNode
      && rawSourceText.length > 0
      && !/^Placeholder\s+\d+$/i.test(rawSourceText);

    let resolvedKeyword = nodeSnapshot.keyword || '';
    if (isPlaceholderNode && question && !shouldPreserveKeyword) {
      const keywordOverride = await extractImportantKeyword(question);
      resolvedKeyword = keywordOverride || fallbackToken || resolvedKeyword;
    }

    setData((prev) => {
      const nextNodes = prev.nodes.map((node) => {
        if (node.id !== nodeId) {
          return node;
        }

        return {
          ...node,
          keyword: (resolvedKeyword || node.keyword || '').slice(0, 48),
          fullText: resolvedAnswer || node.fullText || '',
          question: question || node.question || '',
          answer: resolvedAnswer || node.answer || '',
          status: 'answered',
          updatedAt: Date.now(),
        };
      });

      return {
        ...prev,
        nodes: nextNodes,
      };
    });
  }, [extractImportantKeyword]);

  const handleAnswerError = useCallback((nodeId, payload = {}) => {
    if (!nodeId) return;
    const message = payload?.error?.message || 'answer request failed';
    treeBridge.log('warn', 'agent_answer_error', { nodeId, message });
  }, [treeBridge]);

  // 노드 및 하위 노드 제거 함수
  const removeNodeAndDescendants = (nodeId) => {
    if (!nodeId) return;

    const normalizeId = (value) => (typeof value === 'object' && value !== null ? value.id : value);

    const toRemove = new Set();
    const stack = [nodeId];

    while (stack.length > 0) {
      const current = stack.pop();
      if (toRemove.has(current)) continue;
      toRemove.add(current);

      // 현재 노드의 자식 노드들을 스택에 추가
      hierarchicalLinks.forEach((link) => {
        const sourceId = normalizeId(link.source);
        const targetId = normalizeId(link.target);
        if (sourceId === current) {
          stack.push(targetId);
        }
      });
    }

    const newNodes = data.nodes.filter((n) => !toRemove.has(n.id));
    const newLinks = data.links.filter((l) => {
      const sourceId = normalizeId(l.source);
      const targetId = normalizeId(l.target);
      return !toRemove.has(sourceId) && !toRemove.has(targetId);
    });

    setData({ ...data, nodes: newNodes, links: newLinks });

    // 대화 상태 정리
    toRemove.forEach((id) => {
      deleteConversation(id);
    });

    // 선택/확장 상태 초기화
    if (selectedNodeId && toRemove.has(selectedNodeId)) {
      setSelectedNodeId(null);
    }
    if (expandedNodeId && toRemove.has(expandedNodeId)) {
      collapseAssistantPanel();
    }
  };

  const handleMemoCreate = useCallback((parentNodeId) => {
    const parentExists = dataRef.current?.nodes?.some((node) => node.id === parentNodeId);
    if (!parentExists) {
      return null;
    }

    const timestamp = Date.now();
    const memoId = createClientGeneratedId('memo');
    const parentNode = dataRef.current?.nodes?.find((node) => node.id === parentNodeId);
    const defaultTitle = parentNode?.keyword
      ? `${parentNode.keyword} 메모`
      : '새 메모';

    setData((prev) => ({
      ...prev,
      nodes: [
        ...prev.nodes,
        {
          id: memoId,
          nodeType: 'memo',
          memoParentId: parentNodeId,
          parentId: parentNodeId,
          keyword: defaultTitle,
          fullText: '',
          memo: {
            title: defaultTitle,
            content: '',
          },
          createdAt: timestamp,
          updatedAt: timestamp,
          conversation: [],
        },
      ],
      links: [
        ...prev.links,
        {
          source: parentNodeId,
          target: memoId,
          value: 0.6,
          relationship: 'memo',
        },
      ],
    }));

    return memoId;
  }, [createClientGeneratedId]);

  const handleMemoUpdate = useCallback((memoId, updates = {}) => {
    if (!memoId) {
      return;
    }

    setData((prev) => {
      let hasChanged = false;

      const nextNodes = prev.nodes.map((node) => {
        if (node.id !== memoId) {
          return node;
        }

        const currentMemo = node.memo || { title: '', content: '' };
        const nextTitle = typeof updates.title === 'string' ? updates.title : currentMemo.title;
        const nextContent = typeof updates.content === 'string' ? updates.content : currentMemo.content;

        if (nextTitle === currentMemo.title && nextContent === currentMemo.content) {
          return node;
        }

        hasChanged = true;

        return {
          ...node,
          memo: {
            title: nextTitle,
            content: nextContent,
          },
          keyword: node.nodeType === 'memo'
            ? (nextTitle || node.keyword || '').slice(0, 48)
            : node.keyword,
          fullText: node.nodeType === 'memo'
            ? (nextContent || '')
            : node.fullText,
          updatedAt: Date.now(),
        };
      });

      if (!hasChanged) {
        return prev;
      }

      return {
        ...prev,
        nodes: nextNodes,
      };
    });
  }, []);

  const requestUserInput = useCallback((message, defaultValue = '') => {
    if (typeof window === 'undefined' || typeof window.prompt !== 'function') {
      return { status: 'unavailable', value: null };
    }

    try {
      const result = window.prompt(message, defaultValue ?? '');
      if (result === null) {
        return { status: 'cancelled', value: null };
      }
      return { status: 'ok', value: result };
    } catch (error) {
      return { status: 'unavailable', value: null };
    }
  }, []);

  const handleNodeUpdate = useCallback(async (nodeId, updates = {}) => {
    try {
      const latestData = dataRef.current;
      if (!latestData || !Array.isArray(latestData.nodes)) {
        return;
      }

      const nodeIndex = latestData.nodes.findIndex(node => node.id === nodeId);
      if (nodeIndex === -1) {
        return;
      }

      // 노드 데이터 업데이트
      const updatedNodes = [...latestData.nodes];
      updatedNodes[nodeIndex] = {
        ...updatedNodes[nodeIndex],
        ...updates,
      };

      // 상태 업데이트
      setData(prev => ({
        ...prev,
        nodes: updatedNodes,
      }));

      // Supabase에 저장 (sizeScale 등 노드 속성 업데이트)
      if (activeTreeId && user?.id) {
        await saveTreeNodes({
          treeId: activeTreeId,
          nodes: updatedNodes,
        });
      }
    } catch (error) {
      console.error('노드 업데이트 실패:', error);
    }
  }, [activeTreeId, saveTreeNodes, user?.id]);

  const handleManualNodeCreate = useCallback((parentNodeId) => {
    const latestData = dataRef.current;
    if (!latestData || !Array.isArray(latestData.nodes) || latestData.nodes.length === 0) {
      return null;
    }

    const parentExists = latestData.nodes.some((node) => node.id === parentNodeId);
    const resolvedParentId = parentExists ? parentNodeId : getRootNodeId();

    if (!resolvedParentId) {
      showLinkValidationMessage('부모 노드를 찾을 수 없습니다.');
      return null;
    }

    const parentNode = latestData.nodes.find((node) => node.id === resolvedParentId);

    const defaultKeywordBase = parentNode?.keyword || parentNode?.id || '새 노드';
    const defaultKeyword = `${defaultKeywordBase}`;

    const keywordRequest = requestUserInput('추가할 노드의 제목을 입력하세요.', defaultKeyword);
    if (keywordRequest.status === 'cancelled') {
      return null;
    }

    const keyword = (keywordRequest.status === 'ok' ? keywordRequest.value : defaultKeyword).trim() || defaultKeyword;

    const descriptionRequest = requestUserInput('노드 설명을 입력하세요. (선택 사항)', '');
    if (descriptionRequest.status === 'cancelled') {
      return null;
    }
    const fullText = descriptionRequest.status === 'ok' ? (descriptionRequest.value || '').trim() : '';

    const level = (parentNode?.level ?? 0) + 1;
    const now = Date.now();
    const newNodeId = createClientGeneratedId('node');

    if (willCreateCycle(resolvedParentId, newNodeId)) {
      showLinkValidationMessage('사이클이 생기기 때문에 연결할 수 없습니다.');
      return null;
    }

    const nextNode = {
      id: newNodeId,
      keyword,
      fullText,
      level,
      size: typeof parentNode?.size === 'number' ? parentNode.size : 12,
      status: 'answered',
      conversation: [],
      createdAt: now,
      updatedAt: now,
    };

    setConversationForNode(newNodeId, []);

    setData((prev) => {
      const next = {
        ...prev,
        nodes: [...prev.nodes, nextNode],
        links: [...prev.links, { source: resolvedParentId, target: newNodeId, value: 1 }],
      };
      dataRef.current = next;
      return next;
    });

    return newNodeId;
  }, [createClientGeneratedId, getRootNodeId, requestUserInput, setConversationForNode, showLinkValidationMessage, willCreateCycle]);

  const handleManualRootCreate = useCallback((options = {}) => {
    const now = Date.now();
    const newNodeId = createClientGeneratedId('root');
    const position = options?.position || { x: 0, y: 0 };

    const existingRootCount = Array.isArray(dataRef.current?.nodes)
      ? dataRef.current.nodes.filter((node) => node?.level === 0).length
      : 0;

    const defaultKeyword = existingRootCount > 0
      ? `새 루트 노드 ${existingRootCount + 1}`
      : '새 루트 노드';

    const newNode = {
      id: newNodeId,
      keyword: options?.keyword || defaultKeyword,
      fullText: options?.fullText || '',
      level: 0,
      size: 20,
      status: 'answered',
      conversation: [],
      createdAt: now,
      updatedAt: now,
      x: Number.isFinite(position.x) ? position.x : 0,
      y: Number.isFinite(position.y) ? position.y : 0,
    };

    setConversationForNode(newNodeId, []);

    setData((prev) => {
      const nextState = (!prev || !Array.isArray(prev.nodes) || prev.nodes.length === 0)
        ? { nodes: [newNode], links: [] }
        : {
          ...prev,
          nodes: [...prev.nodes, newNode],
          links: Array.isArray(prev.links) ? prev.links.slice() : [],
        };

      dataRef.current = nextState;
      return nextState;
    });

    setSelectedNodeId(newNodeId);
    setExpandedNodeId(null);
    setShowBootstrapChat(false);
    return newNodeId;
  }, [createClientGeneratedId, setConversationForNode]);

  const handleManualLinkCreate = useCallback((sourceNodeId, targetNodeId) => {
    if (!sourceNodeId || !targetNodeId) {
      return null;
    }

    const latestData = dataRef.current;
    const normalize = (value) => (typeof value === 'object' && value !== null ? value.id : value);

    const availableNodes = latestData?.nodes || [];
    if (!availableNodes.length) {
      showLinkValidationMessage('연결할 노드를 찾을 수 없습니다.');
      return null;
    }

    if (!availableNodes.some((node) => node.id === sourceNodeId)) {
      showLinkValidationMessage('선택한 노드를 찾을 수 없습니다.');
      return null;
    }

    const targetNode = availableNodes.find((node) => node.id === targetNodeId);
    if (!targetNode) {
      showLinkValidationMessage('대상 노드를 찾지 못했습니다.');
      return null;
    }

    if (targetNodeId === sourceNodeId) {
      showLinkValidationMessage('같은 노드를 연결할 수 없습니다.');
      return null;
    }

    const existingConnection = (latestData?.links || []).some((link) => {
      if (link?.relationship !== 'connection') {
        return false;
      }
      const source = normalize(link.source);
      const target = normalize(link.target);
      const isSameDirection = source === sourceNodeId && target === targetNodeId;
      const isReverse = source === targetNodeId && target === sourceNodeId;
      return isSameDirection || isReverse;
    });

    if (existingConnection) {
      showLinkValidationMessage('이미 연결된 노드입니다.');
      return null;
    }

    setData((prev) => {
      const next = {
        ...prev,
        links: [
          ...(Array.isArray(prev.links) ? prev.links : []),
          {
            source: sourceNodeId,
            target: targetNodeId,
            value: 1,
            relationship: 'connection',
          },
        ],
      };
      dataRef.current = next;
      return next;
    });

    return { sourceId: sourceNodeId, targetId: targetNodeId };
  }, [showLinkValidationMessage]);

  // 노드 클릭 핸들러
  const handleNodeClick = (nodeId) => {
    setSelectedNodeId(nodeId);
  };

  useEffect(() => {
    data.nodes.forEach((node) => {
      if (!hasConversation(node.id)) {
        setConversationForNode(node.id, []);
      }
    });
  }, [data.nodes]);


  // 과거 생성된 Q2 노드들(및 하위 노드) 정리 - 최초 1회만 수행
  useEffect(() => {
    if (hasCleanedQ2Ref.current) return;

    const normalizeId = (value) => (typeof value === 'object' && value !== null ? value.id : value);
    const isQ2Node = (node) => {
      const hasQ2Keyword = typeof node.keyword === 'string' && /^\s*Q2\s*:/.test(node.keyword);
      const hasQ2Flag = node.questionData && Number(node.questionData.questionNumber) === 2;
      return hasQ2Keyword || hasQ2Flag;
    };

    const q2Roots = data.nodes.filter(isQ2Node);
    if (q2Roots.length === 0) {
      hasCleanedQ2Ref.current = true;
      return;
    }

    const toRemove = new Set(q2Roots.map((n) => n.id));
    const stack = q2Roots.map((n) => n.id);

    while (stack.length > 0) {
      const current = stack.pop();
      hierarchicalLinks.forEach((link) => {
        const sourceId = normalizeId(link.source);
        const targetId = normalizeId(link.target);
        if (sourceId === current && !toRemove.has(targetId)) {
          toRemove.add(targetId);
          stack.push(targetId);
        }
      });
    }

    if (toRemove.size === 0) {
      hasCleanedQ2Ref.current = true;
      return;
    }

    const newNodes = data.nodes.filter((n) => !toRemove.has(n.id));
    const newLinks = data.links.filter((l) => {
      const sourceId = normalizeId(l.source);
      const targetId = normalizeId(l.target);
      return !toRemove.has(sourceId) && !toRemove.has(targetId);
    });

    setData({ ...data, nodes: newNodes, links: newLinks });
    toRemove.forEach((id) => deleteConversation(id));
    if (selectedNodeId && toRemove.has(selectedNodeId)) setSelectedNodeId(null);
    if (expandedNodeId && toRemove.has(expandedNodeId)) collapseAssistantPanel();

    hasCleanedQ2Ref.current = true;
  }, [data, selectedNodeId, expandedNodeId, hierarchicalLinks]);

  useEffect(() => {
    // 기존 애니메이션 정리
    if (animationRef.current) {
      animationRef.current.stop();
    }

    // Tree layout과 애니메이션을 사용하여 노드 위치 계산
    const animation = treeAnimationService.current.calculateTreeLayoutWithAnimation(
      nodes, // 현재 노드 위치
      visibleGraph.nodes,
      visibleGraph.links,
      dimensions,
      (animatedNodes, animatedLinks) => {
        setNodes(animatedNodes);
        const { annotatedLinks, nextKeys } = markNewLinks(linkKeysRef.current, animatedLinks);
        linkKeysRef.current = nextKeys;
        setLinks(annotatedLinks);

        // 초기 로딩 시 전체 트리가 화면에 보이도록 설정 (TidyTreeView는 자체 computeDefaultTransform 사용)
        if (!isTidyView && !hasInitializedViewRef.current && animatedNodes.length > 0) {
          hasInitializedViewRef.current = true;

          // 약간의 지연을 두어 레이아웃 계산이 완료된 후 전체 트리 fit
          setTimeout(() => {
            const svgElement = svgRef.current;
            const zoom = zoomBehaviourRef.current;

            if (!svgElement || !zoom) return;

            // 전체 노드의 경계 계산
            let minX = Infinity;
            let maxX = -Infinity;
            let minY = Infinity;
            let maxY = -Infinity;

            animatedNodes.forEach(node => {
              if (Number.isFinite(node.x) && Number.isFinite(node.y)) {
                minX = Math.min(minX, node.x);
                maxX = Math.max(maxX, node.x);
                minY = Math.min(minY, node.y);
                maxY = Math.max(maxY, node.y);
              }
            });

            if (!Number.isFinite(minX) || !Number.isFinite(maxX)) return;

            // 여백 추가
            const padding = 80;
            const contentWidth = maxX - minX + padding * 2;
            const contentHeight = maxY - minY + padding * 2;
            const contentCenterX = (minX + maxX) / 2;
            const contentCenterY = (minY + maxY) / 2;

            // 화면에 맞는 scale 계산
            const viewportWidth = dimensions?.width || 800;
            const viewportHeight = dimensions?.height || 600;
            const scaleX = viewportWidth / contentWidth;
            const scaleY = viewportHeight / contentHeight;
            const scale = Math.min(scaleX, scaleY, 4); // max zoom
            const finalScale = Math.max(scale, 0.3); // min zoom

            // 중앙 정렬을 위한 translate 계산
            const translateX = viewportWidth / 2 - contentCenterX * finalScale;
            const translateY = viewportHeight / 2 - contentCenterY * finalScale;

            const initialTransform = d3.zoomIdentity
              .translate(translateX, translateY)
              .scale(finalScale);

            const selection = d3.select(svgElement);
            selection
              .transition()
              .duration(0)
              .call(zoom.transform, initialTransform);

            setViewTransform(initialTransform);
          }, 100);
        }
      },
      { orientation: 'vertical' }
    );

    animationRef.current = animation;

    // 기존 force simulation 정리
    if (simulationRef.current) {
      simulationRef.current.stop();
    }

    return () => {
      if (animationRef.current) {
        animationRef.current.stop();
      }
    };
  }, [dimensions, data, visibleGraph.nodes, visibleGraph.links, isTidyView, hierarchicalLinks, viewTransform, setViewTransform]);

  const focusNodeToCenter = useCallback((node, options = {}) => {
    // 기본 duration을 600ms로 설정 (부드러운 애니메이션)
    const defaultDuration = 600;
    return focusNodeToCenterUtil({
      node,
      svgElement: svgRef.current,
      zoomBehaviour: zoomBehaviourRef.current,
      dimensions,
      viewTransform,
      setViewTransform,
      duration: options.duration !== undefined ? options.duration : defaultDuration,
      scale: options.scale,
    });
  }, [dimensions, viewTransform, setViewTransform]);

  // Handle node click for assistant focus
  const handleNodeClickForAssistant = useCallback((payload) => {
    if (!payload) {
      return;
    }

    if (payload.type === 'dismiss') {
      collapseAssistantPanel();
      return;
    }

    const targetId = payload.id;

    // 싱글 클릭인 경우 (suppressPanelOpen === true) 선택 상태만 업데이트하고 패널은 열지 않음
    if (payload.suppressPanelOpen) {
      // targetId가 null이면 선택 해제
      setSelectedNodeId(targetId || null);
      return;
    }

    if (!targetId) {
      return;
    }

    const layoutNode = nodes.find((candidate) => candidate.id === targetId) || payload;
    const hasLayoutCoordinates = Number.isFinite(layoutNode?.x) && Number.isFinite(layoutNode?.y);
    const hasPayloadPosition = Number.isFinite(payload?.position?.x) && Number.isFinite(payload?.position?.y);
    const focusTarget = hasLayoutCoordinates
      ? layoutNode
      : (hasPayloadPosition ? { ...payload, x: payload.position.x, y: payload.position.y } : null);

    pendingFocusNodeIdRef.current = targetId;
    setSelectedNodeId(targetId);

    setExpandedNodeId((current) => {
      // 이미 패널이 열려있으면 즉시 새 노드로 교체
      if (current) {
        return targetId;
      }
      return current;
    });

    const focusPromise = focusTarget
      ? Promise.resolve(focusNodeToCenter(focusTarget, { duration: 600 }))
      : Promise.resolve();

    focusPromise
      .catch(() => undefined)
      .then(() => {
        if (pendingFocusNodeIdRef.current !== targetId) {
          return;
        }

        if (expandTimeoutRef.current) {
          clearTimeout(expandTimeoutRef.current);
          expandTimeoutRef.current = null;
        }

        if (typeof window === 'undefined') {
          setExpandedNodeId(targetId);
          pendingFocusNodeIdRef.current = null;
          return;
        }

        expandTimeoutRef.current = window.setTimeout(() => {
          if (pendingFocusNodeIdRef.current === targetId) {
            setExpandedNodeId(targetId);
          }
          expandTimeoutRef.current = null;
          if (pendingFocusNodeIdRef.current === targetId) {
            pendingFocusNodeIdRef.current = null;
          }
        }, 140);
      });
  }, [nodes, focusNodeToCenter]);

  // Drag behavior - 애니메이션 중에도 드래그 가능

  const getDragHandler = useCallback((nodeId) => createNodeDragHandler({
    nodeId,
    nodes,
    setNodes,
    animationRef,
    svgRef,
    contentGroupRef,
  }), [nodes, setNodes]);

  useEffect(() => {
    applyNodeDragHandlers({
      svgElement: svgRef.current,
      nodes,
      expandedNodeId,
      getHandler: getDragHandler,
    });
  }, [nodes, expandedNodeId, getDragHandler]);

  useEffect(() => {
    if (!expandedNodeId) return;
    raiseNodeLayer({ svgElement: svgRef.current, nodeId: expandedNodeId });
  }, [expandedNodeId, nodes]);

  useEffect(() => {
    if (!expandedNodeId) {
      outsidePointerRef.current = {
        active: false,
        pointerId: null,
        startX: 0,
        startY: 0,
        moved: false,
      };
      return undefined;
    }

    if (typeof document === 'undefined') {
      return undefined;
    }

    const pointerState = outsidePointerRef.current;

    const resetState = () => {
      pointerState.active = false;
      pointerState.pointerId = null;
      pointerState.startX = 0;
      pointerState.startY = 0;
      pointerState.moved = false;
    };

    const handlePointerDown = (event) => {
      const target = event.target;
      if (target instanceof Element && target.closest('[data-interactive-zone="true"]')) {
        resetState();
        return;
      }
      if (target instanceof Element && target.closest('[data-node-id]')) {
        resetState();
        return;
      }

      pointerState.active = true;
      pointerState.pointerId = typeof event.pointerId === 'number' ? event.pointerId : null;
      pointerState.startX = typeof event.clientX === 'number' ? event.clientX : 0;
      pointerState.startY = typeof event.clientY === 'number' ? event.clientY : 0;
      pointerState.moved = false;
    };

    const handlePointerMove = (event) => {
      if (!pointerState.active) return;
      if (pointerState.pointerId !== null && event.pointerId !== pointerState.pointerId) return;

      const deltaX = Math.abs((typeof event.clientX === 'number' ? event.clientX : 0) - pointerState.startX);
      const deltaY = Math.abs((typeof event.clientY === 'number' ? event.clientY : 0) - pointerState.startY);
      if (deltaX > 6 || deltaY > 6) {
        pointerState.moved = true;
      }
    };

    const finalizePointer = (event) => {
      if (!pointerState.active) return;
      if (pointerState.pointerId !== null && event.pointerId !== pointerState.pointerId) {
        resetState();
        return;
      }

      const shouldClose = pointerState.moved === false;
      resetState();

      if (shouldClose) {
        collapseAssistantPanel();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('pointermove', handlePointerMove, true);
    document.addEventListener('pointerup', finalizePointer, true);
    document.addEventListener('pointercancel', finalizePointer, true);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('pointermove', handlePointerMove, true);
      document.removeEventListener('pointerup', finalizePointer, true);
      document.removeEventListener('pointercancel', finalizePointer, true);
      resetState();
    };
  }, [expandedNodeId, collapseAssistantPanel]);

  // ESC 키로 트리1 채팅창 닫기
  useEffect(() => {
    if (!isTidyView || !expandedNodeId) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        collapseAssistantPanel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isTidyView, expandedNodeId, collapseAssistantPanel]);

  // 컴포넌트 언마운트 시 애니메이션 정리
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        animationRef.current.stop();
      }
      treeAnimationService.current.cleanup();
      clearPendingExpansion();
      outsidePointerRef.current = {
        active: false,
        pointerId: null,
        startX: 0,
        startY: 0,
        moved: false,
      };
    };
  }, [clearPendingExpansion]);

  return (
    <div
      className="relative flex overflow-hidden bg-transparent rounded-xl"
      style={{
        // 투명 창에서 이전 프레임 잔상 방지: 독립 합성 레이어 확보
        willChange: 'transform, opacity, background',
        transform: 'translateZ(0)',
        WebkitTransform: 'translateZ(0)',
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
        pointerEvents: 'auto',
        background: treeBackground,
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        // 창틀 여유 공간까지 완전히 채우기
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        margin: 0,
        padding: 0,
      }}
    >
      {initializingTree && (
        <div className="absolute inset-0 z-[1200] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 text-slate-200">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-500 border-t-transparent" />
            <p className="text-sm">트리를 불러오는 중입니다...</p>
          </div>
        </div>
      )}
      {treeSyncError ? (
        <div className="absolute bottom-6 left-1/2 z-[1200] w-[320px] -translate-x-1/2 rounded-lg border border-red-400/60 bg-red-900/60 px-4 py-3 text-xs text-red-100 shadow-lg">
          <p className="font-medium">동기화 오류</p>
          <p className="opacity-80">{treeSyncError.message || 'Supabase와 동기화할 수 없습니다.'}</p>
        </div>
      ) : null}
      {linkValidationError ? (
        <div className="pointer-events-none absolute top-4 right-6 z-[1300]">
          <div className="pointer-events-auto rounded-lg border border-red-400/60 bg-red-900/80 px-3 py-2 text-xs font-medium text-red-100 shadow-lg">
            {linkValidationError}
          </div>
        </div>
      ) : null}
      {tidyAssistantPanelVisible && tidyAssistantNode && (
        <div className="absolute inset-y-0 right-0 z-[1200] flex"
          style={{ width: tidyAssistantPanelWidth, overflow: 'visible' }}
          data-interactive-zone="true"
        >
          <div className="pointer-events-auto relative flex h-full w-full">
            <div
              role="separator"
              aria-orientation="vertical"
              onPointerDown={beginTidyPanelResize}
              className={`absolute inset-y-0 left-0 w-3 cursor-col-resize select-none transition ${isTidyPanelResizing ? 'bg-white/15' : 'bg-transparent hover:bg-white/10'}`}
              style={{ touchAction: 'none', transform: 'translateX(-50%)' }}
            >
              <div className="pointer-events-none absolute left-1/2 top-1/2 h-16 w-[2px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/70" />
              <span className="sr-only">Resize assistant panel</span>
            </div>
            <div className="flex h-full w-full overflow-hidden">
              <NodeAssistantPanel
                node={tidyAssistantNode}
                color={d3.schemeCategory10[0]}
                theme={theme}
                onSizeChange={() => { }}
                onSecondQuestion={handleSecondQuestion}
                onPlaceholderCreate={handlePlaceholderCreate}
                questionService={questionService.current}
                initialConversation={getInitialConversationForNode(expandedNodeId)}
                onConversationChange={(messages) => {
                  if (expandedNodeId) {
                    handleConversationChange(expandedNodeId, messages);
                  }
                }}
                onRequestAnswer={handleRequestAnswer}
                onAnswerComplete={handleAnswerComplete}
                onAnswerError={handleAnswerError}
                isRootNode={tidyAssistantIsRoot}
                bootstrapMode={false}
                onCloseNode={() => handleCloseNode(expandedNodeId)}
                onPanZoomGesture={forwardPanZoomGesture}
                nodeScaleFactor={nodeScaleFactor}
                nodeSummary={{
                  label: tidyAssistantNode.keyword || tidyAssistantNode.id,
                  intro: tidyAssistantNode.fullText || '',
                  bullets: [],
                }}
                treeNodes={Array.isArray(visibleGraph.nodes) ? visibleGraph.nodes : []}
                treeLinks={Array.isArray(visibleGraph.links) ? visibleGraph.links : []}
                onNodeSelect={(targetNode) => {
                  const targetId = targetNode?.id;
                  if (targetId && targetId !== expandedNodeId) {
                    handleNodeClickForAssistant({ id: targetId, source: 'assistant-panel' });
                  }
                }}
                attachments={tidyAssistantAttachments}
                onAttachmentsChange={(nextAttachments) => {
                  if (expandedNodeId) {
                    setAttachmentsForNode(expandedNodeId, nextAttachments);
                  }
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* 창 드래그 핸들 - 중앙 최상단 */}
      <div
        className="absolute top-2 z-[1300] cursor-grab active:cursor-grabbing transition-all duration-300"
        style={{
          WebkitAppRegion: 'drag',
          left: tidyAssistantPanelVisible
            ? `${Math.max(140, (viewportWidth || (typeof window !== 'undefined' ? window.innerWidth : 800)) / 2 - tidyAssistantPanelWidth / 2)}px`
            : '50%',
          transform: 'translateX(-50%)',
        }}
      >
        <div
          className="relative flex h-8 items-center justify-between rounded-full bg-black/60 backdrop-blur-sm border border-black/50 shadow-lg hover:bg-black/80 transition-colors px-3"
          style={{ width: '240px' }}
        >
          {/* 왼쪽: 설정 & 테마 버튼 */}
          <div className="flex items-center gap-2" style={{ WebkitAppRegion: 'no-drag' }}>
            <button
              ref={handleMenuButtonRef}
              type="button"
              className="flex h-5 w-5 items-center justify-center rounded-full border border-gray-500/60 bg-black/40 p-0.5 transition-all duration-200 hover:bg-gray-700/80"
              onClick={(event) => {
                event.stopPropagation();
                toggleHandleMenu();
              }}
              onMouseDown={(event) => event.stopPropagation()}
              tabIndex={-1}
              title="트리 설정"
            >
              <Settings className="h-3.5 w-3.5 text-white/90" aria-hidden="true" />
            </button>

            {/* 테마 토글 버튼 */}
            <button
              className="group flex h-5 w-5 items-center justify-center rounded-full bg-black/40 border border-gray-500/60 hover:bg-gray-700/80 transition-all duration-200"
              onClick={cycleTheme}
              onMouseDown={(e) => e.stopPropagation()}
              tabIndex={-1}
              title={`테마 변경 (현재: ${activeTheme.label})`}
            >
              <ActiveThemeIcon className="h-3 w-3 text-white/90" />
            </button>
          </div>

          {/* 오른쪽: 전체화면 & 닫기 버튼 */}
          <div className="flex items-center gap-2" style={{ WebkitAppRegion: 'no-drag' }}>
            {/* 최대화 버튼 */}
            <button
              className="group flex h-5 w-5 items-center justify-center rounded-full bg-black/40 border border-gray-500/60 hover:bg-gray-700/80 transition-all duration-200"
              onClick={() => {
                const controls = treeBridge.windowControls || {};
                const handler = controls.maximize || controls.toggleFullScreen;
                if (typeof handler !== 'function') {
                  return;
                }
                const maybeResult = handler();
                if (maybeResult && typeof maybeResult.catch === 'function') {
                  maybeResult.catch(() => { });
                }
              }}
              onMouseDown={(e) => e.stopPropagation()}
              tabIndex={-1}
              title="최대화"
            >
              <svg className="h-3 w-3 text-white/90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            </button>

            {/* 닫기 버튼 */}
            <button
              className="group flex h-5 w-5 items-center justify-center rounded-full bg-black/60 border border-gray-500/60 hover:bg-white/80 hover:shadow-xl hover:shadow-white/40 hover:scale-110 transition-all duration-200"
              onClick={() => {
                if (process.env.NODE_ENV === 'development') {
                  // 개발 중 동작 여부 확인용
                  // eslint-disable-next-line no-console
                  console.log('[Jarvis] Drag handle close requested');
                }

                const hideWindow = () => {
                  if (process.env.NODE_ENV === 'development') {
                    // eslint-disable-next-line no-console
                    console.log('[Jarvis] hideWindow fallback triggered');
                  }
                  try {
                    const toggleResult = treeBridge.toggleWindow();
                    if (toggleResult && typeof toggleResult.then === 'function') {
                      toggleResult.catch(() => { });
                      return;
                    }
                    if (toggleResult !== null && toggleResult !== undefined) {
                      return;
                    }
                  } catch (toggleError) {
                    if (process.env.NODE_ENV === 'development') {
                      // eslint-disable-next-line no-console
                      console.warn('[Jarvis] toggleWindow failed', toggleError);
                    }
                  }

                  if (typeof window !== 'undefined' && typeof window.close === 'function') {
                    window.close();
                  }
                };

                try {
                  const maybeResult = treeBridge.windowControls.close();
                  if (process.env.NODE_ENV === 'development') {
                    const tag = '[Jarvis] windowControls.close result';
                    if (maybeResult && typeof maybeResult.then === 'function') {
                      maybeResult.then((response) => {
                        // eslint-disable-next-line no-console
                        console.log(tag, response);
                      }).catch((err) => {
                        // eslint-disable-next-line no-console
                        console.log(`${tag} (rejected)`, err);
                      });
                    } else {
                      // eslint-disable-next-line no-console
                      console.log(tag, maybeResult);
                    }
                  }

                  if (maybeResult && typeof maybeResult.then === 'function') {
                    maybeResult
                      .then((response) => {
                        if (process.env.NODE_ENV === 'development') {
                          // eslint-disable-next-line no-console
                          console.log('[Jarvis] close response (async)', response, response?.error);
                        }
                        if (!response?.success) {
                          hideWindow();
                        }
                      })
                      .catch((err) => {
                        if (process.env.NODE_ENV === 'development') {
                          // eslint-disable-next-line no-console
                          console.warn('[Jarvis] close response error', err);
                        }
                        hideWindow();
                      });
                    return;
                  }

                  if (maybeResult && maybeResult.success === false) {
                    hideWindow();
                    return;
                  }

                  if (maybeResult !== null && maybeResult !== undefined) {
                    return;
                  }
                } catch (error) {
                  if (process.env.NODE_ENV === 'development') {
                    // eslint-disable-next-line no-console
                    console.warn('[Jarvis] windowControls.close failed', error);
                  }
                  hideWindow();
                  return;
                }

                hideWindow();
              }}
              onMouseDown={(e) => e.stopPropagation()}
              tabIndex={-1}
            >
              <svg
                className="h-3 w-3 text-white group-hover:text-black"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {isHandleMenuOpen ? (
            <div
              ref={handleMenuRef}
              className="absolute right-0 top-10 w-48 rounded-lg border border-white/15 bg-black/85 p-2 text-xs text-white/90 shadow-xl backdrop-blur"
              style={{ WebkitAppRegion: 'no-drag' }}
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
            >
              <div>
                <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/45">뷰 모드</p>
                <button
                  type="button"
                  onClick={() => handleViewSwitch('tree1')}
                  className={`mt-1 flex w-full items-center justify-between rounded-md px-3 py-2 text-left transition ${viewMode === 'tree1' ? 'bg-white text-black font-semibold' : 'text-white/80 hover:bg-white/10'}`}
                  tabIndex={-1}
                >
                  <span>트리 1</span>
                  {viewMode === 'tree1' ? <span className="text-xs font-medium text-black/70">현재</span> : null}
                </button>
                <button
                  type="button"
                  onClick={() => handleViewSwitch('tree2')}
                  className={`mt-1 flex w-full items-center justify-between rounded-md px-3 py-2 text-left transition ${viewMode === 'tree2' ? 'bg-white text-black font-semibold' : 'text-white/80 hover:bg-white/10'}`}
                  tabIndex={-1}
                >
                  <span>트리 2</span>
                  {viewMode === 'tree2' ? <span className="text-xs font-medium text-black/70">현재</span> : null}
                </button>
              </div>

              <div className="mt-3 border-t border-white/10 pt-2">
                <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/45">설정</p>
                <button
                  type="button"
                  onClick={() => {
                    setZoomOnClickEnabled(!zoomOnClickEnabled);
                  }}
                  className={`mt-1 flex w-full items-center justify-between rounded-md px-3 py-2 text-left transition ${zoomOnClickEnabled ? 'bg-white text-black font-semibold' : 'text-white/80 hover:bg-white/10'}`}
                  tabIndex={-1}
                >
                  <span>클릭 시 확대</span>
                  <span className={`text-xs font-medium ${zoomOnClickEnabled ? 'text-black/70' : 'text-white/50'}`}>
                    {zoomOnClickEnabled ? '켜짐' : '꺼짐'}
                  </span>
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* 트리 탭 바: 상단 핸들 왼쪽 끝과 정렬 */}
      <div
        className="absolute z-[1250] transition-all duration-300"
        style={{
          top: '2.75rem',
          left: tidyAssistantPanelVisible
            ? `${Math.max(140, (viewportWidth || (typeof window !== 'undefined' ? window.innerWidth : 800)) / 2 - tidyAssistantPanelWidth / 2)}px`
            : '50%',
          transform: 'translateX(-50%)',
        }}
      >
        <TreeTabBar
          theme={theme}
          activeTreeId={activeTreeId}
          activeTabId={activeTabId}
          tabs={sessionTabs}
          onTabChange={(tab) => {
            if (tab?.treeId) {
              // 기존 탭 클릭이 아닌 경우에만 새 탭 추가
              if (!tab.isExistingTab) {
                setSessionTabs((prev) => {
                  // 새 트리 선택 시 항상 새 탭으로 추가 (같은 트리를 여러 탭에서 열 수 있음)
                  const newTabId = `${tab.treeId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                  setActiveTabId(newTabId);
                  return [...prev, {
                    id: newTabId,
                    treeId: tab.treeId,
                    title: tab.title || `트리 ${prev.length + 1}`
                  }];
                });
              } else {
                // 기존 탭 클릭 시 해당 탭의 ID로 설정
                setActiveTabId(tab.tabId);
              }
              // 모든 탭에서 같은 treeId를 공유하므로 단순히 treeId로 로드
              loadActiveTree({ treeId: tab.treeId });
            } else {
              // 새 트리 생성
              loadActiveTree({ treeId: undefined });
            }
          }}
          onTabDelete={(tabId) => {
            // 삭제 전에 남은 탭 확인
            const remaining = sessionTabs.filter(tab => tab.id !== tabId);

            // 세션 탭 목록에서 제거
            setSessionTabs(remaining);

            // 삭제한 탭이 현재 활성 탭이면 다른 탭으로 전환
            if (tabId === activeTabId) {
              if (remaining.length > 0) {
                const nextTab = remaining[0];
                setActiveTabId(nextTab.id);
                loadActiveTree({ treeId: nextTab.treeId });
              } else {
                setActiveTabId(null);
                loadActiveTree({ treeId: undefined });
              }
            }
          }}
        />
      </div>

      {isTreeSyncing && !initializingTree ? (
        <div className="pointer-events-none absolute bottom-6 right-6 z-[1200] rounded-full bg-slate-900/80 px-3 py-1 text-[11px] font-medium text-slate-100 shadow-lg">
          자동 저장 중...
        </div>
      ) : null}

      {isForceView && showBootstrapChat && (
        <div
          className="pointer-events-none absolute"
          style={{
            left: '50%',
            top: bootstrapChatTop,
            transform: 'translate(-50%, -50%)',
            width: 560,
            height: bootstrapChatHeight,
            zIndex: 1000,
          }}
          data-interactive-zone="true"
        >
          <div className="pointer-events-auto" style={{ width: '100%', height: '100%' }}>
            <NodeAssistantPanel
              node={{ id: '__bootstrap__', keyword: '', fullText: '' }}
              color={d3.schemeCategory10[0]}
              theme={theme}
              onSizeChange={() => { }}
              onSecondQuestion={() => { }}
              onPlaceholderCreate={() => { }}
              questionService={questionService.current}
              initialConversation={getInitialConversationForNode('__bootstrap__')}
              onConversationChange={(messages) => handleConversationChange('__bootstrap__', messages)}
              nodeSummary={{ label: '첫 노드', intro: '첫 노드를 생성하세요.', bullets: [] }}
              isRootNode={true}
              bootstrapMode={true}
              onBootstrapFirstSend={handleBootstrapSubmit}
              onPanZoomGesture={forwardPanZoomGesture}
              nodeScaleFactor={nodeScaleFactor}
              attachments={pendingAttachmentsByNode['__bootstrap__'] || []}
              onAttachmentsChange={(next) => setAttachmentsForNode('__bootstrap__', next)}
            />
          </div>
        </div>
      )}

      {isForceView && (
        <div
          className="absolute inset-0"
        >
          <ForceDirectedTree
            data={data}
            dimensions={dimensions}
            onNodeClick={handleNodeClickForAssistant}
            onNodeRemove={removeNodeAndDescendants}
            onNodeUpdate={handleNodeUpdate}
            onMemoCreate={handleMemoCreate}
            onMemoUpdate={handleMemoUpdate}
            onNodeCreate={handleManualNodeCreate}
            onLinkCreate={handleManualLinkCreate}
            onRootCreate={handleManualRootCreate}
            treeId={activeTreeId}
            userId={user?.id}
            questionService={questionService.current}
            getInitialConversation={getInitialConversationForNode}
            onConversationChange={handleConversationChange}
            onRequestAnswer={handleRequestAnswer}
            onAnswerComplete={handleAnswerComplete}
            onAnswerError={handleAnswerError}
            onSecondQuestion={handleSecondQuestion}
            onPlaceholderCreate={handlePlaceholderCreate}
            theme={theme}
            background={treeBackground}
            attachmentsByNode={pendingAttachmentsByNode}
            onNodeAttachmentsChange={setAttachmentsForNode}
            hideAssistantPanel={true}
            selectedNodeId={selectedNodeId}
            onBackgroundClick={handleBackgroundClick}
            isChatPanelOpen={Boolean(expandedNodeId)}
          />
        </div>
      )}

      {isTidyView && (
        <div
          className="absolute inset-0"
        >
          <TidyTreeView
            data={data}
            dimensions={dimensions}
            fitRequestVersion={data?.nodes?.length || 0}
            theme={theme}
            background={treeBackground}
            onNodeClick={handleNodeClickForAssistant}
            selectedNodeId={selectedNodeId}
            activeTreeId={activeTreeId}
            onBackgroundClick={handleBackgroundClick}
            isChatPanelOpen={Boolean(expandedNodeId)}
            onNodeDelete={removeNodeAndDescendants}
            onNodeUpdate={handleNodeUpdate}
            onReorderSiblings={(parentId, orderedChildIds) => {
              if (!parentId || !Array.isArray(orderedChildIds)) return;

              const normalize = (v) => (typeof v === 'object' && v !== null ? v.id : v);

              if (parentId === '__virtual_root__') {
                const targetIds = new Set(hierarchicalLinks.map(l => normalize(l.target)));
                const rootNodes = (data.nodes || []).filter(n => !targetIds.has(n.id));

                if (rootNodes.length <= 1) return;

                const orderedRoots = orderedChildIds
                  .map(id => rootNodes.find(n => n.id === id))
                  .filter(Boolean);

                const nonRootNodes = (data.nodes || []).filter(n => targetIds.has(n.id));

                setData((prev) => ({
                  ...prev,
                  nodes: [...orderedRoots, ...nonRootNodes]
                }));
                return;
              }

              const currentChildIds = (hierarchicalLinks
                .filter((l) => normalize(l.source) === parentId)
                .map((l) => normalize(l.target)));

              if (currentChildIds.length <= 1) return;

              const nextLinks = (data.links || []).map((l) => ({ ...l }));
              const indices = [];
              for (let i = 0; i < nextLinks.length; i++) {
                const s = normalize(nextLinks[i].source);
                const t = normalize(nextLinks[i].target);
                if (s === parentId && currentChildIds.includes(t) && nextLinks[i].relationship !== 'connection') {
                  indices.push(i);
                }
              }
              if (indices.length <= 1) return;

              const childLinkObjs = indices.map((idx) => nextLinks[idx]);
              indices.sort((a, b) => b - a).forEach((idx) => nextLinks.splice(idx, 1));

              const template = childLinkObjs[0] || { value: 1 };
              const rebuilt = orderedChildIds.map((cid) => ({ source: parentId, target: cid, value: template.value }));

              const insertAt = Math.min(...indices);
              nextLinks.splice(insertAt, 0, ...rebuilt);

              setData((prev) => ({ ...prev, links: nextLinks }));
            }}
          />
        </div>
      )}

      {/* 디버그 패널 제거됨 */}
      <div
        ref={overlayContainerRef}
        className="pointer-events-none absolute inset-0 z-10"
        style={{ overflow: 'visible' }}
      />
    </div>
  );
};

export default HierarchicalForceTree;
