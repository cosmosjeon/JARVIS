import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ChartView from './ChartView';
import NodeAssistantPanel from './NodeAssistantPanel';
import TreeNode from './TreeNode';
import ForceDirectedTree from './force-tree/ForceDirectedTree';
import ForceTreeViewControls from './force-tree/ForceTreeViewControls';
import useHierarchicalTreeController from './hierarchical-tree/hooks/useHierarchicalTreeController';

const HierarchicalForceTree = () => {
  const {
    // Theme
    activeTheme,
    ActiveThemeIcon,
    cycleTheme,
    currentTheme,
    theme,

    // View options
    viewMode,
    setViewMode,
    layoutOrientation,
    setLayoutOrientation,

    // Data & session
    user,
    data,
    activeTreeId,
    initializingTree,
    isTreeSyncing,
    treeSyncError,
    linkValidationError,
    showBootstrapChat,
    getInitialConversationForNode,

    // Graph structure
    nodes,
    links,
    nodeScaleFactor,
    viewTransform,
    dimensions,
    colorScheme,
    collapsedNodeIds,
    childrenByParent,
    expandedNodeId,
    toggleCollapse,
    isResizing,

    // Refs & gestures
    svgRef,
    contentGroupRef,
    overlayContainerRef,
    overlayElement,
    forwardPanZoomGesture,

    // Interactions & handlers
    questionService,
    handleConversationChange,
    handleCloseNode,
    handleNodeClickForAssistant,
    handlePlaceholderCreate,
    handleManualNodeCreate,
    handleManualLinkCreate,
    handleManualRootCreate,
    handleMemoCreate,
    handleMemoUpdate,
    handleNodeUpdate,
    removeNodeAndDescendants,
    handleRequestAnswer,
    handleSecondQuestion,
    handleAnswerComplete,
    handleAnswerError,
    handleBootstrapSubmit,
    handleDrag,
  } = useHierarchicalTreeController();

  const bootstrapNodeColor = colorScheme.range()?.[0] ?? '#1f77b4';

  return (
    <div
      className="relative flex overflow-hidden bg-transparent rounded-xl"
      style={{
        // 투명 창에서 이전 프레임 잔상 방지: 독립 합성 레이어 확보
        willChange: 'transform, opacity, background',
        transform: 'translateZ(0)',
        WebkitTransform: 'translateZ(0)',
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
        pointerEvents: 'auto',
        background: currentTheme.background,
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        // 창틀 여유 공간까지 완전히 채우기
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        margin: 0,
        padding: 0,
      }}
    >
      {initializingTree && (
        <div className="absolute inset-0 z-[1200] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 text-slate-200">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-500 border-t-transparent" />
            <p className="text-sm">트리를 불러오는 중입니다...</p>
          </div>
        </div>
      )}
      {treeSyncError ? (
        <div className="absolute bottom-6 left-1/2 z-[1200] w-[320px] -translate-x-1/2 rounded-lg border border-red-400/60 bg-red-900/60 px-4 py-3 text-xs text-red-100 shadow-lg">
          <p className="font-medium">동기화 오류</p>
          <p className="opacity-80">{treeSyncError.message || 'Supabase와 동기화할 수 없습니다.'}</p>
        </div>
      ) : null}
      {linkValidationError ? (
        <div className="pointer-events-none absolute top-4 right-6 z-[1300]">
          <div className="pointer-events-auto rounded-lg border border-red-400/60 bg-red-900/80 px-3 py-2 text-xs font-medium text-red-100 shadow-lg">
            {linkValidationError}
          </div>
        </div>
      ) : null}
      {/* 창 드래그 핸들 - 중앙 최상단 */}
      <div
        className="absolute top-2 left-1/2 z-[1300] -translate-x-1/2 cursor-grab active:cursor-grabbing"
        style={{ WebkitAppRegion: 'drag' }}
      >
        <div className="flex h-8 items-center justify-between rounded-full bg-black/60 backdrop-blur-sm border border-black/50 shadow-lg hover:bg-black/80 transition-colors px-3" style={{ width: '224px' }}>
          {/* 왼쪽: 드래그 점들 & 테마 버튼 */}
          <div className="flex items-center gap-2" style={{ WebkitAppRegion: 'no-drag' }}>
            {/* 드래그 점들 */}
            <div className="flex space-x-1">
              <div className="h-1 w-1 rounded-full bg-white/60"></div>
              <div className="h-1 w-1 rounded-full bg-white/60"></div>
              <div className="h-1 w-1 rounded-full bg-white/60"></div>
            </div>

            {/* 테마 드롭다운 버튼 */}
            {/* 테마 토글 버튼 */}
            <button
              className="group flex h-5 w-5 items-center justify-center rounded-full bg-black/40 border border-gray-500/60 hover:bg-gray-700/80 transition-all duration-200"
              onClick={cycleTheme}
              onMouseDown={(e) => e.stopPropagation()}
              title={`테마 변경 (현재: ${activeTheme.label})`}
            >
              <ActiveThemeIcon className="h-3 w-3 text-white/90" />
            </button>
          </div>

          {/* 오른쪽: 전체화면 & 닫기 버튼 */}
          <div className="flex items-center gap-2" style={{ WebkitAppRegion: 'no-drag' }}>
            {/* 전체화면 버튼 */}
            <button
              className="group flex h-5 w-5 items-center justify-center rounded-full bg-black/40 border border-gray-500/60 hover:bg-gray-700/80 transition-all duration-200"
              onClick={() => {
                const api = typeof window !== 'undefined' ? window.jarvisAPI : null;
                if (api?.windowControls?.maximize) {
                  api.windowControls.maximize();
                }
              }}
              onMouseDown={(e) => e.stopPropagation()}
              title="전체화면"
            >
              <svg className="h-3 w-3 text-white/90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            </button>

            {/* 닫기 버튼 */}
            <button
              className="group flex h-5 w-5 items-center justify-center rounded-full bg-black/60 border border-gray-500/60 hover:bg-white/80 hover:shadow-xl hover:shadow-white/40 hover:scale-110 transition-all duration-200"
              onClick={() => {
                if (process.env.NODE_ENV === 'development') {
                  // 개발 중 동작 여부 확인용
                  // eslint-disable-next-line no-console
                  console.log('[Jarvis] Drag handle close requested');
                }

                const api = typeof window !== 'undefined' ? window.jarvisAPI : null;

                const hideWindow = () => {
                  if (process.env.NODE_ENV === 'development') {
                    // eslint-disable-next-line no-console
                    console.log('[Jarvis] hideWindow fallback triggered');
                  }
                  try {
                    if (api && typeof api.toggleWindow === 'function') {
                      api.toggleWindow();
                      return;
                    }
                  } catch (toggleError) {
                    // Ignore toggle errors and fall through to window.close fallback.
                  }

                  if (typeof window !== 'undefined' && typeof window.close === 'function') {
                    window.close();
                  }
                };

                try {
                  const closeFn = api?.windowControls?.close;
                  if (typeof closeFn === 'function') {
                    const maybeResult = closeFn();
                    if (process.env.NODE_ENV === 'development') {
                      const tag = '[Jarvis] windowControls.close result';
                      if (maybeResult && typeof maybeResult.then === 'function') {
                        maybeResult.then((response) => {
                          // eslint-disable-next-line no-console
                          console.log(tag, response);
                        }).catch((err) => {
                          // eslint-disable-next-line no-console
                          console.log(`${tag} (rejected)`, err);
                        });
                      } else {
                        // eslint-disable-next-line no-console
                        console.log(tag, maybeResult);
                      }
                    }

                    if (maybeResult && typeof maybeResult.then === 'function') {
                      maybeResult
                        .then((response) => {
                          if (process.env.NODE_ENV === 'development') {
                            // eslint-disable-next-line no-console
                            console.log('[Jarvis] close response (async)', response, response?.error);
                          }
                          if (!response?.success) {
                            hideWindow();
                          }
                        })
                        .catch(() => hideWindow());
                      return;
                    }

                    if (!maybeResult?.success) {
                      hideWindow();
                    }
                    return;
                  }
                } catch (error) {
                  hideWindow();
                  return;
                }

                hideWindow();
              }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <svg
                className="h-3 w-3 text-white group-hover:text-black"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <ForceTreeViewControls
        viewMode={viewMode}
        onChangeViewMode={setViewMode}
        layoutOrientation={layoutOrientation}
        onChangeLayoutOrientation={setLayoutOrientation}
        theme={theme}
      />

      {isTreeSyncing && !initializingTree ? (
        <div className="pointer-events-none absolute bottom-6 right-6 z-[1200] rounded-full bg-slate-900/80 px-3 py-1 text-[11px] font-medium text-slate-100 shadow-lg">
          자동 저장 중...
        </div>
      ) : null}

      {viewMode === 'force-tree' && showBootstrapChat && (
        <div
          className="pointer-events-none absolute"
          style={{
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: 600,
            height: 640,
            zIndex: 1000,
          }}
          data-interactive-zone="true"
        >
          <div className="pointer-events-auto" style={{ width: '100%', height: '100%' }}>
            <NodeAssistantPanel
              node={{ id: '__bootstrap__', keyword: '', fullText: '' }}
              color={bootstrapNodeColor}
              onSizeChange={() => { }}
              onSecondQuestion={() => { }}
              onPlaceholderCreate={() => { }}
              questionService={questionService.current}
              initialConversation={getInitialConversationForNode('__bootstrap__')}
              onConversationChange={(messages) => handleConversationChange('__bootstrap__', messages)}
              nodeSummary={{ label: '첫 노드', intro: '첫 노드를 생성하세요.', bullets: [] }}
              isRootNode={true}
              bootstrapMode={true}
              onBootstrapFirstSend={handleBootstrapSubmit}
              onPanZoomGesture={forwardPanZoomGesture}
              nodeScaleFactor={nodeScaleFactor}
            />
          </div>
        </div>
      )}

      {viewMode === 'force-tree' && (
        <ForceDirectedTree
          data={data}
          dimensions={dimensions}
          onNodeClick={handleNodeClickForAssistant}
          onNodeRemove={removeNodeAndDescendants}
          onNodeUpdate={handleNodeUpdate}
          onMemoCreate={handleMemoCreate}
          onMemoUpdate={handleMemoUpdate}
          onNodeCreate={handleManualNodeCreate}
          onLinkCreate={handleManualLinkCreate}
          onRootCreate={handleManualRootCreate}
          treeId={activeTreeId}
          userId={user?.id}
          questionService={questionService.current}
          getInitialConversation={getInitialConversationForNode}
          onConversationChange={handleConversationChange}
          onRequestAnswer={handleRequestAnswer}
          onAnswerComplete={handleAnswerComplete}
          onAnswerError={handleAnswerError}
          onSecondQuestion={handleSecondQuestion}
          onPlaceholderCreate={handlePlaceholderCreate}
          theme={theme}
        />
      )}

      {/* 차트 뷰 */}
      {viewMode === 'chart' && (
        <ChartView
          data={data}
          dimensions={dimensions}
          viewTransform={viewTransform}
          nodeScaleFactor={nodeScaleFactor}
        />
      )}

      {viewMode === 'tree1' && showBootstrapChat && (
        <div
          className="pointer-events-none absolute"
          style={{
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: 600,
            height: 640,
            zIndex: 1000,
          }}
          data-interactive-zone="true"
        >
          <div className="pointer-events-auto" style={{ width: '100%', height: '100%' }}>
            <NodeAssistantPanel
              node={{ id: '__bootstrap__', keyword: '', fullText: '' }}
              color={bootstrapNodeColor}
              onSizeChange={() => { }}
              onSecondQuestion={() => { }}
              onPlaceholderCreate={() => { }}
              questionService={questionService.current}
              initialConversation={getInitialConversationForNode('__bootstrap__')}
              onConversationChange={(messages) => handleConversationChange('__bootstrap__', messages)}
              nodeSummary={{ label: '첫 노드', intro: '첫 노드를 생성하세요.', bullets: [] }}
              isRootNode={true}
              bootstrapMode={true}
              onBootstrapFirstSend={handleBootstrapSubmit}
              onPanZoomGesture={forwardPanZoomGesture}
              nodeScaleFactor={nodeScaleFactor}
            />
          </div>
        </div>
      )}

      {viewMode === 'tree1' && (
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
          preserveAspectRatio="none"
          data-interactive-zone="true"
          style={{
            background: currentTheme.background,
            // 줌/팬 입력을 받기 위해 SVG에는 포인터 이벤트 활성화
            pointerEvents: 'auto',
            // SVG가 창틀 여유 공간까지 완전히 채우도록 설정
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100vw',
            height: '100vh',
            margin: 0,
            padding: 0,
          }}
        >
          {/* Arrow marker definition */}
          <defs>
            <marker
              id="arrowhead"
              viewBox="0 -5 10 10"
              refX={8}
              refY={0}
              markerWidth={6}
              markerHeight={6}
              orient="auto"
            >
              <path d="M0,-5L10,0L0,5" fill="rgba(0,0,0,0.55)" />
            </marker>
          </defs>

          {/* Links */}

          <g
            ref={contentGroupRef}
            key={`${dimensions.width}x${dimensions.height}`}
            transform={`translate(${viewTransform.x}, ${viewTransform.y}) scale(${viewTransform.k})`}
            style={{ opacity: isResizing ? 0.999 : 1 }}
          >
            <g className="links" style={{ pointerEvents: 'none' }}>
              <AnimatePresence>
                {links
                  // TreeLayoutService에서 이미 정렬된 링크 사용
                  .map((link, index) => {
                    const sourceNode = nodes.find(n => n.id === link.source);
                    const targetNode = nodes.find(n => n.id === link.target);

                    if (!sourceNode || !targetNode) return null;

                    const isHorizontalLayout = layoutOrientation === 'horizontal';
                    // 토글 버튼 위치에서 연결선 시작
                    // horizontal: 버튼이 노드 오른쪽(x축)에 있으므로 sourceX 증가
                    // vertical: 버튼이 노드 아래(y축)에 있으므로 sourceY 증가
                    const toggleButtonOffset = 50 * nodeScaleFactor;
                    const sourceX = isHorizontalLayout ? sourceNode.x + toggleButtonOffset : sourceNode.x;
                    const sourceY = isHorizontalLayout ? sourceNode.y : sourceNode.y + toggleButtonOffset;
                    const targetX = targetNode.x;
                    const targetY = targetNode.y;

                    const shouldAnimate = link.isNew;
                    const pathString = `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`;

                    return (
                      <g key={`${String(link.source)}->${String(link.target)}`}>
                        {/* Neumorphism shadow for line */}
                        <motion.path
                          d={pathString}
                          stroke="#bebebe"
                          strokeOpacity={0.4}
                          strokeWidth={Math.sqrt(link.value || 1) * 1.5 + 2}
                          fill="none"
                          style={{
                            filter: 'blur(2px)',
                          }}
                          initial={{ pathLength: 0, opacity: 0 }}
                          animate={{ pathLength: 1, opacity: 1 }}
                          exit={{ pathLength: 0, opacity: 0 }}
                          transition={{
                            duration: 0.45,
                            ease: "easeInOut",
                            delay: index * 0.06
                          }}
                        />
                        {/* Main neumorphism line */}
                        <motion.path
                          d={pathString}
                          stroke="#e0e0e0"
                          strokeOpacity={0.9}
                          strokeWidth={Math.sqrt(link.value || 1) * 1.5}
                          fill="none"
                          markerEnd="url(#arrowhead)"
                          style={{
                            filter: 'drop-shadow(1px 1px 2px #bebebe) drop-shadow(-1px -1px 2px #ffffff)',
                          }}
                          initial={{ pathLength: 0, opacity: 0 }}
                          animate={{ pathLength: 1, opacity: 1 }}
                          exit={{ pathLength: 0, opacity: 0 }}
                          transition={{
                            duration: 0.45,
                            ease: "easeInOut",
                            delay: index * 0.06
                          }}
                        />
                      </g>
                    );
                  })}
              </AnimatePresence>
            </g>

            {/* Nodes - 최상위 레이어 */}
            <g
              className="nodes"
              style={{
                pointerEvents: 'auto',
                zIndex: 1000,
                isolation: 'isolate' // 새로운 stacking context 생성
              }}
            >
              {nodes.map((node, index) => {
                // Tree layout에서는 depth를 사용
                const nodeDepth = node.depth || 0;

                return (
                  <motion.g
                    key={node.id}
                    data-node-id={node.id}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{
                      delay: index * 0.1,
                      type: "spring",
                      stiffness: 300,
                      damping: 25
                    }}
                    style={{
                      pointerEvents: 'auto',
                      zIndex: expandedNodeId === node.id ? 9999 : 1001 + index, // 확장된 노드는 최상위
                      position: 'relative'
                    }}
                    data-interactive-zone="true"
                  >
                    <TreeNode
                      node={node}
                      position={{ x: node.x || 0, y: node.y || 0 }}
                      color={colorScheme(nodeDepth)}
                      onDrag={handleDrag}
                      onNodeClick={handleNodeClickForAssistant}
                      isExpanded={expandedNodeId === node.id}
                      onSecondQuestion={handleSecondQuestion}
                      onPlaceholderCreate={handlePlaceholderCreate}
                      questionService={questionService.current}
                      initialConversation={getInitialConversationForNode(node.id)}
                      onConversationChange={(messages) => handleConversationChange(node.id, messages)}
                      onRequestAnswer={handleRequestAnswer}
                      onAnswerComplete={handleAnswerComplete}
                      onAnswerError={handleAnswerError}
                      onRemoveNode={removeNodeAndDescendants}
                      hasChildren={(childrenByParent.get(node.id) || []).length > 0}
                      isCollapsed={collapsedNodeIds.has(node.id)}
                      onToggleCollapse={toggleCollapse}
                      viewTransform={viewTransform}
                      overlayElement={overlayElement}
                      onCloseNode={() => handleCloseNode(node.id)}
                      onPanZoomGesture={forwardPanZoomGesture}
                      nodeScaleFactor={nodeScaleFactor}
                      treeNodes={nodes}
                      treeLinks={links}
                      onNodeSelect={handleNodeClickForAssistant}
                    />
                  </motion.g>
                );
              })}
            </g>
          </g>
        </svg>
      )}

      {/* 디버그 패널 제거됨 */}
      <div
        ref={overlayContainerRef}
        className="pointer-events-none absolute inset-0 z-10"
        style={{ overflow: 'visible' }}
      />
    </div>
  );
};

export default HierarchicalForceTree;
