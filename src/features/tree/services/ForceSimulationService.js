import * as d3 from 'd3';

const EDGE_FORCE_DEFAULTS = Object.freeze({
    sampleRatios: [0.18, 0.36, 0.54, 0.72, 0.9],
    nodePadding: 68,
    linePadding: 92,
    nodeStrength: 1.2,
    lineStrength: 0.85,
    counterForceRatio: 0.62,
    sharedNodeStrengthFactor: 0.48,
    intersectionBoost: 2.4,
    fallbackRadius: 24,
});

const MIN_SIZE_SCALE = 0.1;
const MAX_NODE_RADIUS_SCALE = 4;

const NODE_CHARGE_STRENGTH = Object.freeze({
    memo: -35,
    default: -130,
    root: -3200,
});

const RADIAL_FORCE_CONFIG = Object.freeze({
    rootRadius: 0,
    childRadius: 140,
    grandchildRadius: 280,
    fallbackGap: 140,
    strength: 0.24,
});

const OUTWARD_LINK_DISTANCE = Object.freeze({
    memo: 18,
    rootChild: 140,
    grandChild: 140,
    leaf: 140,
    branch: 140,
});

const ANGLE_FORCE_CONFIG = Object.freeze({
    defaultStrength: 0.34,
    memoStrength: 0.12,
    siblingPadding: 0.05,
});

const applyVelocity = (node, vx, vy) => {
    if (!node) {
        return;
    }
    node.vx = (node.vx || 0) + vx;
    node.vy = (node.vy || 0) + vy;
};

const computeNodeRadius = (datum, fallback) => {
    if (!datum || typeof datum !== 'object') {
        return fallback;
    }
    if (datum.nodeShape === 'dot') {
        return 4;
    }
    const base = (datum.nodeType === 'memo' || (Number.isFinite(datum.level) && datum.level === 0)) ? 18 : 14;
    const sliderScale = typeof datum.sizeValue === 'number'
        ? Math.max(MIN_SIZE_SCALE, datum.sizeValue / 50)
        : 1;
    const descendantScale = Number.isFinite(datum.descendantSizeScale)
        ? Math.max(1, datum.descendantSizeScale)
        : 1;
    const combinedScale = Math.min(MAX_NODE_RADIUS_SCALE, sliderScale * descendantScale);
    return base * combinedScale;
};

const buildSampleCache = (linkCount, sampleCount) => (
    Array.from({ length: linkCount }, () => (
        Array.from({ length: sampleCount }, () => ({ x: 0, y: 0 }))
    ))
);

const computeSamplePosition = (link, ratio) => {
    const startX = Number.isFinite(link?.source?.x) ? link.source.x : 0;
    const startY = Number.isFinite(link?.source?.y) ? link.source.y : 0;
    const endX = Number.isFinite(link?.target?.x) ? link.target.x : 0;
    const endY = Number.isFinite(link?.target?.y) ? link.target.y : 0;
    return {
        x: startX + (endX - startX) * ratio,
        y: startY + (endY - startY) * ratio,
    };
};

const updateSampleCache = (links, ratios, cache) => {
    links.forEach((link, linkIndex) => {
        const samples = cache[linkIndex];
        ratios.forEach((ratio, sampleIndex) => {
            const position = computeSamplePosition(link, ratio);
            samples[sampleIndex].x = position.x;
            samples[sampleIndex].y = position.y;
        });
    });
};

const rebuildNodeRadiusCache = (nodes, resolveDatum, cache, fallbackRadius) => {
    cache.clear();
    nodes.forEach((node) => {
        const datum = resolveDatum(node);
        cache.set(node, computeNodeRadius(datum, fallbackRadius));
    });
};

const sharesEndpoint = (linkA, linkB) => (
    linkA.source === linkB.source
    || linkA.source === linkB.target
    || linkA.target === linkB.source
    || linkA.target === linkB.target
);

const orientationSign = (ax, ay, bx, by, cx, cy) => {
    const value = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    if (value > 0) return 1;
    if (value < 0) return -1;
    return 0;
};

const isBetween = (value, min, max) => value >= Math.min(min, max) && value <= Math.max(min, max);

const onSegment = (px, py, qx, qy, rx, ry) => (
    isBetween(qx, px, rx)
    && isBetween(qy, py, ry)
);

const getSegmentPoints = (link) => ({
    start: {
        x: Number.isFinite(link?.source?.x) ? link.source.x : 0,
        y: Number.isFinite(link?.source?.y) ? link.source.y : 0,
    },
    end: {
        x: Number.isFinite(link?.target?.x) ? link.target.x : 0,
        y: Number.isFinite(link?.target?.y) ? link.target.y : 0,
    },
});

const segmentsIntersect = (linkA, linkB) => {
    if (sharesEndpoint(linkA, linkB)) {
        return false;
    }
    const segmentA = getSegmentPoints(linkA);
    const segmentB = getSegmentPoints(linkB);

    const o1 = orientationSign(segmentA.start.x, segmentA.start.y, segmentA.end.x, segmentA.end.y, segmentB.start.x, segmentB.start.y);
    const o2 = orientationSign(segmentA.start.x, segmentA.start.y, segmentA.end.x, segmentA.end.y, segmentB.end.x, segmentB.end.y);
    const o3 = orientationSign(segmentB.start.x, segmentB.start.y, segmentB.end.x, segmentB.end.y, segmentA.start.x, segmentA.start.y);
    const o4 = orientationSign(segmentB.start.x, segmentB.start.y, segmentB.end.x, segmentB.end.y, segmentA.end.x, segmentA.end.y);

    if (o1 !== o2 && o3 !== o4) {
        return true;
    }

    if (o1 === 0 && onSegment(segmentA.start.x, segmentA.start.y, segmentB.start.x, segmentB.start.y, segmentA.end.x, segmentA.end.y)) return true;
    if (o2 === 0 && onSegment(segmentA.start.x, segmentA.start.y, segmentB.end.x, segmentB.end.y, segmentA.end.x, segmentA.end.y)) return true;
    if (o3 === 0 && onSegment(segmentB.start.x, segmentB.start.y, segmentA.start.x, segmentA.start.y, segmentB.end.x, segmentB.end.y)) return true;
    if (o4 === 0 && onSegment(segmentB.start.x, segmentB.start.y, segmentA.end.x, segmentA.end.y, segmentB.end.x, segmentB.end.y)) return true;

    return false;
};

const pushNodeAwayFromSample = (node, link, sample, nodeRadius, config, alpha) => {
    const nodeX = Number.isFinite(node?.x) ? node.x : 0;
    const nodeY = Number.isFinite(node?.y) ? node.y : 0;
    const dx = nodeX - sample.x;
    const dy = nodeY - sample.y;
    const distance = Math.hypot(dx, dy);
    const padding = nodeRadius + config.nodePadding;

    if (!Number.isFinite(distance) || distance === 0 || distance >= padding) {
        return;
    }

    const overlap = padding - distance;
    const strength = (overlap / padding) * config.nodeStrength * alpha;
    const unitX = dx / distance;
    const unitY = dy / distance;

    applyVelocity(node, unitX * strength, unitY * strength);

    const counter = strength * config.counterForceRatio;
    applyVelocity(link.source, -unitX * counter, -unitY * counter);
    applyVelocity(link.target, -unitX * counter, -unitY * counter);
};

const applyLinkSampleRepulsion = (sampleA, sampleB, linkA, linkB, padding, strength, alpha) => {
    const dx = sampleB.x - sampleA.x;
    const dy = sampleB.y - sampleA.y;
    const distance = Math.hypot(dx, dy);

    if (!Number.isFinite(distance) || distance === 0 || distance >= padding) {
        return;
    }

    const overlap = padding - distance;
    const scaled = (overlap / padding) * strength * alpha;
    const unitX = dx / distance;
    const unitY = dy / distance;

    applyVelocity(linkA.source, -unitX * scaled, -unitY * scaled);
    applyVelocity(linkA.target, -unitX * scaled, -unitY * scaled);
    applyVelocity(linkB.source, unitX * scaled, unitY * scaled);
    applyVelocity(linkB.target, unitX * scaled, unitY * scaled);
};

const applyNodeLineForces = (params) => {
    const { nodes, links, sampleCache, config, alpha, nodeRadiusByNode } = params;
    nodes.forEach((node) => {
        const radius = nodeRadiusByNode.get(node) || config.fallbackRadius;
        links.forEach((link, linkIndex) => {
            if (link.source === node || link.target === node) {
                return;
            }
            sampleCache[linkIndex].forEach((sample) => {
                pushNodeAwayFromSample(node, link, sample, radius, config, alpha);
            });
        });
    });
};

const processLinkPair = ({ linkA, linkB, samplesA, samplesB, config, alpha }) => {
    const baseMultiplier = sharesEndpoint(linkA, linkB) ? config.sharedNodeStrengthFactor : 1;
    const baseStrength = config.lineStrength * baseMultiplier;
    if (baseStrength <= 0) {
        return;
    }
    const boost = segmentsIntersect(linkA, linkB) ? config.intersectionBoost : 1;
    const effectiveStrength = baseStrength * boost;
    samplesA.forEach((sampleA) => {
        samplesB.forEach((sampleB) => {
            applyLinkSampleRepulsion(sampleA, sampleB, linkA, linkB, config.linePadding, effectiveStrength, alpha);
        });
    });
};

const applyLinkPairForces = (params) => {
    const { links, sampleCache, config, alpha } = params;
    for (let i = 0; i < links.length; i += 1) {
        for (let j = i + 1; j < links.length; j += 1) {
            processLinkPair({
                linkA: links[i],
                linkB: links[j],
                samplesA: sampleCache[i],
                samplesB: sampleCache[j],
                config,
                alpha,
            });
        }
    }
};

const runEdgeRepulsionStep = (context) => {
    const { alpha, links, sampleCache, config, nodes, resolveDatum, nodeRadiusByNode } = context;
    updateSampleCache(links, config.sampleRatios, sampleCache);
    rebuildNodeRadiusCache(nodes, resolveDatum, nodeRadiusByNode, config.fallbackRadius);
    applyNodeLineForces({
        nodes,
        links,
        sampleCache,
        config,
        alpha,
        nodeRadiusByNode,
    });
    applyLinkPairForces({
        links,
        sampleCache,
        config,
        alpha,
    });
};

const createEdgeForceWithContext = (context) => {
    let nodesRef = [];
    const force = (alpha) => {
        if (!nodesRef.length) {
            return;
        }
        runEdgeRepulsionStep({ ...context, alpha, nodes: nodesRef });
    };
    force.initialize = (simulationNodes) => {
        nodesRef = Array.isArray(simulationNodes) ? simulationNodes : [];
    };
    return force;
};

const createLinkRepulsionForce = (links, resolveDatum, options = {}) => {
    if (options && options.enabled === false) {
        return null;
    }
    if (!Array.isArray(links) || links.length === 0) {
        return null;
    }

    const config = { ...EDGE_FORCE_DEFAULTS, ...options };
    const context = {
        links,
        resolveDatum,
        config,
        sampleCache: buildSampleCache(links.length, config.sampleRatios.length),
        nodeRadiusByNode: new Map(),
    };

    return createEdgeForceWithContext(context);
};

/**
 * ForceSimulationService
 * 
 * Business Logic: D3 Force Simulation 관리
 * Force-directed layout 시뮬레이션 생성 및 제어
 */

class ForceSimulationService {
    constructor() {
        this.simulation = null;
        this.onTickCallback = null;
    }

    /**
     * Force simulation 생성
     * @param {Object} hierarchyData - D3 hierarchy 데이터
     * @param {Object} dimensions - {width, height}
     * @param {Function} onTick - tick 이벤트 콜백
     * @param {Map} previousPositions - 이전 위치 정보
     * @param {Object} options - 옵션 (enableForceSimulation 등)
     * @returns {Object} {nodes, links} - simulation 적용된 데이터
     */
    createSimulation(hierarchyData, dimensions = { width: 928, height: 600 }, onTick = null, previousPositions = new Map(), options = {}) {
        if (!hierarchyData) {
            return { nodes: [], links: [] };
        }

        const root = d3.hierarchy(hierarchyData);
        let links = root.links();
        let nodes = root.descendants();

        const isVirtualRoot = (entry) => {
            const candidate = entry?.data?.id || entry?.id || entry?.data?.data?.id;
            return candidate === '__virtual_root__';
        };

        nodes = nodes.filter((node) => !isVirtualRoot(node));
        links = links.filter((link) => !isVirtualRoot(link.source) && !isVirtualRoot(link.target));

        nodes.forEach((node, index) => {
            node.index = index;
        });

        const enableForceSimulation = options.enableForceSimulation !== false;

        this.cleanup();

        const resolveDatum = (item) => {
            if (!item) return {};
            if (item.data && item.data.data) {
                return item.data.data;
            }
            return item.data || item;
        };

        const buildAngleMap = (hierarchyNode) => {
            const map = new Map();

            const assign = (node, startAngle, endAngle) => {
                if (!node) {
                    return;
                }

                const children = Array.isArray(node.children)
                    ? node.children.filter((child) => !isVirtualRoot(child))
                    : [];

                if (!isVirtualRoot(node)) {
                    const datum = resolveDatum(node);
                    const nodeId = datum?.id || node.data?.id;
                    if (nodeId) {
                        map.set(nodeId, (startAngle + endAngle) / 2);
                    }
                }

                if (!children.length) {
                    return;
                }

                const span = endAngle - startAngle;
                const baseSlice = span / Math.max(children.length, 1);

                children.forEach((child, index) => {
                    const effectivePadding = Math.min(ANGLE_FORCE_CONFIG.siblingPadding, baseSlice / 3);
                    const childStart = startAngle + (index * baseSlice) + effectivePadding;
                    const childEnd = startAngle + ((index + 1) * baseSlice) - effectivePadding;
                    assign(child, childStart, childEnd);
                });
            };

            assign(hierarchyNode, 0, Math.PI * 2);
            return map;
        };

        const angleByNodeId = buildAngleMap(root);

        const resolveNodeLevel = (node, datum) => {
            if (Number.isFinite(datum?.level)) {
                return datum.level;
            }
            if (Number.isFinite(node?.depth)) {
                return node.depth;
            }
            return 0;
        };

        const isRootNode = (node, datum) => resolveNodeLevel(node, datum) === 0;

        const computeRadialRadius = (node) => {
            const datum = resolveDatum(node);
            const level = resolveNodeLevel(node, datum);
            if (level <= 0) {
                return RADIAL_FORCE_CONFIG.rootRadius;
            }
            if (level === 1) {
                return RADIAL_FORCE_CONFIG.childRadius;
            }
            if (level === 2) {
                return RADIAL_FORCE_CONFIG.grandchildRadius;
            }
            return RADIAL_FORCE_CONFIG.grandchildRadius + ((level - 2) * RADIAL_FORCE_CONFIG.fallbackGap);
        };

        const computeLinkDistance = (link) => {
            const sourceDatum = resolveDatum(link?.source);
            const targetDatum = resolveDatum(link?.target);
            if (targetDatum?.nodeType === 'memo') {
                return OUTWARD_LINK_DISTANCE.memo;
            }
            const sourceLevel = resolveNodeLevel(link?.source, sourceDatum);
            const targetLevel = resolveNodeLevel(link?.target, targetDatum);
            if (sourceLevel === 0 && targetLevel === 1) {
                return OUTWARD_LINK_DISTANCE.rootChild;
            }
            if (sourceLevel === 1 && targetLevel === 2) {
                return OUTWARD_LINK_DISTANCE.grandChild;
            }

            const targetChildren = Array.isArray(targetDatum?.children)
                ? targetDatum.children.length
                : (Number.isFinite(targetDatum?.childCount) ? targetDatum.childCount : 0);

            if (!targetChildren) {
                return OUTWARD_LINK_DISTANCE.leaf;
            }

            return OUTWARD_LINK_DISTANCE.branch;
        };

        const computeLinkStrength = (link) => {
            const targetDatum = resolveDatum(link?.target);
            if (targetDatum?.nodeType === 'memo') {
                return 3.1;
            }

            const sourceDatum = resolveDatum(link?.source);
            const sourceLevel = resolveNodeLevel(link?.source, sourceDatum);
            const targetLevel = resolveNodeLevel(link?.target, targetDatum);
            if (sourceLevel === 0 && targetLevel === 1) {
                return 0.95;
            }
            if (sourceLevel === 1 && targetLevel === 2) {
                return 0.78;
            }

            const targetChildren = Array.isArray(targetDatum?.children)
                ? targetDatum.children.length
                : (Number.isFinite(targetDatum?.childCount) ? targetDatum.childCount : 0);

            if (!targetChildren) {
                return 0.68;
            }

            return 0.5;
        };

        const targetPositionByNodeId = new Map();
        nodes.forEach((node) => {
            const datum = resolveDatum(node);
            const nodeId = datum?.id;
            if (!nodeId) {
                return;
            }
            const angle = angleByNodeId.get(nodeId);
            if (!Number.isFinite(angle)) {
                return;
            }
            const radius = computeRadialRadius(node);
            targetPositionByNodeId.set(nodeId, {
                x: Math.cos(angle) * radius,
                y: Math.sin(angle) * radius,
            });
        });

        const positionLookup = previousPositions instanceof Map
            ? previousPositions
            : new Map();

        let restoredCount = 0;
        nodes.forEach((node) => {
            const datum = resolveDatum(node);
            const nodeId = datum?.id;
            if (!nodeId) {
                return;
            }

            if (positionLookup.has(nodeId)) {
                const { x, y } = positionLookup.get(nodeId);
                if (Number.isFinite(x) && Number.isFinite(y)) {
                    node.x = x;
                    node.y = y;
                    node.vx = 0;
                    node.vy = 0;
                    restoredCount += 1;
                    console.log(`노드 위치 복원: ${nodeId} -> (${x}, ${y})`);
                    return;
                }
            }

            if (Number.isFinite(datum?.x) && Number.isFinite(datum?.y)) {
                node.x = datum.x;
                node.y = datum.y;
                node.vx = 0;
                node.vy = 0;
                return;
            }

            const target = targetPositionByNodeId.get(nodeId);
            if (target) {
                node.x = target.x;
                node.y = target.y;
                node.vx = 0;
                node.vy = 0;
            }
        });

        if (restoredCount > 0) {
            console.log(`총 ${restoredCount}개 노드 위치 복원 완료`);
        }

        const linkForce = d3.forceLink(links)
            .id((d) => d.id || d.data.id)
            .distance((link) => computeLinkDistance(link))
            .strength((link) => computeLinkStrength(link));

        const chargeForce = d3.forceManyBody().strength((node) => {
            const datum = resolveDatum(node);
            if (datum?.nodeType === 'memo') {
                return NODE_CHARGE_STRENGTH.memo;
            }
            if (isRootNode(node, datum)) {
                return NODE_CHARGE_STRENGTH.root;
            }
            return NODE_CHARGE_STRENGTH.default;
        });

        const collisionForce = d3.forceCollide((node) => {
            const nodeType = resolveDatum(node)?.nodeType;
            if (nodeType === 'memo') {
                return 18;
            }
            return 36;
        }).strength(0.9);

        const forceX = d3.forceX((node) => {
            const datum = resolveDatum(node);
            const nodeId = datum?.id;
            if (nodeId && targetPositionByNodeId.has(nodeId)) {
                return targetPositionByNodeId.get(nodeId).x;
            }
            if (Number.isFinite(datum?.x)) {
                return datum.x;
            }
            return 0;
        }).strength((node) => (
            resolveDatum(node)?.nodeType === 'memo'
                ? ANGLE_FORCE_CONFIG.memoStrength
                : ANGLE_FORCE_CONFIG.defaultStrength
        ));

        const forceY = d3.forceY((node) => {
            const datum = resolveDatum(node);
            const nodeId = datum?.id;
            if (nodeId && targetPositionByNodeId.has(nodeId)) {
                return targetPositionByNodeId.get(nodeId).y;
            }
            if (Number.isFinite(datum?.y)) {
                return datum.y;
            }
            return 0;
        }).strength((node) => (
            resolveDatum(node)?.nodeType === 'memo'
                ? ANGLE_FORCE_CONFIG.memoStrength
                : ANGLE_FORCE_CONFIG.defaultStrength
        ));

        const radialForce = d3.forceRadial((node) => computeRadialRadius(node), 0, 0)
            .strength(RADIAL_FORCE_CONFIG.strength);

        if (!enableForceSimulation) {
            if (onTick && typeof onTick === 'function') {
                onTick(nodes, links);
            }
            return { nodes, links };
        }

        this.simulation = d3.forceSimulation(nodes)
            .force('link', linkForce)
            .force('charge', chargeForce)
            .force('collide', collisionForce)
            .force('x', forceX)
            .force('y', forceY)
            .force('radial', radialForce)
            .force('center', d3.forceCenter(0, 0));

        const edgeRepulsionForce = createLinkRepulsionForce(links, resolveDatum, options.edgeRepulsion);
        if (edgeRepulsionForce) {
            this.simulation.force('edge-repulsion', edgeRepulsionForce);
        }

        if (onTick && typeof onTick === 'function') {
            this.onTickCallback = onTick;
            this.simulation.on('tick', () => {
                onTick(nodes, links);
            });
        }

        if (this.simulation) {
            this.simulation.alpha(0.6).restart();
        }

        return { nodes, links };
    }

    /**
     * Simulation 재시작
     * @param {number} alpha - 시작 alpha 값 (기본: 0.3)
     */
    restart(alpha = 0.3) {
        if (this.simulation) {
            this.simulation.alpha(alpha).restart();
        }
    }

    /**
     * Simulation 중지
     */
    stop() {
        if (this.simulation) {
            this.simulation.stop();
        }
    }

    /**
     * 드래그 시작 핸들러
     * @param {Object} event - 드래그 이벤트
     * @param {Object} d - 노드 데이터
     */
    handleDragStart(event, d) {
        if (!event.active && this.simulation) {
            this.simulation.alphaTarget(0.3).restart();
        }
        // 현재 노드 위치를 고정 (이미 렌더링된 위치 유지)
        // d.x, d.y가 이미 올바른 값이므로 그대로 고정
        d.fx = d.x;
        d.fy = d.y;
    }

    /**
     * 드래그 중 핸들러
     * @param {Object} event - 드래그 이벤트
     * @param {Object} d - 노드 데이터
     */
    handleDrag(event, d) {
        if (this.simulation) {
            d.fx = event.x;
            d.fy = event.y;
        } else {
            d.x = event.x;
            d.y = event.y;
            d.fx = event.x;
            d.fy = event.y;
        }
    }

    /**
     * 드래그 종료 핸들러
     * @param {Object} event - 드래그 이벤트
     * @param {Object} d - 노드 데이터
     */
    handleDragEnd(event, d) {
        if (this.simulation) {
            if (!event.active) {
                this.simulation.alphaTarget(0);
            }
            d.fx = null;
            d.fy = null;
        } else {
            d.fx = d.x;
            d.fy = d.y;
        }
    }

    /**
     * 리소스 정리
     */
    cleanup() {
        if (this.simulation) {
            this.simulation.stop();
            this.simulation.on('tick', null);
            this.simulation = null;
        }
        this.onTickCallback = null;
    }

    /**
     * 현재 simulation 인스턴스 반환
     * @returns {Object} D3 simulation 인스턴스
     */
    getSimulation() {
        return this.simulation;
    }
}

export default ForceSimulationService;
