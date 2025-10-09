/**
 * InsertionCalculator
 * 마우스 위치 기반으로 노드가 삽입될 위치 계산
 */
const QUICK_SWAP_THRESHOLD = 6;

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
            .map((s) => ({ node: s, y: s.x }))
            .sort((a, b) => a.y - b.y);

        const currentIndex = sorted.findIndex((s) => s.node === currentNode);

        if (currentIndex === -1 || sorted.length <= 1) {
            return { insertIndex: currentIndex === -1 ? 0 : currentIndex, isValidDrop: false };
        }

        // 2. 드롭 후 목표 인덱스 계산
        let targetIndex = currentIndex;

        if (mouseY < sorted[0].y - 20) {
            targetIndex = 0;
        } else if (mouseY > sorted[sorted.length - 1].y + 20) {
            targetIndex = sorted.length - 1;
        } else {
            for (let i = 0; i < sorted.length - 1; i++) {
                const midY = (sorted[i].y + sorted[i + 1].y) / 2;

                if (mouseY < midY) {
                    targetIndex = i;
                    break;
                }
                targetIndex = i + 1;
            }
        }

        // 3. 현재 위치와 동일하면 방향에 따라 빠른 스왑 허용
        if (targetIndex === currentIndex) {
            const currentY = sorted[currentIndex].y;

            if (mouseY < currentY - QUICK_SWAP_THRESHOLD && currentIndex > 0) {
                targetIndex = currentIndex - 1;
            } else if (mouseY > currentY + QUICK_SWAP_THRESHOLD && currentIndex < sorted.length - 1) {
                targetIndex = currentIndex + 1;
            }
        }

        // 4. 삽입 인덱스 보정 (기존 알고리즘과 호환)
        let insertIndex = targetIndex;
        if (targetIndex > currentIndex) {
            insertIndex = targetIndex + 1;
        }

        insertIndex = Math.max(0, Math.min(sorted.length, insertIndex));

        const isValidDrop = targetIndex !== currentIndex;

        return { insertIndex, isValidDrop };
    }
}

export default InsertionCalculator;

