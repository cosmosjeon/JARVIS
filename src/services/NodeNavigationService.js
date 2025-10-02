/**
 * NodeNavigationService - 노드 간 키보드 네비게이션을 위한 서비스
 * Business Logic Layer: 노드 관계 분석 및 이동 로직 처리
 */
class NodeNavigationService {
    constructor() {
        this.nodes = [];
        this.links = [];
    }

    /**
     * 트리 데이터 설정
     * @param {Array} nodes - 노드 배열
     * @param {Array} links - 링크 배열
     */
    setTreeData(nodes, links) {
        this.nodes = nodes || [];
        this.links = links || [];
    }

    /**
     * 노드 ID로 노드 객체 찾기
     * @param {string} nodeId - 노드 ID
     * @returns {Object|null} 노드 객체 또는 null
     */
    findNodeById(nodeId) {
        return this.nodes.find(node => node.id === nodeId) || null;
    }

    /**
     * 노드의 부모 노드 찾기
     * @param {string} nodeId - 노드 ID
     * @returns {Object|null} 부모 노드 또는 null
     */
    findParentNode(nodeId) {
        const link = this.links.find(link => {
            const targetId = typeof link.target === 'object' ? link.target.id : link.target;
            return targetId === nodeId;
        });

        if (!link) return null;

        const parentId = typeof link.source === 'object' ? link.source.id : link.source;
        return this.findNodeById(parentId);
    }

    /**
     * 노드의 자식 노드들 찾기
     * @param {string} nodeId - 노드 ID
     * @returns {Array} 자식 노드 배열
     */
    findChildNodes(nodeId) {
        const childLinks = this.links.filter(link => {
            const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
            return sourceId === nodeId;
        });

        return childLinks.map(link => {
            const targetId = typeof link.target === 'object' ? link.target.id : link.target;
            return this.findNodeById(targetId);
        }).filter(node => node !== null);
    }

    /**
     * 노드의 형제 노드들 찾기 (같은 부모를 가진 노드들)
     * @param {string} nodeId - 노드 ID
     * @returns {Array} 형제 노드 배열 (현재 노드 포함)
     */
    findSiblingNodes(nodeId) {
        const parentNode = this.findParentNode(nodeId);

        if (!parentNode) {
            // 루트 노드인 경우, 다른 루트 노드들을 반환
            return this.nodes.filter(node => !this.findParentNode(node.id));
        }

        return this.findChildNodes(parentNode.id);
    }

    /**
     * 형제 노드들 중에서 현재 노드의 인덱스 찾기
     * @param {string} nodeId - 현재 노드 ID
     * @returns {number} 형제 노드들 중에서의 인덱스
     */
    getSiblingIndex(nodeId) {
        const siblings = this.findSiblingNodes(nodeId);
        return siblings.findIndex(sibling => sibling.id === nodeId);
    }

    /**
     * 위쪽 방향키 네비게이션 (부모 노드로 이동)
     * @param {string} currentNodeId - 현재 노드 ID
     * @returns {Object|null} 이동할 부모 노드 또는 null
     */
    navigateUp(currentNodeId) {
        return this.findParentNode(currentNodeId);
    }

    /**
     * 아래쪽 방향키 네비게이션 (첫 번째 자식 노드로 이동)
     * @param {string} currentNodeId - 현재 노드 ID
     * @returns {Object|null} 이동할 자식 노드 또는 null
     */
    navigateDown(currentNodeId) {
        const children = this.findChildNodes(currentNodeId);
        return children.length > 0 ? children[0] : null;
    }

    /**
     * 왼쪽 방향키 네비게이션 (이전 형제 노드로 이동)
     * @param {string} currentNodeId - 현재 노드 ID
     * @returns {Object|null} 이동할 형제 노드 또는 null
     */
    navigateLeft(currentNodeId) {
        const siblings = this.findSiblingNodes(currentNodeId);
        const currentIndex = this.getSiblingIndex(currentNodeId);

        if (currentIndex > 0) {
            return siblings[currentIndex - 1];
        }

        return null;
    }

    /**
     * 오른쪽 방향키 네비게이션 (다음 형제 노드로 이동)
     * @param {string} currentNodeId - 현재 노드 ID
     * @returns {Object|null} 이동할 형제 노드 또는 null
     */
    navigateRight(currentNodeId) {
        const siblings = this.findSiblingNodes(currentNodeId);
        const currentIndex = this.getSiblingIndex(currentNodeId);

        if (currentIndex < siblings.length - 1) {
            return siblings[currentIndex + 1];
        }

        return null;
    }

    /**
     * 방향키에 따른 노드 이동
     * @param {string} currentNodeId - 현재 노드 ID
     * @param {string} direction - 방향 ('ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight')
     * @returns {Object|null} 이동할 노드 또는 null
     */
    navigate(currentNodeId, direction) {
        switch (direction) {
            case 'ArrowUp':
                return this.navigateUp(currentNodeId);
            case 'ArrowDown':
                return this.navigateDown(currentNodeId);
            case 'ArrowLeft':
                return this.navigateLeft(currentNodeId);
            case 'ArrowRight':
                return this.navigateRight(currentNodeId);
            default:
                return null;
        }
    }

    /**
     * 노드의 전체 경로 정보 가져오기 (디버깅용)
     * @param {string} nodeId - 노드 ID
     * @returns {Object} 노드 경로 정보
     */
    getNodePathInfo(nodeId) {
        const node = this.findNodeById(nodeId);
        const parent = this.findParentNode(nodeId);
        const children = this.findChildNodes(nodeId);
        const siblings = this.findSiblingNodes(nodeId);
        const siblingIndex = this.getSiblingIndex(nodeId);

        return {
            node,
            parent,
            children,
            siblings,
            siblingIndex,
            hasParent: parent !== null,
            hasChildren: children.length > 0,
            hasSiblings: siblings.length > 1
        };
    }
}

export default NodeNavigationService;
