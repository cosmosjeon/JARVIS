/**
 * QuestionService
 * 질문 관리 및 노드 생성 비즈니스 로직을 담당하는 서비스
 */
class QuestionService {
    constructor() {
        this.questionCounts = new Map(); // nodeId -> questionCount
    }

    /**
     * 특정 노드의 질문 수를 증가시키고, 2번째 질문인지 확인
     * @param {string} nodeId - 노드 ID
     * @returns {boolean} - 2번째 질문인지 여부
     */
    incrementQuestionCount(nodeId) {
        const currentCount = this.questionCounts.get(nodeId) || 0;
        const newCount = currentCount + 1;
        this.questionCounts.set(nodeId, newCount);

        return newCount === 2; // 2번째 질문인지 반환
    }

    /**
     * 특정 노드의 질문 수를 가져옴
     * @param {string} nodeId - 노드 ID
     * @returns {number} - 질문 수
     */
    getQuestionCount(nodeId) {
        return this.questionCounts.get(nodeId) || 0;
    }

    /**
     * 2번째 질문을 위한 새 노드 데이터 생성
     * @param {string} parentNodeId - 부모 노드 ID
     * @param {string} question - 2번째 질문 내용
     * @param {string} answer - 답변 내용
     * @param {Array} nodes - 노드 배열
     * @returns {Object} - 새 노드 데이터
     */
    createSecondQuestionNode(parentNodeId, question, answer, nodes = []) {
        const timestamp = Date.now();
        const randomId = Math.random().toString(36).substr(2, 9);

        const firstWord = (question || '')
            .toString()
            .trim()
            .split(/\s+/)
            .find(Boolean) || 'Q';

        return {
            id: `node_${timestamp}_${randomId}`,
            keyword: firstWord,
            fullText: `질문: ${question}\n\n답변: ${answer}`,
            level: this.getNodeLevel(parentNodeId, nodes) + 1,
            size: 12,
            questionData: {
                question,
                answer,
                parentNodeId,
                questionNumber: 2
            }
        };
    }

    /**
     * 노드의 레벨을 계산
     * @param {string} nodeId - 노드 ID
     * @param {Array} nodes - 노드 배열
     * @returns {number} - 노드 레벨
     */
    getNodeLevel(nodeId, nodes = []) {
        const node = nodes.find(n => n.id === nodeId);
        return node ? (node.level || 0) : 0;
    }

    /**
     * 특정 노드의 질문 수를 리셋
     * @param {string} nodeId - 노드 ID
     */
    resetQuestionCount(nodeId) {
        this.questionCounts.delete(nodeId);
    }

    /**
     * 특정 노드의 질문 수를 명시적으로 설정
     * @param {string} nodeId - 노드 ID
     * @param {number} nextCount - 설정할 질문 수
     */
    setQuestionCount(nodeId, nextCount) {
        if (typeof nextCount !== 'number' || Number.isNaN(nextCount)) {
            return;
        }
        if (nextCount <= 0) {
            this.resetQuestionCount(nodeId);
            return;
        }
        this.questionCounts.set(nodeId, nextCount);
    }

    /**
     * 모든 질문 카운트 초기화
     */
    resetAllQuestionCounts() {
        this.questionCounts.clear();
    }
}

export default QuestionService;
