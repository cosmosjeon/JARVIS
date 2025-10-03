/**
 * InsertionCalculator
 * 마우스 위치 기반으로 노드가 삽입될 위치 계산
 */
class InsertionCalculator {
    /**
     * 삽입 위치 계산
     * @param {Array} siblings - 형제노드 배열
     * @param {Object} currentNode - 현재 드래그 중인 노드
     * @param {number} mouseY - 마우스 Y 좌표
     * @returns {Object} { insertIndex, isValidDrop }
     */
    calculateInsertPosition(siblings, currentNode, mouseY) {
        // 1. 형제노드 정렬 (Y좌표 기준) - 트리1에서 x가 실제 Y좌표
        const sorted = siblings
            .map((s, i) => ({ node: s, index: i, y: s.x }))
            .sort((a, b) => a.y - b.y);

        const currentIndex = sorted.findIndex((s) => s.node === currentNode);

        if (currentIndex === -1) {
            return { insertIndex: 0, isValidDrop: false };
        }

        // 2. 삽입 위치 찾기
        let insertIndex = 0;

        // 첫 번째 노드보다 위
        if (mouseY < sorted[0].y - 20) {
            insertIndex = 0;
        }
        // 마지막 노드보다 아래
        else if (mouseY > sorted[sorted.length - 1].y + 20) {
            insertIndex = sorted.length;
        }
        // 노드들 사이
        else {
            for (let i = 0; i < sorted.length - 1; i++) {
                const midY = (sorted[i].y + sorted[i + 1].y) / 2;

                if (mouseY < midY) {
                    insertIndex = i;
                    break;
                } else {
                    insertIndex = i + 1;
                }
            }
        }

        // 3. 유효성 검증 (현재 위치와 같으면 invalid)
        const isValidDrop =
            insertIndex !== currentIndex && insertIndex !== currentIndex + 1;

        return { insertIndex, isValidDrop };
    }
}

export default InsertionCalculator;

