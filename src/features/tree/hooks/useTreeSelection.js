import { useState, useEffect, useCallback } from 'react';
import { useTreeDataSource } from 'features/tree/services/useTreeDataSource';
import { fetchFolders } from 'infrastructure/supabase/services/treeService';
import { useSupabaseAuth } from 'shared/hooks/useSupabaseAuth';

/**
 * useTreeSelection - Business Logic Hook
 * 
 * 역할: 트리 선택을 위한 데이터 로딩 및 비즈니스 로직
 * 책임: 
 * - Supabase에서 트리/폴더 목록 로드
 * - 폴더별 트리 그룹화
 * - 중복 탭 검증
 * - 최대 개수 검증
 */
export const useTreeSelection = ({ existingTabIds = [], maxTabs = 10 }) => {
    const { user } = useSupabaseAuth();
    const { loadTreeSummaries } = useTreeDataSource();
    const [trees, setTrees] = useState([]);
    const [folders, setFolders] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // 트리 및 폴더 목록 로드
    const loadTreesAndFolders = useCallback(async () => {
        if (!user?.id) {
            setTrees([]);
            setFolders([]);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const [fetchedTrees, fetchedFolders] = await Promise.all([
                loadTreeSummaries(),
                fetchFolders(user.id),
            ]);

            setTrees(fetchedTrees || []);
            setFolders(fetchedFolders || []);
        } catch (err) {
            setError(err);
            setTrees([]);
            setFolders([]);
        } finally {
            setLoading(false);
        }
    }, [user?.id, loadTreeSummaries]);

    // 트리 선택 가능 여부 검증
    const canSelectTree = useCallback((treeId) => {
        // 이미 열린 탭이면 선택 불가
        if (existingTabIds.includes(treeId)) {
            return { valid: false, reason: 'already_open' };
        }

        // 최대 개수 초과
        if (existingTabIds.length >= maxTabs) {
            return { valid: false, reason: 'max_tabs_reached' };
        }

        return { valid: true };
    }, [existingTabIds, maxTabs]);

    return {
        trees,
        folders,
        loading,
        error,
        loadTreesAndFolders,
        canSelectTree,
    };
};

export default useTreeSelection;
