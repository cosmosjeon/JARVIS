/**
 * DragStateManager
 * 드래그 상태 관리 및 추적
 */
class DragStateManager {
    constructor() {
        this.dragState = null;
    }

    /**
     * 드래그 시작
     * @param {Object} node - 드래그 중인 노드
     * @param {number} startX - 시작 X 좌표
     * @param {number} startY - 시작 Y 좌표
     * @param {Object} parentNode - 부모 노드
     */
    startDrag(node, startX, startY, parentNode) {
        this.dragState = {
            node,
            startX,
            startY,
            parentNode,
        };
    }

    /**
     * 현재 드래그 상태 조회
     * @returns {Object|null} 드래그 상태 또는 null
     */
    getDragState() {
        return this.dragState;
    }

    /**
     * 드래그 종료
     */
    endDrag() {
        this.dragState = null;
    }

    /**
     * 드래그 중 여부
     * @returns {boolean}
     */
    isDragging() {
        return this.dragState !== null;
    }
}

export default DragStateManager;

