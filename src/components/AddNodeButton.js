import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Add Node Button Component
 * 노드 추가 UI 컴포넌트
 */
const AddNodeButton = ({
    parentId,
    onAddNode,
    position = { x: 20, y: 20 },
    availableNodes = []
}) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isFormVisible, setIsFormVisible] = useState(false);
    const [formData, setFormData] = useState({
        keyword: '',
        fullText: '',
        size: 10,
        parentId: parentId || 'root'
    });

    // 폼 데이터 핸들러
    const handleInputChange = (field, value) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));
    };

    // 노드 추가 핸들러
    const handleAddNode = () => {
        if (!formData.keyword.trim()) {
            alert('키워드를 입력해주세요.');
            return;
        }

        if (!formData.parentId) {
            alert('부모 노드를 선택해주세요.');
            return;
        }

        onAddNode(formData.parentId, formData);

        // 폼 리셋
        setFormData({
            keyword: '',
            fullText: '',
            size: 10,
            parentId: parentId || 'root'
        });
        setIsFormVisible(false);
        setIsExpanded(false);
    };

    // 취소 핸들러
    const handleCancel = () => {
        setIsFormVisible(false);
        setIsExpanded(false);
        setFormData({
            keyword: '',
            fullText: '',
            size: 10,
            parentId: parentId || 'root'
        });
    };

    return (
        <div
            className="absolute z-10"
            style={{
                left: position.x,
                top: position.y
            }}
        >
            {/* 메인 버튼 */}
            <motion.button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-14 h-14 bg-green-500 text-white rounded-full shadow-lg hover:bg-green-600 flex items-center justify-center"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200 }}
            >
                <motion.div
                    animate={{ rotate: isExpanded ? 45 : 0 }}
                    transition={{ duration: 0.2 }}
                >
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                    </svg>
                </motion.div>
            </motion.button>

            {/* 확장된 메뉴 */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8, y: -10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.8, y: -10 }}
                        transition={{ duration: 0.2 }}
                        className="absolute top-16 left-0 bg-white rounded-lg shadow-lg p-4 min-w-72"
                    >
                        <div className="space-y-3">
                            <h3 className="text-lg font-semibold text-gray-800">
                                새 노드 추가
                            </h3>

                            <div className="space-y-2">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        부모 노드 *
                                    </label>
                                    <select
                                        value={formData.parentId}
                                        onChange={(e) => handleInputChange('parentId', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                                    >
                                        {availableNodes.map(node => (
                                            <option key={node.id} value={node.id}>
                                                {node.keyword || node.name || node.id} (Level {node.level})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        키워드 *
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.keyword}
                                        onChange={(e) => handleInputChange('keyword', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                                        placeholder="노드 키워드 입력"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        설명
                                    </label>
                                    <textarea
                                        value={formData.fullText}
                                        onChange={(e) => handleInputChange('fullText', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                                        placeholder="노드 설명 입력"
                                        rows="3"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        크기
                                    </label>
                                    <input
                                        type="number"
                                        value={formData.size}
                                        onChange={(e) => handleInputChange('size', parseInt(e.target.value) || 10)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                                        min="5"
                                        max="50"
                                    />
                                </div>
                            </div>

                            <div className="flex space-x-2 pt-2">
                                <button
                                    onClick={handleAddNode}
                                    className="flex-1 px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors"
                                >
                                    추가
                                </button>
                                <button
                                    onClick={handleCancel}
                                    className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
                                >
                                    취소
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default AddNodeButton;
