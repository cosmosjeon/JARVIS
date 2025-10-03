import React, { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { CodeBlock, CodeBlockCopyButton } from '../ui/shadcn-io/ai/code-block';

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
  let currentQuote = null;
  let currentMathBlock = null; // { delimiter: '$$' | '\\[', content: [] }

  lines.forEach((line) => {
    const trimmed = line.trim();

    // 코드 블록 토글
    if (trimmed.startsWith('```')) {
      if (currentCodeBlock) {
        blocks.push(currentCodeBlock);
        currentCodeBlock = null;
      } else {
        const language = trimmed.slice(3).trim();
        currentCodeBlock = { type: 'code', language, content: [] };
      }
      currentList = null;
      currentQuote = null;
      return;
    }

    // 코드 블록 내부는 그대로 저장
    if (currentCodeBlock) {
      currentCodeBlock.content.push(line);
      return;
    }

    // 수학 블록 시작/종료 처리: $$ ... $$ (멀티라인)
    if (!currentMathBlock && trimmed.startsWith('$$')) {
      // 단일 라인 $$...$$
      if (trimmed.endsWith('$$') && trimmed.length > 3) {
        const inlineContent = trimmed.slice(2, -2).trim();
        blocks.push({ type: 'math', content: inlineContent, displayMode: true });
      } else {
        currentMathBlock = { delimiter: '$$', content: [] };
        const first = trimmed.slice(2).trim();
        if (first) currentMathBlock.content.push(first);
      }
      currentList = null;
      currentQuote = null;
      return;
    }

    if (currentMathBlock && currentMathBlock.delimiter === '$$') {
      if (trimmed.endsWith('$$')) {
        const before = trimmed.slice(0, -2).trim();
        if (before) currentMathBlock.content.push(before);
        blocks.push({ type: 'math', content: currentMathBlock.content.join('\n'), displayMode: true });
        currentMathBlock = null;
      } else {
        currentMathBlock.content.push(line);
      }
      return;
    }

    // 수학 블록 시작/종료 처리: \[ ... \] (멀티라인)
    if (!currentMathBlock && trimmed.startsWith('\\[')) {
      if (trimmed.endsWith('\\]')) {
        const inlineContent = trimmed.slice(2, -2).trim();
        blocks.push({ type: 'math', content: inlineContent, displayMode: true });
      } else {
        currentMathBlock = { delimiter: '\\[', content: [] };
        const first = trimmed.slice(2).trim();
        if (first) currentMathBlock.content.push(first);
      }
      currentList = null;
      currentQuote = null;
      return;
    }

    if (currentMathBlock && currentMathBlock.delimiter === '\\[') {
      if (trimmed.endsWith('\\]')) {
        const before = trimmed.slice(0, -2).trim();
        if (before) currentMathBlock.content.push(before);
        blocks.push({ type: 'math', content: currentMathBlock.content.join('\n'), displayMode: true });
        currentMathBlock = null;
      } else {
        currentMathBlock.content.push(line);
      }
      return;
    }

    // 빈 줄에서 열린 인용구나 리스트를 종료
    if (!trimmed) {
      if (currentQuote) {
        blocks.push(currentQuote);
        currentQuote = null;
      }
      currentList = null;
      return;
    }

    // 제목
    if (/^#{1,6}\s+/.test(trimmed)) {
      const level = trimmed.match(/^(#{1,6})/)[1].length;
      const content = trimmed.replace(/^#{1,6}\s+/, '');
      blocks.push({ type: 'heading', level, content });
      currentList = null;
      if (currentQuote) {
        blocks.push(currentQuote);
        currentQuote = null;
      }
      return;
    }

    // 수평선(구분선)
    if (/^(?:-{3,}|_{3,}|\*{3,})$/.test(trimmed)) {
      if (currentQuote) {
        blocks.push(currentQuote);
        currentQuote = null;
      }
      currentList = null;
      blocks.push({ type: 'hr' });
      return;
    }

    // 인용문 블록
    if (/^>\s?/.test(trimmed)) {
      const quoteText = trimmed.replace(/^>\s?/, '');
      if (!currentQuote) {
        currentQuote = { type: 'blockquote', lines: [] };
        blocks.push(currentQuote);
      }
      currentQuote.lines.push(quoteText);
      currentList = null;
      return;
    } else if (currentQuote) {
      currentQuote = null;
    }

    // 리스트
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

    // 일반 문단
    currentList = null;
    blocks.push({ type: 'paragraph', content: trimmed });
  });

  if (currentCodeBlock) {
    blocks.push(currentCodeBlock);
  }
  if (currentQuote) {
    blocks.push(currentQuote);
  }
  if (currentMathBlock) {
    blocks.push({ type: 'math', content: currentMathBlock.content.join('\n'), displayMode: true });
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

    // 인라인 수학: $...$ (단, $$...$$는 별도 처리)
    const mathInlineSingle = remaining.match(/^\$(?!\$)([^\n$]+?)\$/);
    if (mathInlineSingle) {
      parts.push(
        <span
          key={`math-inline-single-${key++}`}
          className="inline-flex items-center"
          dangerouslySetInnerHTML={{ __html: renderMath(mathInlineSingle[1], false) }}
        />
      );
      remaining = remaining.slice(mathInlineSingle[0].length);
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

    // 링크 [text](url)
    const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)\s]+)\)/);
    if (linkMatch) {
      const [, label, url] = linkMatch;
      parts.push(
        <a
          key={`link-${key++}`}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="underline decoration-dotted underline-offset-4 hover:decoration-solid"
          style={{ color: textColor || 'rgb(59,130,246)' }}
        >
          {label}
        </a>
      );
      remaining = remaining.slice(linkMatch[0].length);
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

    const nextSpecial = remaining.search(/[`*]|\\\(|\$\$|\$(?!\$)/);
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
          const code = block.content.join('\n');
          return (
            <CodeBlock
              key={`md-code-${blockIndex}`}
              code={code}
              language={block.language || 'text'}
              showLineNumbers={false}
            >
              <CodeBlockCopyButton />
            </CodeBlock>
          );
        }

        if (block.type === 'blockquote') {
          return (
            <blockquote
              key={`md-quote-${blockIndex}`}
              className="border-l-2 pl-4 italic"
              style={{ borderColor: 'rgba(148, 163, 184, 0.4)', color: style.color }}
            >
              {block.lines.map((line, i) => (
                <p key={`md-quote-line-${blockIndex}-${i}`} className="leading-7">
                  {parseInlineMarkdown(line, style.color)}
                </p>
              ))}
            </blockquote>
          );
        }

        if (block.type === 'hr') {
          return <hr key={`md-hr-${blockIndex}`} className="my-4 opacity-40" />;
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
