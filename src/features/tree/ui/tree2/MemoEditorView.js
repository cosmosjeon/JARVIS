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
        <div className="flex border-b border-slate-200/70 px-24 py-10">
          <div className="flex flex-col gap-2">
            <input
              ref={titleRef}
              value={title}
              onChange={(event) => handleTitleChange(event.target.value)}
              placeholder="제목 없는 페이지"
              className="text-3xl font-semibold tracking-tight outline-none placeholder:text-[color:var(--memo-title-placeholder-color)]"
              style={{
                backgroundColor: 'transparent',
                color: palette.text,
                '--memo-title-placeholder-color': palette.hint,
              }}
            />
            <p className="text-xs text-slate-400">생각을 빠르게 적고, 가볍게 구조화하세요.</p>
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
