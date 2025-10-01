/**
 * DataTransformService
 * 
 * Business Logic: 트리 데이터 구조 변환
 * nodes/links 배열을 D3 hierarchy 형태로 변환
 */

class DataTransformService {
    /**
     * nodes/links 배열을 D3 hierarchy 형태로 변환
     * @param {Array} nodes - 노드 배열
     * @param {Array} links - 링크 배열
     * @returns {Object} D3 hierarchy 형태의 데이터
     */
    static transformToHierarchy(nodes, links) {
        if (!Array.isArray(nodes) || nodes.length === 0) {
            return null;
        }

        // 링크가 없으면 첫 번째 노드를 루트로 사용
        if (!Array.isArray(links) || links.length === 0) {
            const rootNode = nodes[0];
            return this.nodeToHierarchy(rootNode);
        }

        // 1. 루트 노드 찾기 (타겟이 아닌 노드)
        const targetIds = new Set(
            links.map(link =>
                typeof link.target === 'object' ? link.target.id : link.target
            )
        );

        const rootNode = nodes.find(node => !targetIds.has(node.id));
        if (!rootNode) {
            // 루트를 찾을 수 없으면 첫 번째 노드를 루트로 사용
            return this.nodeToHierarchy(nodes[0]);
        }

        // 2. 부모-자식 관계 맵 생성
        const childrenMap = new Map();
        links.forEach(link => {
            const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
            const targetId = typeof link.target === 'object' ? link.target.id : link.target;

            if (!childrenMap.has(sourceId)) {
                childrenMap.set(sourceId, []);
            }
            childrenMap.get(sourceId).push(targetId);
        });

        // 3. 노드 맵 생성 (빠른 접근)
        const nodeMap = new Map(nodes.map(node => [node.id, node]));

        // 4. 재귀적으로 hierarchy 구성
        const buildHierarchy = (nodeId) => {
            const node = nodeMap.get(nodeId);
            if (!node) return null;

            const hierarchyNode = this.nodeToHierarchy(node);

            const childIds = childrenMap.get(nodeId) || [];
            if (childIds.length > 0) {
                hierarchyNode.children = childIds
                    .map(childId => buildHierarchy(childId))
                    .filter(Boolean);
            }

            return hierarchyNode;
        };

        return buildHierarchy(rootNode.id);
    }

    /**
     * 단일 노드를 hierarchy 노드로 변환
     * @param {Object} node - 원본 노드
     * @returns {Object} hierarchy 형태 노드
     */
    static nodeToHierarchy(node) {
        return {
            name: node.keyword || node.id || 'Node',
            id: node.id,
            data: { ...node }
        };
    }

    /**
     * Hierarchy 데이터의 유효성 검증
     * @param {Object} hierarchy - 검증할 hierarchy 데이터
     * @returns {boolean} 유효 여부
     */
    static isValidHierarchy(hierarchy) {
        if (!hierarchy || typeof hierarchy !== 'object') {
            return false;
        }

        if (!hierarchy.name || !hierarchy.id) {
            return false;
        }

        if (hierarchy.children && !Array.isArray(hierarchy.children)) {
            return false;
        }

        return true;
    }
}

export default DataTransformService;

