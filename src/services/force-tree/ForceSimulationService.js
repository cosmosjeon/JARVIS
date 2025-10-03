import * as d3 from 'd3';

export const FORCE_SIMULATION_DEFAULTS = Object.freeze({
    initialAlpha: 0.6,
    alphaMin: 0.015,
    alphaDecay: 0.08,
    velocityDecay: 0.58,
    autoStopAlphaThreshold: 0.035,
    autoStopTickCount: 28,
});

const {
    initialAlpha: DEFAULT_SIMULATION_ALPHA,
    alphaMin: DEFAULT_ALPHA_MIN,
    alphaDecay: DEFAULT_ALPHA_DECAY,
    velocityDecay: DEFAULT_VELOCITY_DECAY,
    autoStopAlphaThreshold: AUTO_STOP_ALPHA_THRESHOLD,
    autoStopTickCount: AUTO_STOP_TICK_COUNT,
} = FORCE_SIMULATION_DEFAULTS;

/**
 * ForceSimulationService
 *
 * Business Logic: D3 Force Simulation ����
 * Force-directed layout ������ ���
 */
class ForceSimulationService {
    constructor() {
        this.simulation = null;
        this.onTickCallback = null;
    }

    /**
     * Force simulation ����
     * @param {Object} hierarchyData - D3 hierarchy ������
     * @param {Object} dimensions - {width, height}
     * @param {Function} onTick - tick �̺�Ʈ �ݹ�
     * @param {Map} previousPositions - ���� ��ġ ����
     * @param {Object} options - �ɼ� (enableForceSimulation ��)
     * @returns {Object} {nodes, links} - simulation ��ȯ ������
     */
    createSimulation(
        hierarchyData,
        dimensions = { width: 928, height: 600 },
        onTick = null,
        previousPositions = new Map(),
        options = {},
    ) {
        if (!hierarchyData) {
            return { nodes: [], links: [] };
        }

        const {
            autoStopAlphaThreshold = AUTO_STOP_ALPHA_THRESHOLD,
            autoStopTickCount = AUTO_STOP_TICK_COUNT,
            initialAlpha = DEFAULT_SIMULATION_ALPHA,
            alphaMin = DEFAULT_ALPHA_MIN,
            alphaDecay = DEFAULT_ALPHA_DECAY,
            velocityDecay = DEFAULT_VELOCITY_DECAY,
        } = options;

        const enableForceSimulation = options.enableForceSimulation !== false;

        this.cleanup();

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

        const resolveDatum = (item) => {
            if (!item) {
                return {};
            }
            if (item.data && item.data.data) {
                return item.data.data;
            }
            return item.data || item;
        };

        const positionLookup = previousPositions instanceof Map ? previousPositions : new Map();

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
                    if (process.env.NODE_ENV === 'development') {
                        console.debug('[force] restore position', nodeId, x, y);
                    }
                }
            } else if (Number.isFinite(datum?.x) && Number.isFinite(datum?.y)) {
                node.x = datum.x;
                node.y = datum.y;
                node.vx = 0;
                node.vy = 0;
            }
        });

        if (restoredCount > 0 && process.env.NODE_ENV === 'development') {
            console.debug('[force] restored node positions', restoredCount);
        }

        const linkForce = d3.forceLink(links)
            .id((d) => d.id || d.data.id)
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
                    return 1.6;
                }

                return 0.9;
            });

        const chargeForce = d3.forceManyBody()
            .strength((node) => {
                const datum = resolveDatum(node);
                if (datum?.nodeType === 'memo') {
                    return -25;
                }
                if (datum?.level === 0) {
                    return -520;
                }
                if (datum?.level === 1) {
                    return -420;
                }
                if (datum?.level === 2) {
                    return -320;
                }
                return -260;
            })
            .theta(0.8)
            .distanceMin(12)
            .distanceMax(Math.max(dimensions.width, dimensions.height));

        const collisionForce = d3.forceCollide().radius((node) => {
            const datum = resolveDatum(node);
            if (datum?.nodeType === 'memo') {
                return 16;
            }
            return 40;
        });

        const forceX = d3.forceX(0).strength(0.025);
        const forceY = d3.forceY(0).strength(0.025);

        const radialForce = d3.forceRadial((node) => {
            const datum = resolveDatum(node);
            if (datum?.nodeType === 'memo') {
                return 120;
            }
            const level = Number.isFinite(datum?.level) ? datum.level : 0;
            return 420 + level * 240;
        }, 0, 0).strength(0.02);

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

        this.simulation
            .alphaDecay(alphaDecay)
            .alphaMin(alphaMin)
            .velocityDecay(velocityDecay);

        const safeOnTick = (typeof onTick === 'function') ? onTick : null;
        if (safeOnTick) {
            this.onTickCallback = safeOnTick;
            let stableTickCount = 0;
            let autoStopped = false;
            const shouldAutoStop = autoStopTickCount > 0 && autoStopAlphaThreshold > 0;

            this.simulation.on('tick', () => {
                safeOnTick(nodes, links);

                if (!shouldAutoStop || !this.simulation || autoStopped) {
                    return;
                }

                const currentAlpha = this.simulation.alpha();
                if (currentAlpha <= autoStopAlphaThreshold) {
                    stableTickCount += 1;
                    if (stableTickCount >= autoStopTickCount) {
                        this.simulation.alphaTarget(0);
                        this.simulation.alpha(0);
                        this.simulation.stop();
                        nodes.forEach((node) => {
                            node.vx = 0;
                            node.vy = 0;
                        });
                        autoStopped = true;
                    }
                } else {
                    stableTickCount = 0;
                }
            });
        }

        if (this.simulation) {
            this.simulation.alpha(initialAlpha).restart();
        }

        return { nodes, links };
    }

    /**
     * Simulation �ٽ� ����
     * @param {number} alpha - ���� alpha ��(�⺻: 0.3)
     */
    restart(alpha = 0.3) {
        if (this.simulation) {
            this.simulation.alpha(alpha).restart();
        }
    }

    /**
     * Simulation ����
     */
    stop() {
        if (this.simulation) {
            this.simulation.stop();
        }
    }

    /**
     * �巡�� ���� �ڵ鷯
     * @param {Object} event - �巡�� �̺�Ʈ
     * @param {Object} d - ��� ������
     */
    handleDragStart(event, d) {
        if (!event.active && this.simulation) {
            this.simulation.alphaTarget(0.3).restart();
        }
        d.fx = d.x;
        d.fy = d.y;
    }

    /**
     * �巡�� �� �ڵ鷯
     * @param {Object} event - �巡�� �̺�Ʈ
     * @param {Object} d - ��� ������
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
     * �巡�� ���� �ڵ鷯
     * @param {Object} event - �巡�� �̺�Ʈ
     * @param {Object} d - ��� ������
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
     * ���ҽ� ����
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
     * ���� simulation �ν��Ͻ� ��ȯ
     * @returns {Object} D3 simulation �ν��Ͻ�
     */
    getSimulation() {
        return this.simulation;
    }
}

export default ForceSimulationService;
