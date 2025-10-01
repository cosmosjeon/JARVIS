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
     * @param {Array} memos - 메모 배열 (선택사항)
     * @returns {Object} {nodes, links, memos} - simulation 적용된 데이터
     */
    createSimulation(hierarchyData, dimensions = { width: 928, height: 600 }, onTick = null, memos = []) {
        if (!hierarchyData) {
            return { nodes: [], links: [], memos: [] };
        }

        // Hierarchy를 nodes/links로 변환
        const root = d3.hierarchy(hierarchyData);
        const links = root.links();
        const nodes = root.descendants();

        // 각 노드에 고유 ID 부여 (simulation용)
        nodes.forEach((node, i) => {
            node.index = i;
        });

        // 메모를 simulation 노드로 변환
        const memoNodes = memos.map((memo, i) => ({
            ...memo,
            index: nodes.length + i,
            isMemo: true,
            x: memo.position.x,
            y: memo.position.y,
            vx: 0,
            vy: 0,
            fx: null,
            fy: null,
        }));

        // 모든 노드 (기존 노드 + 메모 노드) 결합
        const allNodes = [...nodes, ...memoNodes];

        // 메모-노드 연결 링크 생성
        const memoLinks = memos.map(memo => {
            const targetNode = nodes.find(node => node.data.id === memo.nodeId);
            const memoNode = memoNodes.find(memoNode => memoNode.id === memo.id);
            return {
                source: targetNode,
                target: memoNode,
                isMemoLink: true,
            };
        });

        // 모든 링크 결합
        const allLinks = [...links, ...memoLinks];

        // 기존 simulation 정리
        this.cleanup();

        // Force simulation 생성
        this.simulation = d3.forceSimulation(allNodes)
            .force('link', d3.forceLink(allLinks)
                .id(d => d.id || d.data?.id)
                .distance(d => d.isMemoLink ? 100 : 150) // 메모 링크는 100, 노드 링크는 150
                .strength(d => d.isMemoLink ? 0.5 : 1) // 메모 링크는 더 약하게
            )
            .force('charge', d3.forceManyBody()
                .strength(d => d.isMemo ? -150 : -300) // 메모는 더 약한 반발력
            )
            .force('x', d3.forceX(0).strength(0.05))
            .force('y', d3.forceY(0).strength(0.05))
            .force('center', d3.forceCenter(0, 0));

        // Tick 콜백 등록
        if (onTick && typeof onTick === 'function') {
            this.onTickCallback = onTick;
            this.simulation.on('tick', () => {
                onTick(nodes, links, memoNodes);
            });
        }

        return { nodes, links, memos: memoNodes };
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

