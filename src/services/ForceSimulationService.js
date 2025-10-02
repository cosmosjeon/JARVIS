import * as d3 from 'd3';

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
            // 즉시 최종 위치로 설정하고 콜백 호출
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
