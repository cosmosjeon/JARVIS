import React, { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

const escapeHtml = (value = '') =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const renderMath = (expression, displayMode = false) => {
  try {
    return katex.renderToString(expression, {
      throwOnError: false,
      displayMode,
    });
  } catch (error) {
    try {
      return katex.renderToString(expression.replace(/\\\\/g, '\\'), {
        throwOnError: false,
        displayMode,
      });
    } catch (secondaryError) {
      const safe = escapeHtml(expression);
      return displayMode ? `<span class="text-slate-100">${safe}</span>` : safe;
    }
  }
};

const parseMarkdownBlocks = (text = '') => {
  const lines = text.split(/\r?\n/);
  const blocks = [];
  let currentList = null;
  let currentCodeBlock = null;

  lines.forEach((line) => {
    const trimmed = line.trim();

    if (trimmed.startsWith('$$') && trimmed.endsWith('$$') && trimmed.length > 3) {
      blocks.push({ type: 'math', content: trimmed.slice(2, -2).trim(), displayMode: true });
      currentList = null;
      return;
    }

    if (trimmed.startsWith('\\[') && trimmed.endsWith('\\]')) {
      blocks.push({ type: 'math', content: trimmed.slice(2, -2).trim(), displayMode: true });
      currentList = null;
      return;
    }

    if (trimmed.startsWith('```')) {
      if (currentCodeBlock) {
        blocks.push(currentCodeBlock);
        currentCodeBlock = null;
      } else {
        const language = trimmed.slice(3).trim();
        currentCodeBlock = { type: 'code', language, content: [] };
      }
      currentList = null;
      return;
    }

    if (currentCodeBlock) {
      currentCodeBlock.content.push(line);
      return;
    }

    if (!trimmed) {
      currentList = null;
      return;
    }

    if (/^#{1,6}\s+/.test(trimmed)) {
      const level = trimmed.match(/^(#{1,6})/)[1].length;
      const content = trimmed.replace(/^#{1,6}\s+/, '');
      blocks.push({ type: 'heading', level, content });
      currentList = null;
      return;
    }

    if (/^[-*+]\s+/.test(trimmed)) {
      if (!currentList) {
        currentList = { type: 'list', items: [] };
        blocks.push(currentList);
      }
      currentList.items.push(trimmed.replace(/^[-*+]\s+/, '').trim());
      return;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      if (!currentList || currentList.ordered !== true) {
        currentList = { type: 'list', ordered: true, items: [] };
        blocks.push(currentList);
      }
      currentList.items.push(trimmed.replace(/^\d+\.\s+/, '').trim());
      return;
    }

    currentList = null;
    blocks.push({ type: 'paragraph', content: trimmed });
  });

  if (currentCodeBlock) {
    blocks.push(currentCodeBlock);
  }

  return blocks;
};

const parseInlineMarkdown = (text = '', textColor = '') => {
  const parts = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    const mathInlineMatch = remaining.match(/^\\\((.+?)\\\)/);
    if (mathInlineMatch) {
      parts.push(
        <span
          key={`math-inline-${key++}`}
          className="inline-flex items-center"
          dangerouslySetInnerHTML={{ __html: renderMath(mathInlineMatch[1], false) }}
        />
      );
      remaining = remaining.slice(mathInlineMatch[0].length);
      continue;
    }

    const codeMatch = remaining.match(/^`([^`]+)`/);
    if (codeMatch) {
      parts.push(
        <code
          key={`code-${key++}`}
          className="px-1 py-0.5 rounded text-xs font-mono"
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.1)',
            color: textColor || 'rgb(16, 185, 129)'
          }}
        >
          {codeMatch[1]}
        </code>
      );
      remaining = remaining.slice(codeMatch[0].length);
      continue;
    }

    const boldMatch = remaining.match(/^\*\*([^*]+)\*\*/);
    if (boldMatch) {
      parts.push(
        <strong key={`bold-${key++}`} className="font-semibold" style={{ color: textColor }}>
          {boldMatch[1]}
        </strong>
      );
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }

    const italicMatch = remaining.match(/^\*([^*]+)\*/);
    if (italicMatch) {
      parts.push(
        <em key={`italic-${key++}`} className="italic" style={{ color: textColor }}>
          {italicMatch[1]}
        </em>
      );
      remaining = remaining.slice(italicMatch[0].length);
      continue;
    }

    const mathInlineDollar = remaining.match(/^\$\$(.+?)\$\$/);
    if (mathInlineDollar) {
      parts.push(
        <span
          key={`math-inline-dollar-${key++}`}
          className="inline-flex items-center"
          dangerouslySetInnerHTML={{ __html: renderMath(mathInlineDollar[1], false) }}
        />
      );
      remaining = remaining.slice(mathInlineDollar[0].length);
      continue;
    }

    const nextSpecial = remaining.search(/[`*]|\\\(|\$\$/);
    if (nextSpecial === -1) {
      parts.push(remaining);
      break;
    } else if (nextSpecial === 0) {
      parts.push(remaining[0]);
      remaining = remaining.slice(1);
    } else {
      parts.push(remaining.slice(0, nextSpecial));
      remaining = remaining.slice(nextSpecial);
    }
  }

  return parts;
};

const MarkdownMessage = ({ text = '', className = '', style = {} }) => {
  const blocks = useMemo(() => parseMarkdownBlocks(text), [text]);

  if (!blocks.length) {
    return null;
  }

  const containerClass = ['markdown-body space-y-4', className].filter(Boolean).join(' ');

  return (
    <div className={containerClass} style={style}>
      {blocks.map((block, blockIndex) => {
        if (block.type === 'heading') {
          const HeadingTag = `h${Math.min(block.level, 6)}`;
          const headingClasses = {
            1: 'text-[28px] font-semibold text-slate-50 tracking-tight',
            2: 'text-2xl font-semibold text-slate-100',
            3: 'text-xl font-semibold text-slate-100',
            4: 'text-lg font-semibold text-slate-200',
            5: 'text-base font-semibold text-slate-200',
            6: 'text-sm font-medium text-slate-300',
          };

          return (
            <HeadingTag key={`md-heading-${blockIndex}`} className={headingClasses[block.level].replace(/text-slate-\d+/g, '').trim()} style={{ color: style.color }}>
              {parseInlineMarkdown(block.content, style.color)}
            </HeadingTag>
          );
        }

        if (block.type === 'math') {
          return (
            <div
              key={`md-math-${blockIndex}`}
              className="rounded-xl bg-white/5 p-4 text-center"
              dangerouslySetInnerHTML={{ __html: renderMath(block.content, block.displayMode) }}
            />
          );
        }

        if (block.type === 'code') {
          return (
            <div key={`md-code-${blockIndex}`} className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
              {block.language && (
                <div className="mb-2 text-xs uppercase tracking-wide text-slate-400">{block.language}</div>
              )}
              <pre className="text-sm text-slate-200 font-mono whitespace-pre-wrap overflow-x-auto">
                <code>{block.content.join('\n')}</code>
              </pre>
            </div>
          );
        }

        if (block.type === 'list') {
          const ListTag = block.ordered ? 'ol' : 'ul';
          const listClasses = block.ordered
            ? 'list-decimal list-outside space-y-2 pl-6 text-slate-100'
            : 'list-disc list-outside space-y-2 pl-6 text-slate-100';

          return (
            <ListTag key={`md-list-${blockIndex}`} className={listClasses.replace(/text-slate-\d+/g, '').trim()} style={{ color: style.color }}>
              {block.items.map((item, itemIndex) => (
                <li key={`md-list-item-${blockIndex}-${itemIndex}`} className="leading-relaxed">
                  {parseInlineMarkdown(item, style.color)}
                </li>
              ))}
            </ListTag>
          );
        }

        return (
          <p key={`md-paragraph-${blockIndex}`} className="leading-7" style={{ color: style.color }}>
            {parseInlineMarkdown(block.content, style.color)}
          </p>
        );
      })}
    </div>
  );
};

export default MarkdownMessage;
