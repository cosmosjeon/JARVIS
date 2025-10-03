import React, { useEffect, useMemo, useRef } from 'react';
import memoEditorTokens from './tokens';

const highlightMatch = (label, query) => {
    if (!query) {
        return label;
    }
    const regex = new RegExp(`(${query})`, 'ig');
    const parts = label.split(regex);
    return parts.map((part, index) => {
        if (part.toLowerCase() === query.toLowerCase()) {
            return (
                <mark key={`${part}-${index}`} className="rounded-sm bg-blue-500/20 px-0.5 text-blue-600">
                    {part}
                </mark>
            );
        }
        return <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>;
    });
};

const CategoryTabs = ({ categories, activeCategory, onChange }) => (
    <div className="flex gap-1 overflow-x-auto px-3 pb-2">
        {categories.map((category) => {
            const isActive = activeCategory === category.id;
            return (
                <button
                    key={category.id}
                    type="button"
                    className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium transition ${isActive ? 'bg-slate-900 text-white' : 'bg-transparent text-slate-500 hover:text-slate-700'}`}
                    onClick={() => onChange(category.id)}
                >
                    {category.label}
                </button>
            );
        })}
    </div>
);

const OptionRow = ({ option, isActive, onSelect, onHover, search }) => (
    <li
        className={`flex cursor-pointer items-center gap-3 px-3 py-2 transition ${isActive ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'}`}
        onMouseDown={(event) => {
            event.preventDefault();
            onSelect(option);
        }}
        onMouseEnter={onHover}
    >
        <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-slate-200 text-sm font-semibold">
            {option.icon}
        </span>
        <div className="flex flex-1 flex-col">
            <span className="text-sm font-medium leading-tight text-inherit">
                {highlightMatch(option.label, search)}
            </span>
            <span className="text-[12px] text-slate-500">
                {highlightMatch(option.description || '', search)}
            </span>
        </div>
        {option.shortcut && (
            <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[11px] text-slate-600">
                {option.shortcut}
            </span>
        )}
    </li>
);

const SlashCommandPalette = ({
    isOpen,
    anchor,
    categories,
    options,
    recentOptionIds,
    activeIndex,
    onSelect,
    onHover,
    onSearchChange,
    onCategoryChange,
    searchQuery,
    activeCategory,
    onClose,
    onMove,
    onConfirm,
}) => {
    const inputRef = useRef(null);
    const paletteRef = useRef(null);

    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus({ preventScroll: true });
            inputRef.current.select();
        }
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) {
            return () => undefined;
        }
        const handleOutsideClick = (event) => {
            if (!paletteRef.current) return;
            if (!paletteRef.current.contains(event.target)) {
                onClose();
            }
        };
        window.addEventListener('mousedown', handleOutsideClick, { capture: true });
        return () => window.removeEventListener('mousedown', handleOutsideClick, { capture: true });
    }, [isOpen, onClose]);

    const filteredOptions = useMemo(() => {
        let items = options;
        if (activeCategory && activeCategory !== 'recent') {
            items = items.filter((option) => option.category === activeCategory);
        }

        if (activeCategory === 'recent' && Array.isArray(recentOptionIds) && recentOptionIds.length > 0) {
            items = recentOptionIds
                .map((id) => options.find((option) => option.id === id))
                .filter(Boolean);
        }

        if (searchQuery) {
            const lowered = searchQuery.toLowerCase();
            items = items.filter((option) => (
                option.label.toLowerCase().includes(lowered)
                || option.description?.toLowerCase().includes(lowered)
            ));
        }

        return items.slice(0, 8);
    }, [options, activeCategory, recentOptionIds, searchQuery]);

    if (!isOpen) {
        return null;
    }

    return (
        <div
            ref={paletteRef}
            className="pointer-events-auto absolute z-[1200] w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
            style={{
                top: anchor.top,
                left: anchor.left,
                boxShadow: memoEditorTokens.shadow.card,
            }}
        >
            <div className="border-b border-slate-200 bg-slate-50 px-3 py-2">
                <input
                    ref={inputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(event) => onSearchChange(event.target.value)}
                    placeholder="/ 를 입력해 블록을 추가하세요"
                    className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 outline-none focus:border-slate-400"
                    onKeyDown={(event) => {
                        if (event.key === 'Escape') {
                            event.preventDefault();
                            onClose();
                        } else if (event.key === 'ArrowDown') {
                            event.preventDefault();
                            onMove(1);
                        } else if (event.key === 'ArrowUp') {
                            event.preventDefault();
                            onMove(-1);
                        } else if (event.key === 'Enter') {
                            event.preventDefault();
                            onConfirm();
                        }
                    }}
                />
            </div>
            <CategoryTabs
                categories={categories}
                activeCategory={activeCategory}
                onChange={onCategoryChange}
            />
            <ul className="max-h-80 overflow-y-auto py-1">
                {filteredOptions.length === 0 && (
                    <li className="px-3 py-4 text-sm text-slate-400">일치하는 명령이 없습니다.</li>
                )}
                {filteredOptions.map((option, index) => (
                    <OptionRow
                        key={option.id}
                        option={option}
                        isActive={activeIndex === index}
                        onSelect={onSelect}
                        onHover={() => onHover(index)}
                        search={searchQuery}
                    />
                ))}
            </ul>
        </div>
    );
};

export default SlashCommandPalette;
