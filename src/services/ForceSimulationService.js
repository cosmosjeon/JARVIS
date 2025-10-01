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
     * @returns {Object} {nodes, links} - simulation 적용된 데이터
     */
    createSimulation(hierarchyData, dimensions = { width: 928, height: 600 }, onTick = null) {
        if (!hierarchyData) {
            return { nodes: [], links: [] };
        }

        // Hierarchy를 nodes/links로 변환
        const root = d3.hierarchy(hierarchyData);
        const links = root.links();
        const nodes = root.descendants();

        // 각 노드에 고유 ID 부여 (simulation용)
        nodes.forEach((node, i) => {
            node.index = i;
        });

        // 기존 simulation 정리
        this.cleanup();

        const resolveDatum = (item) => {
            if (!item) return {};
            if (item.data && item.data.data) {
                return item.data.data;
            }
            return item.data || item;
        };

        // Force simulation 생성
        const linkForce = d3.forceLink(links)
            .id(d => d.id || d.data.id)
            .distance((link) => {
                const targetType = resolveDatum(link?.target)?.nodeType;
                if (targetType === 'memo') {
                    return 32; // 메모 노드는 부모와 매우 가까이 유지
                }
                return 110;
            })
            .strength((link) => {
                const targetType = resolveDatum(link?.target)?.nodeType;
                if (targetType === 'memo') {
                    return 2.2; // 메모 노드는 부모에 강하게 붙음
                }
                return 1;
            });

        const chargeForce = d3.forceManyBody().strength((d) => {
            const nodeType = resolveDatum(d)?.nodeType;
            if (nodeType === 'memo') {
                return -50; // 메모 노드는 다른 노드로부터 덜 밀림
            }
            return -320;
        });

        const collisionForce = d3.forceCollide((d) => {
            const nodeType = resolveDatum(d)?.nodeType;
            if (nodeType === 'memo') {
                return 18; // 메모 노드는 작은 충돌 영역
            }
            return 28;
        }).strength(0.85);

        this.simulation = d3.forceSimulation(nodes)
            .force('link', linkForce)
            .force('charge', chargeForce)
            .force('collide', collisionForce)
            .force('x', d3.forceX(0).strength((d) => (resolveDatum(d)?.nodeType === 'memo' ? 0.015 : 0.05)))
            .force('y', d3.forceY(0).strength((d) => (resolveDatum(d)?.nodeType === 'memo' ? 0.015 : 0.05)))
            .force('center', d3.forceCenter(0, 0));

        // Tick 콜백 등록
        if (onTick && typeof onTick === 'function') {
            this.onTickCallback = onTick;
            this.simulation.on('tick', () => {
                onTick(nodes, links);
            });
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
        d.fx = event.x;
        d.fy = event.y;
    }

    /**
     * 드래그 종료 핸들러
     * @param {Object} event - 드래그 이벤트
     * @param {Object} d - 노드 데이터
     */
    handleDragEnd(event, d) {
        if (!event.active && this.simulation) {
            this.simulation.alphaTarget(0);
        }
        d.fx = null;
        d.fy = null;
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
