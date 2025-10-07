import * as d3 from 'd3';

const EDGE_FORCE_DEFAULTS = Object.freeze({
    sampleRatios: [0.33, 0.5, 0.67],
    nodePadding: 48,
    linePadding: 56,
    nodeStrength: 0.16,
    lineStrength: 0.12,
    counterForceRatio: 0.45,
    sharedNodeStrengthFactor: 0.35,
    intersectionBoost: 1.5,
    fallbackRadius: 16,
});

const MIN_SIZE_SCALE = 0.1;
const MAX_NODE_RADIUS_SCALE = 4;

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

        // Hierarchy를 nodes/links로 변환
        const root = d3.hierarchy(hierarchyData);
        let links = root.links();
        let nodes = root.descendants();

        const isVirtualRoot = (entry) => {
            const candidate = entry?.data?.id || entry?.id || entry?.data?.data?.id;
            return candidate === '__virtual_root__';
        };

        nodes = nodes.filter((node) => !isVirtualRoot(node));
        links = links.filter((link) => !isVirtualRoot(link.source) && !isVirtualRoot(link.target));

        // 각 노드에 고유 ID 부여 (simulation용)
        nodes.forEach((node, i) => {
            node.index = i;
        });

        // Force simulation 활성화 여부 확인
        const enableForceSimulation = options.enableForceSimulation !== false;
        
        // 기존 simulation 정리
        this.cleanup();

        const resolveDatum = (item) => {
            if (!item) return {};
            if (item.data && item.data.data) {
                return item.data.data;
            }
            return item.data || item;
        };

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
                    restoredCount++;
                    console.log(`노드 위치 복원: ${nodeId} -> (${x}, ${y})`);
                }
            } else if (Number.isFinite(datum?.x) && Number.isFinite(datum?.y)) {
                node.x = datum.x;
                node.y = datum.y;
                node.vx = 0;
                node.vy = 0;
            }

            // Force simulation이 비활성화된 경우에도 드래그를 위해 고정하지 않음
            // (노드들이 독립적으로 드래그 가능하도록 함)
        });

        if (restoredCount > 0) {
            console.log(`총 ${restoredCount}개 노드 위치 복원 완료`);
        }

        // Force simulation 생성
        const linkForce = d3.forceLink(links)
            .id(d => d.id || d.data.id)
            .distance((link) => {
                const targetDatum = resolveDatum(link?.target);
                if (targetDatum?.nodeType === 'memo') {
                    return 18;
                }

                const targetChildren = Array.isArray(targetDatum?.children)
                    ? targetDatum.children.length
                    : (Number.isFinite(targetDatum?.childCount) ? targetDatum.childCount : 0);

                if (!targetChildren) {
                    return 72;
                }

                return 108;
            })
            .strength((link) => {
                const targetDatum = resolveDatum(link?.target);
                if (targetDatum?.nodeType === 'memo') {
                    return 3.1;
                }

                const targetChildren = Array.isArray(targetDatum?.children)
                    ? targetDatum.children.length
                    : (Number.isFinite(targetDatum?.childCount) ? targetDatum.childCount : 0);

                if (!targetChildren) {
                    return 0.68;
                }

                return 0.5;
            });

        const chargeForce = d3.forceManyBody().strength((d) => {
            const nodeType = resolveDatum(d)?.nodeType;
            if (nodeType === 'memo') {
                return -35;
            }
            return -130;
        });

        const collisionForce = d3.forceCollide((d) => {
            const nodeType = resolveDatum(d)?.nodeType;
            if (nodeType === 'memo') {
                return 18;
            }
            return 36;
        }).strength(0.9);

        const forceX = d3.forceX((d) => {
            const datum = resolveDatum(d);
            if (Number.isFinite(datum?.x)) {
                return datum.x;
            }
            return 0;
        }).strength((d) => (resolveDatum(d)?.nodeType === 'memo' ? 0.0075 : 0.018));

        const forceY = d3.forceY((d) => {
            const datum = resolveDatum(d);
            if (Number.isFinite(datum?.y)) {
                return datum.y;
            }
            return 0;
        }).strength((d) => (resolveDatum(d)?.nodeType === 'memo' ? 0.0075 : 0.018));

        const radialForce = d3.forceRadial((d) => {
            const datum = resolveDatum(d);
            const level = Number.isFinite(datum?.level) ? datum.level : 0;
            return 420 + level * 240;
        }, 0, 0).strength(0.02);

        // Force simulation이 비활성화된 경우 simulation을 생성하지 않음
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

        // Tick 콜백 등록
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
