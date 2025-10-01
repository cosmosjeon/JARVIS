import React from 'react';
import { motion } from 'framer-motion';

/**
 * ChartView - 차트 시각화 컴포넌트
 * 
 * 트리 데이터를 차트 형식으로 표시합니다.
 * 향후 다양한 차트 타입을 지원할 예정입니다.
 */
const ChartView = ({
    data,
    dimensions,
    viewTransform,
    nodeScaleFactor
}) => {
    return (
        <div
            className="relative flex h-full w-full items-center justify-center"
            style={{
                background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.12), rgba(0, 0, 0, 0.18))',
                pointerEvents: 'auto',
            }}
        >
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="flex flex-col items-center gap-6"
            >
                {/* 차트 제목 */}
                <div className="flex flex-col items-center gap-2">
                    <div className="rounded-full bg-gradient-to-r from-blue-500/20 to-purple-500/20 p-4 backdrop-blur-sm">
                        <svg
                            className="h-16 w-16 text-blue-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                            />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-white">차트 뷰</h2>
                    <p className="text-sm text-white/70">곧 다양한 차트가 제공될 예정입니다</p>
                </div>

                {/* 데이터 정보 카드 */}
                <div className="flex gap-4">
                    <div className="rounded-lg border border-white/10 bg-black/40 px-6 py-4 backdrop-blur-sm">
                        <div className="text-xs text-white/60">노드 개수</div>
                        <div className="text-2xl font-bold text-blue-400">
                            {data?.nodes?.length || 0}
                        </div>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-black/40 px-6 py-4 backdrop-blur-sm">
                        <div className="text-xs text-white/60">연결 개수</div>
                        <div className="text-2xl font-bold text-purple-400">
                            {data?.links?.length || 0}
                        </div>
                    </div>
                </div>

                {/* 개발 중 안내 */}
                <div className="mt-8 rounded-lg border border-yellow-500/30 bg-yellow-900/20 px-6 py-4 backdrop-blur-sm">
                    <div className="flex items-center gap-3">
                        <svg
                            className="h-5 w-5 text-yellow-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                        </svg>
                        <div className="text-sm text-yellow-100">
                            <div className="font-medium">개발 중입니다</div>
                            <div className="text-xs text-yellow-200/80">
                                막대 차트, 파이 차트, 타임라인 등 다양한 시각화가 추가될 예정입니다
                            </div>
                        </div>
                    </div>
                </div>

                {/* 플레이스홀더 차트 프리뷰 */}
                <div className="mt-8 flex gap-4">
                    {[1, 2, 3, 4, 5].map((item) => (
                        <motion.div
                            key={item}
                            initial={{ height: 0 }}
                            animate={{ height: Math.random() * 150 + 50 }}
                            transition={{ delay: item * 0.1, duration: 0.5 }}
                            className="w-12 rounded-t-lg bg-gradient-to-t from-blue-500/60 to-purple-500/60 backdrop-blur-sm"
                        />
                    ))}
                </div>
            </motion.div>
        </div>
    );
};

export default ChartView;

