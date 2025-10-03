import { useCallback } from 'react';

const normalizeId = (value) => (typeof value === 'object' && value !== null ? value.id : value);

const useHierarchicalTreeCreation = ({
  data,
  setData,
  dataRef,
  setConversationForNode,
  setShowBootstrapChat,
  createClientGeneratedId,
  getRootNodeId,
  getNodeLevel,
  willCreateCycle,
  showLinkValidationMessage,
}) => {
  const handlePlaceholderCreate = useCallback((parentNodeId, keywords) => {
    if (!Array.isArray(keywords) || keywords.length === 0) return [];
    const parentExists = data.nodes.some((node) => node.id === parentNodeId);
    if (!parentExists) return [];

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
      return [];
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

    return placeholderNodes.map((node) => node.id);
  }, [data, getNodeLevel, setConversationForNode, setData, showLinkValidationMessage, willCreateCycle]);

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
  }, [createClientGeneratedId, dataRef, getRootNodeId, requestUserInput, setConversationForNode, setData, showLinkValidationMessage, willCreateCycle]);

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

    setShowBootstrapChat(false);
    return newNodeId;
  }, [createClientGeneratedId, dataRef, setConversationForNode, setData, setShowBootstrapChat]);

  const handleManualLinkCreate = useCallback((sourceNodeId, targetNodeId) => {
    if (!sourceNodeId || !targetNodeId) {
      return null;
    }

    const latestData = dataRef.current;

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
      const source = normalizeId(link.source);
      const target = normalizeId(link.target);
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
  }, [dataRef, setData, showLinkValidationMessage]);

  return {
    handlePlaceholderCreate,
    handleManualNodeCreate,
    handleManualRootCreate,
    handleManualLinkCreate,
  };
};

export default useHierarchicalTreeCreation;
