import * as d3 from 'd3';

/**
 * TreeLayoutService - d3-hierarchy tree layout을 사용한 노드 위치 계산 서비스
 * Business Logic Layer: presentation과 분리된 순수한 계산 로직
 */
class TreeLayoutService {
    constructor() {
        this.treeLayout = d3.tree()
            .size([800, 600]) // 기본 크기 설정
            .separation((a, b) => {
                // 같은 부모의 자식들 간의 간격을 조정
                return a.parent === b.parent ? 1 : 2;
            });
    }

    /**
     * 기존 노드/링크 데이터를 d3.hierarchy 형식으로 변환
     * @param {Array} nodes - 노드 배열
     * @param {Array} links - 링크 배열
     * @returns {Object} d3.hierarchy 루트 노드
     */
    convertToHierarchy(nodes, links) {
        // 노드 ID를 키로 하는 맵 생성
        const nodeMap = new Map();
        nodes.forEach(node => {
            nodeMap.set(node.id, {
                ...node,
                children: []
            });
        });

        // 링크를 사용하여 계층 구조 구성
        links.forEach(link => {
            const sourceId = link.source.id || link.source;
            const targetId = link.target.id || link.target;

            const sourceNode = nodeMap.get(sourceId);
            const targetNode = nodeMap.get(targetId);

            if (sourceNode && targetNode) {
                sourceNode.children.push(targetNode);
            }
        });

        // 루트 노드 찾기 (부모가 없는 노드)
        const rootNodes = Array.from(nodeMap.values()).filter(node =>
            !links.some(link => {
                const targetId = link.target.id || link.target;
                return targetId === node.id;
            })
        );

        if (rootNodes.length === 0) {
            throw new Error('No root node found in the hierarchy');
        }

        // 여러 루트가 있는 경우 첫 번째를 사용
        const rootNode = rootNodes[0];

        // d3.hierarchy로 변환
        return d3.hierarchy(rootNode, d => d.children);
    }

    /**
     * 트리 레이아웃을 계산하고 정렬된 노드와 링크를 반환
     * @param {Array} nodes - 원본 노드 배열
     * @param {Array} links - 원본 링크 배열
     * @param {Object} dimensions - 화면 크기 {width, height}
     * @returns {Object} {nodes, links} - 계산된 위치가 포함된 노드와 링크
     */
    calculateTreeLayout(nodes, links, dimensions) {
        try {
            // 화면 크기에 맞게 트리 레이아웃 크기 조정
            this.treeLayout.size([dimensions.width - 100, dimensions.height - 100]);

            // 계층 구조로 변환
            const root = this.convertToHierarchy(nodes, links);

            // 트리 레이아웃 계산
            this.treeLayout(root);

            // 정렬된 노드 배열 생성
            const layoutNodes = root.descendants().map(node => ({
                ...node.data,
                x: node.x + 50, // 여백 추가
                y: node.y + 50,
                depth: node.depth,
                height: node.height
            }));

            // 정렬된 링크 배열 생성
            const layoutLinks = root.links().map(link => ({
                source: link.source.data.id,
                target: link.target.data.id,
                value: 1
            }));

            return {
                nodes: layoutNodes,
                links: layoutLinks
            };
        } catch (error) {
            // 개발 환경에서만 상세 오류 로그 출력
            if (process.env.NODE_ENV === 'development') {
                console.error('Tree layout calculation failed:', error);
            }
            // 에러 발생 시 원본 데이터 반환
            return {
                nodes: nodes.map(node => ({ ...node, x: node.x || 0, y: node.y || 0 })),
                links: links
            };
        }
    }

    /**
     * 노드 정렬을 위한 비교 함수
     * @param {Object} a - 첫 번째 노드
     * @param {Object} b - 두 번째 노드
     * @returns {number} 정렬 순서
     */
    sortNodes(a, b) {
        // 먼저 레벨별로 정렬
        if (a.level !== b.level) {
            return a.level - b.level;
        }
        // 같은 레벨에서는 키워드 알파벳 순으로 정렬
        return (a.keyword || '').localeCompare(b.keyword || '');
    }

    /**
     * 링크 정렬을 위한 비교 함수
     * @param {Object} a - 첫 번째 링크
     * @param {Object} b - 두 번째 링크
     * @returns {number} 정렬 순서
     */
    sortLinks(a, b) {
        const aSource = a.source.id || a.source;
        const bSource = b.source.id || b.source;

        // 먼저 소스별로 정렬
        if (aSource !== bSource) {
            return aSource.localeCompare(bSource);
        }

        // 같은 소스에서는 타겟별로 정렬
        const aTarget = a.target.id || a.target;
        const bTarget = b.target.id || b.target;
        return aTarget.localeCompare(bTarget);
    }
}

export default TreeLayoutService;
