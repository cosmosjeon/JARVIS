/**
 * SiblingReorderService
 * 형제노드 배열의 순서 변경 수행
 */
class SiblingReorderService {
    /**
     * 순서 변경
     * @param {Array} siblings - 형제노드 배열
     * @param {number} currentIndex - 현재 인덱스
     * @param {number} insertIndex - 삽입할 인덱스
     * @returns {Array<string>} 재정렬된 노드 ID 배열
     */
    reorder(siblings, currentIndex, insertIndex) {
        // Y 좌표 기준으로 정렬
        const sorted = siblings
            .map((s, i) => ({ node: s, index: i, y: s.x }))
            .sort((a, b) => a.y - b.y);

        // 정렬된 배열 복사
        const ordered = sorted.map((s) => s.node);

        // 현재 노드 제거
        const [movedNode] = ordered.splice(currentIndex, 1);

        // 새 위치에 삽입
        const finalIndex =
            insertIndex > currentIndex ? insertIndex - 1 : insertIndex;

        // 범위 체크
        const safeIndex = Math.max(0, Math.min(ordered.length, finalIndex));

        ordered.splice(safeIndex, 0, movedNode);

        // 노드 ID 배열 반환
        return ordered.map((n) => n.data.id);
    }
}

export default SiblingReorderService;

