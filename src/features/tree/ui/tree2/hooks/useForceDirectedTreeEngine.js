import { useCallback, useEffect, useRef, useState } from 'react';
import DataTransformService from 'features/tree/services/DataTransformService';
import ForceSimulationService from 'features/tree/services/ForceSimulationService';
import { loadTreeViewportState, saveTreeViewportState } from 'infrastructure/supabase/services/treeService';

const DEFAULT_TRANSFORM = (centerX, centerY) => ({ x: centerX, y: centerY, k: 1 });

const buildCenter = (dimensions = {}) => ({
    x: (dimensions.width || 0) / 2,
    y: (dimensions.height || 0) / 2,
});

export const useForceDirectedTreeEngine = ({
    data,
    dimensions,
    hierarchicalLinks,
    treeId,
    userId,
    isForceSimulationEnabled,
    getNodeDatum,
    previousPositionsRef,
    simulationServiceRef,
}) => {
    const { x: centerX, y: centerY } = buildCenter(dimensions);
    const [simulatedNodes, setSimulatedNodes] = useState([]);
    const [simulatedLinks, setSimulatedLinks] = useState([]);
    const simulatedNodesRef = useRef([]);
    const [viewportStateLoaded, setViewportStateLoaded] = useState(false);
    const [viewTransform, setViewTransform] = useState(() => DEFAULT_TRANSFORM(centerX, centerY));
    const saveViewportStateTimeoutRef = useRef(null);

    const assignFallbackPositions = useCallback((nodes = []) => {
        if (!Array.isArray(nodes)) {
            return [];
        }

        const cloned = nodes.map((node) => ({ ...node }));
        const levelMap = new Map();

        cloned.forEach((node) => {
            const level = Number.isFinite(node.level) ? node.level : 0;
            if (!levelMap.has(level)) {
                levelMap.set(level, []);
            }
            levelMap.get(level).push(node);
        });

        levelMap.forEach((items, level) => {
            const radius = 200 + level * 120;
            const sorted = [...items].sort((a, b) => {
                const aId = (a.id || '').toString();
                const bId = (b.id || '').toString();
                return aId.localeCompare(bId);
            });
            const count = sorted.length || 1;
            const angleOffset = Math.random() * Math.PI * 2;

            sorted.forEach((node, index) => {
                if (Number.isFinite(node.x) && Number.isFinite(node.y)) {
                    return;
                }
                const angle = angleOffset + (index / count) * Math.PI * 2;
                const jitterX = (Math.random() - 0.5) * 50;
                const jitterY = (Math.random() - 0.5) * 50;
                node.x = Math.cos(angle) * radius + jitterX;
                node.y = Math.sin(angle) * radius + jitterY;
            });
        });

        return cloned;
    }, []);

    const saveViewportState = useCallback(async () => {
        if (!treeId || !userId || !viewportStateLoaded) {
            return;
        }

        try {
            const nodePositions = {};

            simulatedNodesRef.current.forEach((node) => {
                const datum = getNodeDatum(node);
                const nodeId = datum?.id || node.id;
                if (nodeId && Number.isFinite(node.x) && Number.isFinite(node.y)) {
                    nodePositions[nodeId] = { x: node.x, y: node.y };
                }
            });

            if (Object.keys(nodePositions).length === 0 && previousPositionsRef.current.size > 0) {
                previousPositionsRef.current.forEach((position, nodeId) => {
                    if (Number.isFinite(position.x) && Number.isFinite(position.y)) {
                        nodePositions[nodeId] = {
                            x: position.x,
                            y: position.y,
                        };
                    }
                });
            }

            const viewportData = { nodePositions };

            await saveTreeViewportState({
                treeId,
                userId,
                viewportData,
            });
        } catch (error) {
            console.warn('뷰포트 상태 저장 실패:', error);
        }
    }, [treeId, userId, viewportStateLoaded, getNodeDatum, previousPositionsRef]);

    const loadViewportState = useCallback(async () => {
        if (!treeId || !userId || viewportStateLoaded) {
            return;
        }

        try {
            const savedState = await loadTreeViewportState({ treeId, userId });

            if (savedState?.nodePositions) {
                previousPositionsRef.current = new Map(Object.entries(savedState.nodePositions));
            }
            setViewportStateLoaded(true);
        } catch (error) {
            console.warn('뷰포트 상태 복원 실패:', error);
            setViewportStateLoaded(true);
        }
    }, [treeId, userId, viewportStateLoaded, previousPositionsRef]);

    const debouncedSaveViewportState = useCallback(() => {
        if (saveViewportStateTimeoutRef.current) {
            clearTimeout(saveViewportStateTimeoutRef.current);
        }
        saveViewportStateTimeoutRef.current = setTimeout(() => {
            saveViewportState();
        }, 1000);
    }, [saveViewportState]);

    useEffect(() => {
        if (treeId && userId && !viewportStateLoaded) {
            loadViewportState();
        }
    }, [treeId, userId, viewportStateLoaded, loadViewportState]);

    useEffect(() => {
        if (!data?.nodes || data.nodes.length === 0) {
            previousPositionsRef.current = new Map();
            simulatedNodesRef.current = [];
            setSimulatedNodes([]);
            setSimulatedLinks([]);
            return;
        }

        if (treeId && userId && !viewportStateLoaded) {
            return;
        }

        if (!simulationServiceRef.current) {
            simulationServiceRef.current = new ForceSimulationService();
        }

        const preparedNodes = assignFallbackPositions(data.nodes);
        const hierarchyData = DataTransformService?.transformToHierarchy(
            preparedNodes,
            hierarchicalLinks,
        );

        if (!hierarchyData) {
            previousPositionsRef.current = new Map();
            simulatedNodesRef.current = [];
            setSimulatedNodes([]);
            setSimulatedLinks([]);
            return;
        }

        const previousPositions = previousPositionsRef.current || new Map();
        if (previousPositions.size === 0) {
            preparedNodes.forEach((node) => {
                if (node?.id && Number.isFinite(node.x) && Number.isFinite(node.y)) {
                    previousPositions.set(node.id, { x: node.x, y: node.y });
                }
            });
        }

        const handleTick = (nodes, links) => {
            const nextMap = new Map(previousPositionsRef.current);
            nodes.forEach((node) => {
                const datum = getNodeDatum(node);
                if (datum?.id) {
                    nextMap.set(datum.id, { x: node.x || 0, y: node.y || 0 });
                }
            });
            previousPositionsRef.current = nextMap;
            const nextNodeList = [...nodes];
            simulatedNodesRef.current = nextNodeList;
            setSimulatedNodes(nextNodeList);
            setSimulatedLinks([...links]);
        };

        const { nodes: nextNodes, links: nextLinks } = simulationServiceRef.current.createSimulation(
            hierarchyData,
            dimensions,
            handleTick,
            previousPositions,
            { enableForceSimulation: isForceSimulationEnabled },
        );

        if (Array.isArray(nextNodes)) {
            previousPositionsRef.current = new Map(
                nextNodes
                    .map((node) => {
                        const datum = getNodeDatum(node);
                        return datum?.id ? [datum.id, { x: node.x || 0, y: node.y || 0 }] : null;
                    })
                    .filter(Boolean),
            );
            const seededNodes = [...nextNodes];
            simulatedNodesRef.current = seededNodes;
            setSimulatedNodes(seededNodes);
        } else {
            previousPositionsRef.current = new Map();
            simulatedNodesRef.current = [];
            setSimulatedNodes([]);
        }

        setSimulatedLinks(Array.isArray(nextLinks) ? [...nextLinks] : []);

        return () => {
            if (simulationServiceRef.current) {
                simulationServiceRef.current.cleanup();
            }
            if (viewportStateLoaded) {
                saveViewportState();
            }
            if (saveViewportStateTimeoutRef.current) {
                clearTimeout(saveViewportStateTimeoutRef.current);
            }
        };
    }, [
        data,
        dimensions,
        hierarchicalLinks,
        viewportStateLoaded,
        treeId,
        userId,
        assignFallbackPositions,
        getNodeDatum,
        isForceSimulationEnabled,
        previousPositionsRef,
        simulationServiceRef,
        saveViewportState,
    ]);

    useEffect(() => {
        if (!viewportStateLoaded) {
            return;
        }
        debouncedSaveViewportState();
    }, [simulatedNodes, debouncedSaveViewportState, viewportStateLoaded]);

    useEffect(() => () => {
        if (saveViewportStateTimeoutRef.current) {
            clearTimeout(saveViewportStateTimeoutRef.current);
        }
    }, []);

    return {
        simulatedNodes,
        simulatedLinks,
        setSimulatedNodes,
        viewTransform,
        setViewTransform,
        viewportStateLoaded,
    };
};

export default useForceDirectedTreeEngine;
