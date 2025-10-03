import React, { useState } from 'react';
import memoEditorTokens from './tokens';

const INLINE_COLORS = [
    memoEditorTokens.color.tint.blue,
    memoEditorTokens.color.tint.green,
    memoEditorTokens.color.tint.yellow,
    memoEditorTokens.color.tint.orange,
    memoEditorTokens.color.tint.red,
];

const InlineFormatToolbar = ({
    visible,
    position,
    onFormat,
    onLink,
    onColor,
    onHighlight,
    onRemoveLink,
    activeFormats,
}) => {
    const [colorPickerOpen, setColorPickerOpen] = useState(false);
    const [highlightPickerOpen, setHighlightPickerOpen] = useState(false);

    if (!visible) {
        return null;
    }

    return (
        <div
            className="pointer-events-auto absolute z-[1300] flex gap-1 rounded-full border border-slate-200 bg-white px-1 py-1 shadow-xl"
            style={{
                top: position.top,
                left: position.left,
                boxShadow: memoEditorTokens.shadow.card,
            }}
        >
            <button
                type="button"
                className={`h-8 w-8 rounded-full text-sm font-semibold transition ${activeFormats.bold ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                onMouseDown={(event) => {
                    event.preventDefault();
                    onFormat('bold');
                }}
            >
                B
            </button>
            <button
                type="button"
                className={`h-8 w-8 rounded-full text-sm font-semibold italic transition ${activeFormats.italic ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                onMouseDown={(event) => {
                    event.preventDefault();
                    onFormat('italic');
                }}
            >
                I
            </button>
            <button
                type="button"
                className={`h-8 w-8 rounded-full text-sm font-semibold line-through transition ${activeFormats.strike ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                onMouseDown={(event) => {
                    event.preventDefault();
                    onFormat('strikeThrough');
                }}
            >
                S
            </button>
            <button
                type="button"
                className={`h-8 w-8 rounded-full text-xs font-semibold transition ${activeFormats.code ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                onMouseDown={(event) => {
                    event.preventDefault();
                    onFormat('code');
                }}
            >
                {'</>'}
            </button>
            <div className="relative">
                <button
                    type="button"
                    className={`h-8 w-8 rounded-full text-xs font-semibold transition ${activeFormats.link ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                    onMouseDown={(event) => {
                        event.preventDefault();
                        if (activeFormats.link) {
                            onRemoveLink();
                        } else {
                            onLink();
                        }
                    }}
                >
                    🔗
                </button>
            </div>
            <div className="relative">
                <button
                    type="button"
                    className={`h-8 w-8 rounded-full text-xs font-semibold transition ${colorPickerOpen ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                    onMouseDown={(event) => {
                        event.preventDefault();
                        setColorPickerOpen((prev) => !prev);
                        setHighlightPickerOpen(false);
                    }}
                >
                    A
                </button>
                {colorPickerOpen && (
                    <div className="absolute left-1/2 top-full z-[1400] mt-2 flex -translate-x-1/2 gap-1 rounded-lg border border-slate-200 bg-white px-2 py-2 shadow-lg">
                        {INLINE_COLORS.map((color) => (
                            <button
                                key={color}
                                type="button"
                                className="h-6 w-6 rounded-full border border-slate-200"
                                style={{ backgroundColor: color }}
                                onMouseDown={(event) => {
                                    event.preventDefault();
                                    onColor(color);
                                    setColorPickerOpen(false);
                                }}
                                aria-label={`텍스트 색상 ${color}`}
                            />
                        ))}
                    </div>
                )}
            </div>
            <div className="relative">
                <button
                    type="button"
                    className={`h-8 w-8 rounded-full text-xs font-semibold transition ${highlightPickerOpen ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                    onMouseDown={(event) => {
                        event.preventDefault();
                        setHighlightPickerOpen((prev) => !prev);
                        setColorPickerOpen(false);
                    }}
                >
                    ✺
                </button>
                {highlightPickerOpen && (
                    <div className="absolute left-1/2 top-full z-[1400] mt-2 flex -translate-x-1/2 gap-1 rounded-lg border border-slate-200 bg-white px-2 py-2 shadow-lg">
                        {INLINE_COLORS.map((color) => (
                            <button
                                key={color}
                                type="button"
                                className="h-6 w-6 rounded-full border border-slate-200"
                                style={{ backgroundColor: color }}
                                onMouseDown={(event) => {
                                    event.preventDefault();
                                    onHighlight(color);
                                    setHighlightPickerOpen(false);
                                }}
                                aria-label={`하이라이트 색상 ${color}`}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default InlineFormatToolbar;
