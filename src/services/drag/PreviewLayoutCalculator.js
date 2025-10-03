/**
 * PreviewLayoutCalculator
 * 드래그 중 최종 결과를 미리보기하기 위한 레이아웃 계산
 */
class PreviewLayoutCalculator {
    /**
     * 미리보기 레이아웃 계산
     * @param {Array} siblings - 형제노드 배열
     * @param {Object} draggedNode - 드래그 중인 노드
     * @param {number} insertIndex - 삽입할 인덱스
     * @returns {Object} { previewNodes }
     */
    calculatePreviewLayout(siblings, draggedNode, insertIndex) {
        // 1. Y 좌표 기준으로 정렬
        const sorted = siblings
            .map((s, i) => ({ node: s, index: i, y: s.x }))
            .sort((a, b) => a.y - b.y);

        const currentIndex = sorted.findIndex((s) => s.node === draggedNode);

        if (currentIndex === -1) {
            return { previewNodes: [] };
        }

        // 2. 순서 변경 시뮬레이션
        const reordered = [...sorted];
        const [moved] = reordered.splice(currentIndex, 1);

        // 인덱스 조정
        let finalIndex = insertIndex;
        if (insertIndex > currentIndex) {
            finalIndex = insertIndex - 1;
        }

        // 범위 체크
        finalIndex = Math.max(0, Math.min(reordered.length, finalIndex));

        reordered.splice(finalIndex, 0, moved);

        // 3. 미리보기 노드 배열 생성
        // 정렬된 순서대로 기존 노드들의 Y 좌표를 재할당
        const sortedYPositions = sorted.map((s) => s.y).sort((a, b) => a - b);

        const previewNodes = reordered.map((item, idx) => {
            const originalNode = item.node;
            const isDragged = originalNode.data.id === draggedNode.data.id;

            return {
                id: originalNode.data.id,
                x: originalNode.y, // X는 변경 없음 (트리1에서 y가 실제 X좌표)
                y: sortedYPositions[idx], // 정렬된 Y 좌표 순서대로 할당
                isDragged: isDragged,
                opacity: isDragged ? 0.4 : 1.0,
            };
        });

        return { previewNodes };
    }

}

export default PreviewLayoutCalculator;

