/**
 * DataStorageService
 * 로컬 스토리지를 사용한 데이터 저장 및 불러오기 서비스
 */
class DataStorageService {
    constructor() {
        this.STORAGE_KEY = 'hierarchical_tree_data';
    }

    /**
     * 데이터를 로컬 스토리지에 저장
     * @param {Object} data - 저장할 데이터 (nodes, links 포함)
     */
    saveData(data) {
        try {
            const dataToSave = {
                nodes: data.nodes || [],
                links: data.links || [],
                lastUpdated: new Date().toISOString()
            };

            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(dataToSave));
            console.log('✅ 데이터가 저장되었습니다:', dataToSave);
        } catch (error) {
            console.error('❌ 데이터 저장 실패:', error);
        }
    }

    /**
     * 로컬 스토리지에서 데이터를 불러오기
     * @returns {Object|null} - 저장된 데이터 또는 null
     */
    loadData() {
        try {
            const savedData = localStorage.getItem(this.STORAGE_KEY);
            if (savedData) {
                const parsedData = JSON.parse(savedData);
                console.log('✅ 저장된 데이터를 불러왔습니다:', parsedData);
                return parsedData;
            }
            return null;
        } catch (error) {
            console.error('❌ 데이터 불러오기 실패:', error);
            return null;
        }
    }

    /**
     * 특정 노드의 질문-답변 데이터를 저장
     * @param {string} nodeId - 노드 ID
     * @param {Object} questionData - 질문 데이터
     */
    saveNodeQuestionData(nodeId, questionData) {
        try {
            const existingData = this.loadData() || { nodes: [], links: [] };

            // 해당 노드를 찾아서 questionData 업데이트
            const nodeIndex = existingData.nodes.findIndex(node => node.id === nodeId);
            if (nodeIndex !== -1) {
                existingData.nodes[nodeIndex] = {
                    ...existingData.nodes[nodeIndex],
                    questionData: questionData
                };

                this.saveData(existingData);
                console.log('✅ 노드 질문 데이터가 저장되었습니다:', nodeId, questionData);
            }
        } catch (error) {
            console.error('❌ 노드 질문 데이터 저장 실패:', error);
        }
    }

    /**
     * 모든 데이터 삭제
     */
    clearData() {
        try {
            localStorage.removeItem(this.STORAGE_KEY);
            console.log('✅ 모든 데이터가 삭제되었습니다.');
        } catch (error) {
            console.error('❌ 데이터 삭제 실패:', error);
        }
    }

    /**
     * 저장된 데이터가 있는지 확인
     * @returns {boolean} - 데이터 존재 여부
     */
    hasSavedData() {
        return localStorage.getItem(this.STORAGE_KEY) !== null;
    }
}

export default DataStorageService;
