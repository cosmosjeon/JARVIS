import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import * as d3 from 'd3';
import { motion, AnimatePresence } from 'framer-motion';
import { treeData } from '../data/treeData';
import TreeAnimationService from '../services/TreeAnimationService';
import QuestionService from '../services/QuestionService';
import useTreeViewMode from '../controllers/useTreeViewMode';
import { markNewLinks } from '../utils/linkAnimationUtils';
import ChartView from './ChartView';
import NodeAssistantPanel from './NodeAssistantPanel';
import ForceDirectedTree from './tree2/ForceDirectedTree';
import TidyTreeView from './tree1/TidyTreeView';
import TreeWorkspaceToolbar from './TreeWorkspaceToolbar';
import { useSupabaseAuth } from '../hooks/useSupabaseAuth';
import { useTheme } from './library/ThemeProvider';
import { Sun, Moon, Sparkles } from 'lucide-react';
import {
  fetchTreesWithNodes,
  upsertTreeMetadata,
  upsertTreeNodes,
  sanitizeConversationMessages,
  buildFallbackConversation,
} from '../services/supabaseTrees';
import { stopTrackingEmptyTree, isTrackingEmptyTree, cleanupEmptyTrees } from '../services/treeCreation';

const WINDOW_CHROME_HEIGHT = 48;

const DOM_DELTA_PIXEL = 0;
const DOM_DELTA_LINE = 1;
const DOM_DELTA_PAGE = 2;

const ORTHO_PATH_DEFAULTS = {
  cornerRadius: 20,
  nodePadding: 18,
};

const buildRoundedPath = (rawPoints, radius) => {
  if (!Array.isArray(rawPoints) || rawPoints.length < 2) {
    return '';
  }

  const points = rawPoints.map((point) => ({
    x: Number(point?.x) || 0,
    y: Number(point?.y) || 0,
  }));

  let command = `M ${points[0].x} ${points[0].y}`;

  for (let index = 1; index < points.length; index += 1) {
    const current = { ...points[index] };
    const previous = points[index - 1];

    if (index === points.length - 1) {
      command += ` L ${current.x} ${current.y}`;
      continue;
    }

    const next = points[index + 1];
    const prevVector = { x: current.x - previous.x, y: current.y - previous.y };
    const nextVector = { x: next.x - current.x, y: next.y - current.y };
    const prevLength = Math.hypot(prevVector.x, prevVector.y);
    const nextLength = Math.hypot(nextVector.x, nextVector.y);

    if (prevLength === 0 || nextLength === 0) {
      command += ` L ${current.x} ${current.y}`;
      continue;
    }

    const corner = Math.min(radius, prevLength / 2, nextLength / 2);

    if (corner <= 0) {
      command += ` L ${current.x} ${current.y}`;
      continue;
    }

    const startX = current.x - (prevVector.x / prevLength) * corner;
    const startY = current.y - (prevVector.y / prevLength) * corner;
    const endX = current.x + (nextVector.x / nextLength) * corner;
    const endY = current.y + (nextVector.y / nextLength) * corner;

    command += ` L ${startX} ${startY}`;
    command += ` Q ${current.x} ${current.y} ${endX} ${endY}`;

    points[index] = { x: endX, y: endY };
  }

  return command;
};

const buildOrthogonalPath = (source, target, orientation = 'vertical', overrides = {}) => {
  if (!source || !target) {
    return '';
  }

  const { cornerRadius, nodePadding } = { ...ORTHO_PATH_DEFAULTS, ...overrides };
  const resolvedPadding = Math.min(Math.max(nodePadding, 16), 20);
  const baseMargin = resolvedPadding;

  const sx = Number(source.x) || 0;
  const sy = Number(source.y) || 0;
  const tx = Number(target.x) || 0;
  const ty = Number(target.y) || 0;

  const dx = tx - sx;
  const dy = ty - sy;

  const isHorizontal = orientation === 'horizontal';
  const primaryDistance = isHorizontal ? Math.abs(dx) : Math.abs(dy);
  const secondaryDistance = isHorizontal ? Math.abs(dy) : Math.abs(dx);

  const primaryDirection = (isHorizontal ? dx : dy) >= 0 ? 1 : -1;
  const secondaryDirection = (isHorizontal ? dy : dx) >= 0 ? 1 : -1;

  let points;

  if (primaryDistance < baseMargin * 2) {
    const lateralOffset = Math.max(baseMargin * 1.35, secondaryDistance / 2 || baseMargin * 1.35);
    const advanceOffset = baseMargin;

    if (isHorizontal) {
      points = [
        { x: sx, y: sy },
        { x: sx + primaryDirection * advanceOffset, y: sy },
        { x: sx + primaryDirection * advanceOffset, y: sy + secondaryDirection * lateralOffset },
        { x: tx - primaryDirection * advanceOffset, y: sy + secondaryDirection * lateralOffset },
        { x: tx - primaryDirection * advanceOffset, y: ty },
        { x: tx, y: ty },
      ];
    } else {
      points = [
        { x: sx, y: sy },
        { x: sx, y: sy + primaryDirection * advanceOffset },
        { x: sx + secondaryDirection * lateralOffset, y: sy + primaryDirection * advanceOffset },
        { x: sx + secondaryDirection * lateralOffset, y: ty - primaryDirection * advanceOffset },
        { x: tx, y: ty - primaryDirection * advanceOffset },
        { x: tx, y: ty },
      ];
    }
  } else {
    if (isHorizontal) {
      let midX = sx + dx / 2;
      if (Math.abs(midX - sx) < baseMargin) {
        midX = sx + primaryDirection * baseMargin;
      }
      if (Math.abs(tx - midX) < baseMargin) {
        midX = tx - primaryDirection * baseMargin;
      }

      points = [
        { x: sx, y: sy },
        { x: midX, y: sy },
        { x: midX, y: ty },
        { x: tx, y: ty },
      ];
    } else {
      let midY = sy + dy / 2;
      if (Math.abs(midY - sy) < baseMargin) {
        midY = sy + primaryDirection * baseMargin;
      }
      if (Math.abs(ty - midY) < baseMargin) {
        midY = ty - primaryDirection * baseMargin;
      }

      points = [
        { x: sx, y: sy },
        { x: sx, y: midY },
        { x: tx, y: midY },
        { x: tx, y: ty },
      ];
    }
  }

  return buildRoundedPath(points, cornerRadius);
};

const normalizeWheelDelta = (value, mode) => {
  if (!Number.isFinite(value)) return 0;
  if (mode === DOM_DELTA_LINE) return value * 16;
  if (mode === DOM_DELTA_PAGE) return value * 120;
  return value;
};

const getViewportDimensions = () => {
  if (typeof window === 'undefined') {
    return { width: 1024, height: 720 - WINDOW_CHROME_HEIGHT };
  }
  return {
    width: window.innerWidth,
    height: Math.max(window.innerHeight - WINDOW_CHROME_HEIGHT, 0),
  };
};

// 창 크기에 따른 노드 스케일 팩터 계산
const calculateNodeScaleFactor = (dimensions) => {
  // 기준 크기 (1024x672)
  const BASE_WIDTH = 1024;
  const BASE_HEIGHT = 720 - WINDOW_CHROME_HEIGHT;

  // 현재 창 크기
  const currentWidth = dimensions.width || BASE_WIDTH;
  const currentHeight = dimensions.height || BASE_HEIGHT;

  // 너비와 높이 스케일을 각각 계산하고 더 작은 값 사용 (비율 유지)
  const widthScale = currentWidth / BASE_WIDTH;
  const heightScale = currentHeight / BASE_HEIGHT;
  const scaleFactor = Math.min(widthScale, heightScale);

  // 최소 0.4배, 최대 2.0배로 제한
  return Math.max(0.4, Math.min(2.0, scaleFactor));
};

const HierarchicalForceTree = () => {
  const { user } = useSupabaseAuth();
  const { theme, setTheme, mode } = useTheme();

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

  // 뷰 선택 메뉴 상태
  const [showViewMenu, setShowViewMenu] = useState(false);

  // 테마 순환 함수
  const cycleTheme = useCallback(() => {
    const currentIndex = themeOptions.findIndex(option => option.value === theme);
    const nextIndex = (currentIndex + 1) % themeOptions.length;
    setTheme(themeOptions[nextIndex].value);
  }, [theme, themeOptions, setTheme]);

  // 테마 색상 (새로운 CSS 변수 시스템 사용)
  const themeColors = useMemo(() => ({
    glass: {
      background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.12), rgba(30, 41, 59, 0.18))',
      text: 'rgba(226, 232, 240, 0.9)',
      border: 'rgba(51, 65, 85, 0.1)',
    },
    light: {
      background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(240, 240, 240, 0.95))',
      text: '#000000',
      border: 'rgba(0, 0, 0, 0.1)',
    },
    dark: {
      background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.95), rgba(20, 20, 20, 0.95))',
      text: '#FFFFFF',
      border: 'rgba(255, 255, 255, 0.1)',
    },
  }), []);

  const currentTheme = themeColors[theme] || themeColors.glass;

  const svgRef = useRef(null);
  const [dimensions, setDimensions] = useState(getViewportDimensions());
  const [nodeScaleFactor, setNodeScaleFactor] = useState(() => calculateNodeScaleFactor(getViewportDimensions()));
  const [nodes, setNodes] = useState([]);
  const [links, setLinks] = useState([]);
  const [viewMode, setViewMode] = useTreeViewMode('tree1');
  const [linkValidationError, setLinkValidationError] = useState(null);
  const [expandedNodeId, setExpandedNodeId] = useState(null);
  const [viewTransform, setViewTransform] = useState({ x: 0, y: 0, k: 1 });
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [data, setData] = useState(treeData);
  const [activeTreeId, setActiveTreeId] = useState(null);
  const [initializingTree, setInitializingTree] = useState(false);
  const [treeSyncError, setTreeSyncError] = useState(null);
  const [isTreeSyncing, setIsTreeSyncing] = useState(false);
  const [hoveredLinkId, setHoveredLinkId] = useState(null);
  const dataRef = useRef(treeData);
  const simulationRef = useRef(null);
  const treeAnimationService = useRef(new TreeAnimationService());
  const animationRef = useRef(null);
  const questionService = useRef(new QuestionService());
  const conversationStoreRef = useRef(new Map());
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

  const requestedTreeIdRef = useRef(sessionInfo.initialTreeId);
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

  const hasResolvedInitialTreeRef = useRef(false);

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

  const hydrateConversationStore = useCallback((incomingNodes = []) => {
    conversationStoreRef.current.clear();
    incomingNodes.forEach((node) => {
      if (!node || !node.id) {
        return;
      }

      const baseConversation = sanitizeConversationMessages(node.conversation);
      const fallbackConversation = baseConversation.length
        ? baseConversation
        : buildFallbackConversation(
          node.question || node.questionData?.question,
          node.answer || node.questionData?.answer || node.fullText,
        );

      conversationStoreRef.current.set(node.id, fallbackConversation);
    });
  }, []);
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

  useEffect(() => {
    setOverlayElement(overlayContainerRef.current);
  }, []);


  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const setWindowMousePassthrough = useCallback((shouldIgnore = true) => {
    if (typeof window === 'undefined') return;
    const api = window.jarvisAPI;
    if (!api || typeof api.setMousePassthrough !== 'function') {
      return;
    }

    if (isIgnoringMouseRef.current === shouldIgnore) {
      return;
    }

    try {
      const result = api.setMousePassthrough({ ignore: shouldIgnore, forward: true });
      isIgnoringMouseRef.current = shouldIgnore;
      if (result && typeof result.catch === 'function') {
        result.catch(() => {
          // 실패 시 다음 이벤트에서 재시도할 수 있도록 상태를 되돌려 둔다
          isIgnoringMouseRef.current = !shouldIgnore;
        });
      }
    } catch (error) {
      // IPC 호출 실패는 사용자 상호작용에 직접적 영향이 없으므로 조용히 처리
      // 개발 환경에서만 로그 출력
      if (process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.error('마우스 패스스루 설정 실패:', error);
      }
    }
  }, []);





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

  const loadActiveTree = useCallback(async ({ treeId: explicitTreeId } = {}) => {
    if (!user) {
      setActiveTreeId(null);
      hydrateConversationStore([]);
      setData(treeData);
      setInitializingTree(false);
      return;
    }

    setInitializingTree(true);
    setTreeSyncError(null);

    const resolvedTreeId = typeof explicitTreeId === 'string' && explicitTreeId.trim()
      ? explicitTreeId.trim()
      : (requestedTreeIdRef.current || readSessionTreeId());

    if (!resolvedTreeId) {
      hydrateConversationStore([]);
      setActiveTreeId(null);
      setData({ nodes: [], links: [] });
      writeSessionTreeId(null);
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.removeItem('jarvis.activeTreeId');
        } catch (error) {
          // ignore storage errors
        }
      }
      setInitializingTree(false);
      requestedTreeIdRef.current = null;
      return;
    }

    try {
      const trees = await fetchTreesWithNodes(user.id);
      const targetTree = trees.find((tree) => tree.id === resolvedTreeId);

      if (targetTree) {
        const mappedNodes = Array.isArray(targetTree.treeData?.nodes)
          ? targetTree.treeData.nodes.map((node) => ({
            ...node,
            conversation: sanitizeConversationMessages(node.conversation),
          }))
          : [];

        hydrateConversationStore(mappedNodes);
        setData({
          nodes: mappedNodes,
          links: Array.isArray(targetTree.treeData?.links) ? targetTree.treeData.links : [],
        });
        treeLibrarySyncRef.current.set(targetTree.id, {
          lastCount: mappedNodes.length,
          refreshed: mappedNodes.length > 0,
        });
        setActiveTreeId(targetTree.id);
        writeSessionTreeId(targetTree.id);
        if (typeof window !== 'undefined') {
          try {
            window.localStorage.setItem('jarvis.activeTreeId', targetTree.id);
          } catch (error) {
            // ignore storage errors
          }
        }
      } else {
        hydrateConversationStore([]);
        setActiveTreeId(null);
        setData({ nodes: [], links: [] });
        writeSessionTreeId(null);
        if (resolvedTreeId) {
          treeLibrarySyncRef.current.delete(resolvedTreeId);
        }
      }
    } catch (error) {
      setTreeSyncError(error);
    } finally {
      requestedTreeIdRef.current = null;
      setInitializingTree(false);
    }
  }, [user, hydrateConversationStore, readSessionTreeId, writeSessionTreeId]);

  useEffect(() => {
    if (!user || hasResolvedInitialTreeRef.current) {
      return undefined;
    }

    let cancelled = false;

    const resolveInitialTree = async () => {
      if (hasResolvedInitialTreeRef.current || cancelled) {
        return;
      }

      const initialTreeId = sessionInfo.initialTreeId || readSessionTreeId();
      if (initialTreeId) {
        hasResolvedInitialTreeRef.current = true;
        await loadActiveTree({ treeId: initialTreeId });
        return;
      }

      try {
        const existingTrees = await fetchTreesWithNodes(user.id);
        const shouldCreateNewTree = sessionInfo.fresh || !Array.isArray(existingTrees) || existingTrees.length === 0;

        if (!shouldCreateNewTree && Array.isArray(existingTrees) && existingTrees.length > 0) {
          const [mostRecent] = existingTrees;
          writeSessionTreeId(mostRecent.id);
          if (typeof window !== 'undefined') {
            try {
              window.localStorage.setItem('jarvis.activeTreeId', mostRecent.id);
            } catch (error) {
              // ignore storage errors
            }
          }

          requestedTreeIdRef.current = mostRecent.id;
          hasResolvedInitialTreeRef.current = true;
          await loadActiveTree({ treeId: mostRecent.id });
          return;
        }

        const freshTreeId = createClientGeneratedId('tree');
        await upsertTreeMetadata({
          treeId: freshTreeId,
          title: '새 지식 트리',
          userId: user.id,
        });

        writeSessionTreeId(freshTreeId);
        if (typeof window !== 'undefined') {
          try {
            window.localStorage.setItem('jarvis.activeTreeId', freshTreeId);
          } catch (error) {
            // ignore storage errors
          }
        }

        requestedTreeIdRef.current = freshTreeId;
        hasResolvedInitialTreeRef.current = true;
        await loadActiveTree({ treeId: freshTreeId });
      } catch (error) {
        setTreeSyncError(error);
        setInitializingTree(false);
        hasResolvedInitialTreeRef.current = true;
      }
    };

    resolveInitialTree();

    return () => {
      cancelled = true;
    };
  }, [createClientGeneratedId, loadActiveTree, readSessionTreeId, sessionInfo.initialTreeId, user, writeSessionTreeId]);

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

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.jarvisAPI?.onWidgetSetActiveTree !== 'function') {
      return undefined;
    }

    const unsubscribe = window.jarvisAPI.onWidgetSetActiveTree((payload) => {
      if (payload && typeof payload.treeId === 'string') {
        requestedTreeIdRef.current = payload.treeId;
        loadActiveTree({ treeId: payload.treeId });
      }
    });

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [loadActiveTree]);

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

    if (typeof window === 'undefined') {
      return fallbackKeyword;
    }

    const api = window.jarvisAPI;
    if (!api?.extractKeyword) {
      return fallbackKeyword;
    }

    try {
      const result = await api.extractKeyword({ question: trimmed });
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
        api?.log?.('warn', 'keyword_extraction_failed', { message: error?.message || 'unknown error' });
      } catch (loggingError) {
        if (process.env.NODE_ENV === 'development') {
          // eslint-disable-next-line no-console
          console.warn('Keyword extraction logging failed', loggingError);
        }
      }
    }

    return fallbackKeyword;
  }, []);

  // 2번째 질문 처리 함수 (handleRequestAnswer 정의 후로 이동)

  const persistTreeData = useCallback(async () => {
    if (!user || initializingTree) {
      return;
    }

    if (!data?.nodes?.length) {
      return;
    }

    setIsTreeSyncing(true);
    setTreeSyncError(null);

    try {
      const parentByChild = new Map();
      hierarchicalLinks.forEach((link) => {
        const sourceId = normalizeLinkEndpoint(link.source);
        const targetId = normalizeLinkEndpoint(link.target);
        if (sourceId && targetId) {
          parentByChild.set(targetId, sourceId);
        }
      });

      const normalizedNodes = data.nodes.map((node) => {
        const parentId = parentByChild.get(node.id) || null;
        const createdAt = node.createdAt || Date.now();
        const baseQuestion = typeof node.question === 'string' && node.question.trim()
          ? node.question.trim()
          : (node.questionData?.question || null);
        const baseAnswer = typeof node.answer === 'string' && node.answer.trim()
          ? node.answer.trim()
          : node.questionData?.answer || node.fullText || null;
        const isMemoNode = node.nodeType === 'memo';
        const normalizedConversation = isMemoNode
          ? []
          : sanitizeConversationMessages(conversationStoreRef.current.get(node.id));
        const conversation = isMemoNode
          ? []
          : (normalizedConversation.length
            ? normalizedConversation
            : buildFallbackConversation(baseQuestion, baseAnswer));
        const memoPayload = isMemoNode
          ? {
            title: node.memo?.title || node.keyword || '',
            content: node.memo?.content || node.fullText || '',
            metadata: node.memo?.metadata || node.memoMetadata || null,
          }
          : null;

        return {
          id: node.id,
          keyword: node.keyword || null,
          fullText: node.fullText || '',
          question: baseQuestion,
          answer: baseAnswer,
          status: node.status || 'answered',
          createdAt,
          updatedAt: Date.now(),
          parentId,
          conversation,
          questionData: node.questionData,
          nodeType: node.nodeType || null,
          memoParentId: node.memoParentId || null,
          memo: memoPayload,
          memoMetadata: memoPayload?.metadata || null,
        };
      });

      const rootNodeId = getRootNodeId();
      const rootNode = data.nodes.find((node) => node.id === rootNodeId) || data.nodes[0];
      const title = rootNode?.keyword
        || rootNode?.questionData?.question
        || '새 지식 트리';

      let workingTreeId = activeTreeId || pendingTreeIdRef.current;
      if (!workingTreeId) {
        const timestamp = Date.now();
        const randomPart = Math.random().toString(16).slice(2, 10);
        workingTreeId = `tree_${timestamp}_${randomPart}`;
        pendingTreeIdRef.current = workingTreeId;
      }

      const treeRecord = await upsertTreeMetadata({
        treeId: workingTreeId,
        title,
        userId: user.id,
      });

      const resolvedTreeId = treeRecord?.id || workingTreeId;
      pendingTreeIdRef.current = resolvedTreeId;
      if (resolvedTreeId) {
        writeSessionTreeId(resolvedTreeId);
        requestedTreeIdRef.current = resolvedTreeId;
      }
      if (!activeTreeId && resolvedTreeId) {
        setActiveTreeId(resolvedTreeId);
        if (typeof window !== 'undefined') {
          try {
            window.localStorage.setItem('jarvis.activeTreeId', resolvedTreeId);
          } catch (error) {
            // ignore storage errors
          }
        }
      }

      if (resolvedTreeId) {
        await upsertTreeNodes({
          treeId: resolvedTreeId,
          nodes: normalizedNodes,
          userId: user.id,
        });

        const stateMap = treeLibrarySyncRef.current;
        const existingState = stateMap.get(resolvedTreeId) || { lastCount: 0, refreshed: false };
        const previousCount = existingState.lastCount || 0;
        const alreadyRefreshed = existingState.refreshed === true;
        const nextCount = normalizedNodes.length;

        if (!alreadyRefreshed && previousCount === 0 && nextCount > 0 && typeof window !== 'undefined') {
          try {
            window.jarvisAPI?.requestLibraryRefresh?.();
          } catch (error) {
            // IPC failures are non-fatal for sync notifications
          }
          stateMap.set(resolvedTreeId, { lastCount: nextCount, refreshed: true });
        } else {
          stateMap.set(resolvedTreeId, {
            lastCount: nextCount,
            refreshed: alreadyRefreshed || nextCount > 0,
          });
        }

        // 트리에 내용이 추가되었으므로 빈 트리 추적 중지
        if (isTrackingEmptyTree(resolvedTreeId)) {
          stopTrackingEmptyTree(resolvedTreeId);
          console.log(`트리에 내용이 추가되어 빈 트리 추적 중지: ${resolvedTreeId}`);
        }
      }
    } catch (error) {
      setTreeSyncError(error);
      if (!activeTreeId) {
        pendingTreeIdRef.current = null;
      }
    } finally {
      setIsTreeSyncing(false);
    }
  }, [user, initializingTree, data, normalizeLinkEndpoint, hierarchicalLinks, getRootNodeId, activeTreeId, writeSessionTreeId]);

  useEffect(() => {
    if (!user || initializingTree) {
      return undefined;
    }

    if (!data?.nodes?.length) {
      return undefined;
    }

    if (treeSyncDebounceRef.current) {
      clearTimeout(treeSyncDebounceRef.current);
    }

    treeSyncDebounceRef.current = setTimeout(() => {
      persistTreeData();
    }, 800);

    return () => {
      if (treeSyncDebounceRef.current) {
        clearTimeout(treeSyncDebounceRef.current);
      }
    };
  }, [data, user, initializingTree, persistTreeData]);

  // 위젯에서 나갈 때 빈 트리 정리
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleBeforeUnload = async () => {
      try {
        // 현재 트리 데이터를 가져와서 빈 트리인지 확인
        const currentTree = {
          id: activeTreeId,
          treeData: data
        };

        // 빈 트리인 경우 정리
        if (activeTreeId && data && data.nodes && data.nodes.length === 0) {
          await cleanupEmptyTrees([currentTree]);
        }
      } catch (error) {
        console.error('빈 트리 정리 중 오류:', error);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [activeTreeId, data]);

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

  const getInitialConversationForNode = (nodeId) => {
    const stored = conversationStoreRef.current.get(nodeId);
    return stored ? stored.map((message) => ({ ...message })) : [];
  };

  const setConversationForNode = useCallback((nodeId, messages) => {
    const normalized = Array.isArray(messages)
      ? messages.map((message) => ({ ...message }))
      : [];
    conversationStoreRef.current.set(nodeId, normalized);
  }, []);

  useEffect(() => {
    const isEmpty = !Array.isArray(data.nodes) || data.nodes.length === 0;
    setShowBootstrapChat(isEmpty);

    if (isEmpty) {
      setSelectedNodeId(null);
      setExpandedNodeId(null);
      if (!conversationStoreRef.current.has('__bootstrap__')) {
        conversationStoreRef.current.set('__bootstrap__', []);
      }
    } else {
      conversationStoreRef.current.delete('__bootstrap__');
    }
  }, [data.nodes]);

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

  const forwardPanZoomGesture = useCallback((event) => {
    const svgElement = svgRef.current;
    const zoomBehaviour = zoomBehaviourRef.current;
    if (!svgElement || !zoomBehaviour || !event) {
      return false;
    }

    const mode = typeof event.deltaMode === 'number' ? event.deltaMode : DOM_DELTA_PIXEL;
    const selection = d3.select(svgElement);

    const isPinch = event.ctrlKey || event.metaKey;

    if (isPinch) {
      const normalizedDeltaY = normalizeWheelDelta(event.deltaY || 0, mode);
      if (!Number.isFinite(normalizedDeltaY) || normalizedDeltaY === 0) {
        return false;
      }

      const rect = svgElement.getBoundingClientRect();
      const clientX = typeof event.clientX === 'number' ? event.clientX : rect.left + rect.width / 2;
      const clientY = typeof event.clientY === 'number' ? event.clientY : rect.top + rect.height / 2;
      const pointerX = clientX - rect.left;
      const pointerY = clientY - rect.top;

      // Match the sensitivity used by the default wheel delta
      const scaleFactor = Math.pow(2, -normalizedDeltaY / 600);
      if (!Number.isFinite(scaleFactor) || scaleFactor === 0) {
        return false;
      }

      event.preventDefault();
      event.stopPropagation();
      selection.interrupt('focus-node');
      zoomBehaviour.scaleBy(selection, scaleFactor, [pointerX, pointerY]);
      return true;
    }

    const normalizedDeltaX = normalizeWheelDelta(event.deltaX || 0, mode);
    const normalizedDeltaY = normalizeWheelDelta(event.deltaY || 0, mode);
    if (normalizedDeltaX === 0 && normalizedDeltaY === 0) {
      return false;
    }

    const currentTransform = d3.zoomTransform(svgElement);
    const scale = Number.isFinite(currentTransform.k) && currentTransform.k > 0 ? currentTransform.k : 1;

    event.preventDefault();
    event.stopPropagation();
    selection.interrupt('focus-node');
    zoomBehaviour.translateBy(selection, -normalizedDeltaX / scale, -normalizedDeltaY / scale);
    return true;
  }, []);

  // 부트스트랩 채팅창 위치 (화면 상단 중앙)
  // 초기 부팅 시(빈 그래프) 드래그 핸들 바로 아래에 채팅창 표시
  const handleConversationChange = (nodeId, messages) => {

    setConversationForNode(nodeId, messages);

  };

  const handleCloseNode = (nodeId) => {
    // 특정 노드를 닫기
    if (expandedNodeId === nodeId) {
      collapseAssistantPanel();
    }
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
      const history = conversationStoreRef.current.get(id) || [];
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
    const api = window.jarvisAPI;
    if (!api || typeof api[channel] !== 'function') {
      throw new Error('AI 에이전트 브리지가 준비되지 않았습니다.');
    }
    const result = await api[channel](payload);
    if (!result?.success) {
      const message = result?.error?.message || 'AI 응답을 가져오지 못했습니다.';
      const code = result?.error?.code || 'agent_error';
      const error = new Error(message);
      error.code = code;
      throw error;
    }
    return result;
  }, []);

  const handleRequestAnswer = useCallback(
    async ({ node: targetNode, question, isRootNode }) => {
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

      const response = await invokeAgent(isRootNode ? 'askRoot' : 'askChild', payload);

      return response;
    },
    [buildContextMessages, invokeAgent],
  );

  const handleBootstrapSubmit = useCallback(async (text) => {
    const trimmed = typeof text === 'string' ? text.trim() : '';
    if (!trimmed) {
      return;
    }

    const timestamp = Date.now();

    setConversationForNode('__bootstrap__', [
      { id: `${timestamp}-user`, role: 'user', text: trimmed, timestamp },
      { id: `${timestamp}-assistant`, role: 'assistant', text: '생각 중…', status: 'pending', timestamp: Date.now() },
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
        { id: `${timestamp}-user`, role: 'user', text: trimmed, timestamp },
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
      conversationStoreRef.current.delete('__bootstrap__');

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
      { id: `${timestamp}-assistant`, role: 'assistant', text: '생각 중…', status: 'pending' }
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

      // 강제로 컴포넌트 리렌더링을 위해 상태 업데이트
      setData(prev => ({ ...prev }));
    } catch (error) {
      console.error('AI 답변 요청 실패:', error);
      // AI 답변 실패 시 fallback 답변 사용
      const fallbackAnswer = `${parentNode.keyword || parentNode.id} 관련 질문 "${trimmedQuestion}"에 대한 답변입니다. 이는 ${parentNode.fullText || '관련된 내용'}과 연관되어 있습니다.`;

      const fallbackConversation = [
        { id: `${timestamp}-user`, role: 'user', text: trimmedQuestion || question },
        { id: `${timestamp}-assistant`, role: 'assistant', text: fallbackAnswer, status: 'complete' }
      ];

      setConversationForNode(newNodeData.id, fallbackConversation);

      // 강제로 컴포넌트 리렌더링을 위해 상태 업데이트
      setData(prev => ({ ...prev }));
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
    window.jarvisAPI?.log?.('warn', 'agent_answer_error', { nodeId, message });
  }, []);

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
      conversationStoreRef.current.delete(id);
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
        await upsertTreeNodes(activeTreeId, updatedNodes, user.id);
      }
    } catch (error) {
      console.error('노드 업데이트 실패:', error);
    }
  }, [activeTreeId, user?.id]);

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
      if (!conversationStoreRef.current.has(node.id)) {
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
    toRemove.forEach((id) => conversationStoreRef.current.delete(id));
    if (selectedNodeId && toRemove.has(selectedNodeId)) setSelectedNodeId(null);
    if (expandedNodeId && toRemove.has(expandedNodeId)) collapseAssistantPanel();

    hasCleanedQ2Ref.current = true;
  }, [data, selectedNodeId, expandedNodeId, hierarchicalLinks]);

  useEffect(() => {
    const handleResize = () => {
      setIsResizing(true);
      const newDimensions = getViewportDimensions();
      setDimensions(newDimensions);
      setNodeScaleFactor(calculateNodeScaleFactor(newDimensions));
      if (handleResize._t) clearTimeout(handleResize._t);
      handleResize._t = setTimeout(() => setIsResizing(false), 140);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
  }, [dimensions, data, visibleGraph.nodes, visibleGraph.links]);

  const focusNodeToCenter = useCallback((node, options = {}) => {
    if (!node || !svgRef.current) {
      return Promise.resolve();
    }

    const svgElement = svgRef.current;
    const rect = typeof svgElement.getBoundingClientRect === 'function'
      ? svgElement.getBoundingClientRect()
      : null;

    const fallbackWidth = typeof dimensions?.width === 'number' ? dimensions.width : 0;
    const fallbackHeight = typeof dimensions?.height === 'number' ? dimensions.height : 0;

    const width = rect?.width || fallbackWidth;
    const height = rect?.height || fallbackHeight;

    if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
      return Promise.resolve();
    }

    const { duration = 620, scale: requestedScale } = options;
    const nodeX = Number.isFinite(node.x) ? node.x : 0;
    const nodeY = Number.isFinite(node.y) ? node.y : 0;
    const currentScale = Number.isFinite(viewTransform.k) ? viewTransform.k : 1;
    const preferredScale = typeof requestedScale === 'number' ? requestedScale : Math.max(currentScale, 1);
    const targetScale = Math.min(Math.max(preferredScale, 0.3), 4);

    const translateX = (width / 2) - (nodeX * targetScale);
    const translateY = (height / 2) - (nodeY * targetScale);
    const nextTransform = d3.zoomIdentity.translate(translateX, translateY).scale(targetScale);

    const svgSelection = d3.select(svgElement);
    const zoomBehaviour = zoomBehaviourRef.current;

    if (!zoomBehaviour) {
      setViewTransform({ x: translateX, y: translateY, k: targetScale });
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      const transition = svgSelection
        .transition('focus-node')
        .duration(duration)
        .ease(d3.easeCubicInOut)
        .call(zoomBehaviour.transform, nextTransform);

      transition.on('end', resolve);
      transition.on('interrupt', resolve);
    });
  }, [dimensions, viewTransform.k]);

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
    if (!targetId) {
      return;
    }

    const layoutNode = nodes.find((candidate) => candidate.id === targetId) || payload;

    pendingFocusNodeIdRef.current = targetId;
    setSelectedNodeId(targetId);

    setExpandedNodeId((current) => {
      if (current && current !== targetId) {
        return null;
      }
      return current;
    });

    Promise.resolve(focusNodeToCenter(layoutNode, { duration: 620 }))
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

  const handleDrag = (nodeId) => {
    let dragStart = null;

    const isInteractiveTarget = (target) => {
      if (!target) return false;
      const interactiveSelector = '[data-node-toggle],button,a,input,textarea,select,[contenteditable="true"]';
      return Boolean(target.closest && target.closest(interactiveSelector));
    };

    const resolveAxisLock = (rawEvent) => {
      if (!rawEvent) return null;
      if (rawEvent.shiftKey) {
        return 'horizontal'; // lock vertical movement, allow X changes
      }
      if (rawEvent.altKey || rawEvent.metaKey) {
        return 'vertical'; // lock horizontal movement, allow Y changes
      }
      return null;
    };

    return d3.drag()
      .filter((event) => {
        const rawEvent = event?.sourceEvent || event;
        if (!rawEvent) return false;
        if (typeof rawEvent.button === 'number' && rawEvent.button !== 0) {
          return false;
        }
        if (isInteractiveTarget(rawEvent.target)) {
          return false;
        }
        return true;
      })
      .on('start', (event) => {
        if (animationRef.current) {
          animationRef.current.stop();
        }

        const targetNode = nodes.find((candidate) => candidate.id === nodeId);
        if (targetNode) {
          dragStart = { x: targetNode.x || 0, y: targetNode.y || 0 };
        }
      })
      .on('drag', (event) => {
        const container = contentGroupRef.current || svgRef.current;
        if (!container) {
          return;
        }

        const rawEvent = event?.sourceEvent || event;
        const pointer = d3.pointer(event, container);
        const axisLock = resolveAxisLock(rawEvent);

        setNodes((currentNodes) => {
          const existing = currentNodes.find((candidate) => candidate.id === nodeId);
          if (!existing) {
            return currentNodes;
          }

          const lockedX = axisLock === 'vertical' && dragStart ? dragStart.x : pointer[0];
          const lockedY = axisLock === 'horizontal' && dragStart ? dragStart.y : pointer[1];

          return currentNodes.map((node) => (
            node.id === nodeId
              ? { ...node, x: lockedX, y: lockedY }
              : node
          ));
        });
      })
      .on('end', () => {
        dragStart = null;
      });
  };

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);

    nodes.forEach(node => {
      const selection = svg.selectAll(`[data-node-id="${node.id}"]`);

      if (expandedNodeId) {
        selection.on('.drag', null);
        selection.style('cursor', 'default');
      } else {
        selection.call(handleDrag(node.id));
        selection.style('cursor', 'grab');
      }
    });
  }, [nodes, expandedNodeId]);

  useEffect(() => {
    if (!expandedNodeId) return;
    const svg = d3.select(svgRef.current);
    // 확장된 노드를 최상위로 이동
    svg.selectAll(`[data-node-id="${expandedNodeId}"]`).raise();
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
        background: currentTheme.background,
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
      {/* 창 드래그 핸들 - 중앙 최상단 */}
      <div
        className="absolute top-2 left-1/2 z-[1300] -translate-x-1/2 cursor-grab active:cursor-grabbing"
        style={{ WebkitAppRegion: 'drag' }}
      >
        <div className="flex h-8 items-center justify-between rounded-full bg-black/60 backdrop-blur-sm border border-black/50 shadow-lg hover:bg-black/80 transition-colors px-3" style={{ width: '224px' }}>
          {/* 왼쪽: 드래그 점들 & 테마 버튼 */}
          <div className="flex items-center gap-2" style={{ WebkitAppRegion: 'no-drag' }}>
            {/* 드래그 점들 */}
            <div className="flex space-x-1">
              <div className="h-1 w-1 rounded-full bg-white/60"></div>
              <div className="h-1 w-1 rounded-full bg-white/60"></div>
              <div className="h-1 w-1 rounded-full bg-white/60"></div>
            </div>

            {/* 테마 드롭다운 버튼 */}
            {/* 테마 토글 버튼 */}
            <button
              className="group flex h-5 w-5 items-center justify-center rounded-full bg-black/40 border border-gray-500/60 hover:bg-gray-700/80 transition-all duration-200"
              onClick={cycleTheme}
              onMouseDown={(e) => e.stopPropagation()}
              title={`테마 변경 (현재: ${activeTheme.label})`}
            >
              <ActiveThemeIcon className="h-3 w-3 text-white/90" />
            </button>
          </div>

          {/* 오른쪽: 전체화면 & 닫기 버튼 */}
          <div className="flex items-center gap-2" style={{ WebkitAppRegion: 'no-drag' }}>
            {/* 전체화면 버튼 */}
            <button
              className="group flex h-5 w-5 items-center justify-center rounded-full bg-black/40 border border-gray-500/60 hover:bg-gray-700/80 transition-all duration-200"
              onClick={() => {
                const api = typeof window !== 'undefined' ? window.jarvisAPI : null;
                if (api?.windowControls?.maximize) {
                  api.windowControls.maximize();
                }
              }}
              onMouseDown={(e) => e.stopPropagation()}
              title="전체화면"
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

                const api = typeof window !== 'undefined' ? window.jarvisAPI : null;

                const hideWindow = () => {
                  if (process.env.NODE_ENV === 'development') {
                    // eslint-disable-next-line no-console
                    console.log('[Jarvis] hideWindow fallback triggered');
                  }
                  try {
                    if (api && typeof api.toggleWindow === 'function') {
                      api.toggleWindow();
                      return;
                    }
                  } catch (toggleError) {
                    // Ignore toggle errors and fall through to window.close fallback.
                  }

                  if (typeof window !== 'undefined' && typeof window.close === 'function') {
                    window.close();
                  }
                };

                try {
                  const closeFn = api?.windowControls?.close;
                  if (typeof closeFn === 'function') {
                    const maybeResult = closeFn();
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
                        .catch(() => hideWindow());
                      return;
                    }

                    if (!maybeResult?.success) {
                      hideWindow();
                    }
                    return;
                  }
                } catch (error) {
                  hideWindow();
                  return;
                }

                hideWindow();
              }}
              onMouseDown={(e) => e.stopPropagation()}
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
        </div>
      </div>

      {/* 뷰 선택 버튼 - 상단바 아래 */}
      <div
        className="absolute top-12 left-1/2 z-[1300] -translate-x-1/2"
        style={{ pointerEvents: 'none' }}
      >
        <TreeWorkspaceToolbar viewMode={viewMode} onChange={setViewMode} showChart />
      </div>

      {isTreeSyncing && !initializingTree ? (
        <div className="pointer-events-none absolute bottom-6 right-6 z-[1200] rounded-full bg-slate-900/80 px-3 py-1 text-[11px] font-medium text-slate-100 shadow-lg">
          자동 저장 중...
        </div>
      ) : null}

      {viewMode === 'tree2' && showBootstrapChat && (
        <div
          className="pointer-events-none absolute"
          style={{
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: 600,
            height: 640,
            zIndex: 1000,
          }}
          data-interactive-zone="true"
        >
          <div className="pointer-events-auto" style={{ width: '100%', height: '100%' }}>
            <NodeAssistantPanel
              node={{ id: '__bootstrap__', keyword: '', fullText: '' }}
              color={d3.schemeCategory10[0]}
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
            />
          </div>
        </div>
      )}

      {viewMode === 'tree2' && (
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
        />
      )}

      {viewMode === 'tree1' && (
        <TidyTreeView
          data={data}
          dimensions={dimensions}
          theme={theme}
          background={currentTheme.background}
          onNodeClick={handleNodeClickForAssistant}
          selectedNodeId={selectedNodeId}
        />
      )}
      {/* 차트 뷰 */}
      {viewMode === 'chart' && (
        <ChartView
          data={data}
          dimensions={dimensions}
          viewTransform={viewTransform}
          nodeScaleFactor={nodeScaleFactor}
        />
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


