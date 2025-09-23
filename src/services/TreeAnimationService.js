import * as d3 from 'd3';
import TreeLayoutService from './TreeLayoutService';

/**
 * TreeAnimationService - TreeLayoutService를 확장하여 애니메이션 기능 추가
 * Business Logic Layer: 노드 위치 전환 애니메이션 처리
 */
class TreeAnimationService extends TreeLayoutService {
    constructor() {
        super();
        this.animationRef = null;
        this.isAnimating = false;
    }

    /**
     * 노드 위치 간 부드러운 전환 애니메이션 계산
     * @param {Array} currentNodes - 현재 노드 배열
     * @param {Array} targetNodes - 목표 노드 배열
     * @param {Function} onUpdate - 애니메이션 업데이트 콜백
     * @param {Function} onComplete - 애니메이션 완료 콜백
     * @returns {Object} 애니메이션 제어 객체
     */
    animateNodePositions(currentNodes, targetNodes, onUpdate, onComplete) {
        // 기존 애니메이션 정리
        if (this.animationRef) {
            this.animationRef.stop();
        }

        this.isAnimating = true;

        // 노드 ID를 키로 하는 맵 생성
        const currentNodeMap = new Map();
        currentNodes.forEach(node => {
            currentNodeMap.set(node.id, { x: node.x || 0, y: node.y || 0 });
        });

        const targetNodeMap = new Map();
        targetNodes.forEach(node => {
            targetNodeMap.set(node.id, { x: node.x || 0, y: node.y || 0 });
        });

        // 애니메이션 설정
        const duration = 1000; // 1초
        const startTime = Date.now();

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Easing function (ease-in-out)
            const easedProgress = progress < 0.5
                ? 2 * progress * progress
                : 1 - Math.pow(-2 * progress + 2, 3) / 2;

            // 중간 위치 계산
            const animatedNodes = targetNodes.map(node => {
                const currentPos = currentNodeMap.get(node.id) || { x: node.x || 0, y: node.y || 0 };
                const targetPos = targetNodeMap.get(node.id) || { x: node.x || 0, y: node.y || 0 };

                return {
                    ...node,
                    x: currentPos.x + (targetPos.x - currentPos.x) * easedProgress,
                    y: currentPos.y + (targetPos.y - currentPos.y) * easedProgress
                };
            });

            // 업데이트 콜백 호출
            onUpdate(animatedNodes);

            if (progress < 1) {
                this.animationRef = requestAnimationFrame(animate);
            } else {
                this.isAnimating = false;
                if (onComplete) {
                    onComplete();
                }
            }
        };

        // 애니메이션 시작
        this.animationRef = requestAnimationFrame(animate);

        // 애니메이션 제어 객체 반환
        return {
            stop: () => {
                if (this.animationRef) {
                    cancelAnimationFrame(this.animationRef);
                    this.animationRef = null;
                    this.isAnimating = false;
                }
            },
            isAnimating: () => this.isAnimating
        };
    }

    /**
     * 트리 레이아웃을 계산하고 애니메이션과 함께 적용
     * @param {Array} currentNodes - 현재 노드 배열
     * @param {Array} nodes - 원본 노드 배열
     * @param {Array} links - 원본 링크 배열
     * @param {Object} dimensions - 화면 크기
     * @param {Function} onUpdate - 애니메이션 업데이트 콜백
     * @returns {Object} 애니메이션 제어 객체
     */
    calculateTreeLayoutWithAnimation(currentNodes, nodes, links, dimensions, onUpdate) {
        // 목표 레이아웃 계산
        const targetLayout = this.calculateTreeLayout(nodes, links, dimensions);

        // 애니메이션 실행
        return this.animateNodePositions(
            currentNodes,
            targetLayout.nodes,
            (animatedNodes) => {
                onUpdate(animatedNodes, targetLayout.links);
            }
        );
    }

    /**
     * 애니메이션 중인지 확인
     * @returns {boolean} 애니메이션 상태
     */
    getIsAnimating() {
        return this.isAnimating;
    }

    /**
     * 애니메이션 정리
     */
    cleanup() {
        if (this.animationRef) {
            cancelAnimationFrame(this.animationRef);
            this.animationRef = null;
            this.isAnimating = false;
        }
    }
}

export default TreeAnimationService;
