import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import SlashCommandPalette from 'features/tree/ui/tree2/editor/SlashCommandPalette';
import InlineFormatToolbar from 'features/tree/ui/tree2/editor/InlineFormatToolbar';
import { SLASH_PALETTE_CATEGORIES } from 'features/tree/ui/tree2/editor/blockTypes';

const MemoEditorView = ({
  isVisible,
  memo,
  palette,
  editorRef,
  titleRef,
  title,
  handleTitleChange,
  onDelete,
  onClose,
  blocks,
  renderBlock,
  slashPalette,
  formatToolbar,
}) => (
  <AnimatePresence>
    {isVisible && memo && (
      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 12 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="relative flex h-full w-full flex-col overflow-hidden rounded-3xl"
        style={{
          background: palette.canvas,
          color: palette.text,
          fontFamily: '"Inter", "Pretendard", sans-serif',
        }}
        ref={editorRef}
        data-interactive-zone="true"
      >
        <div className="flex items-center justify-between border-b border-slate-200/70 px-24 py-10">
          <div className="flex flex-1 flex-col gap-2">
            <input
              ref={titleRef}
              value={title}
              onChange={(event) => handleTitleChange(event.target.value)}
              placeholder="제목 없는 페이지"
              className="text-3xl font-semibold tracking-tight text-slate-900 outline-none placeholder:text-slate-400"
              style={{ backgroundColor: 'transparent' }}
            />
            <p className="text-xs text-slate-400">생각을 빠르게 적고, 가볍게 구조화하세요.</p>
          </div>
          <div className="flex items-center gap-2">
            {typeof onDelete === 'function' && (
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  onDelete();
                }}
                className="rounded-full border border-red-200 px-3 py-1 text-xs font-medium text-red-500 transition hover:bg-red-50"
              >
                삭제
              </button>
            )}
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                onClose();
              }}
              className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100"
            >
              닫기
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-24 py-12">
          <div className="flex flex-col gap-4">
            {blocks.map((block, index) => renderBlock(block, [index], 0))}
          </div>
        </div>

        <SlashCommandPalette
          isOpen={slashPalette.state.open}
          anchor={slashPalette.state.anchor}
          categories={SLASH_PALETTE_CATEGORIES}
          options={slashPalette.options}
          recentOptionIds={slashPalette.recentOptionIds}
          activeIndex={slashPalette.state.activeIndex}
          searchQuery={slashPalette.state.query}
          activeCategory={slashPalette.state.category}
          onSearchChange={slashPalette.onSearchChange}
          onCategoryChange={slashPalette.onCategoryChange}
          onSelect={slashPalette.onSelect}
          onHover={slashPalette.onHover}
          onClose={slashPalette.onClose}
          onMove={slashPalette.onMove}
          onConfirm={slashPalette.onConfirm}
        />

        <InlineFormatToolbar
          visible={formatToolbar.state.visible}
          position={formatToolbar.state.position}
          activeFormats={formatToolbar.state.active}
          onFormat={formatToolbar.onFormat}
          onLink={formatToolbar.onLink}
          onRemoveLink={formatToolbar.onRemoveLink}
          onColor={formatToolbar.onColor}
          onHighlight={formatToolbar.onHighlight}
        />
      </motion.div>
    )}
  </AnimatePresence>
);

export default MemoEditorView;
