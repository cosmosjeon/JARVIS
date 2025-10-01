import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';

const MemoPanel = ({ memo, onClose, onUpdate }) => {
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const debounceRef = useRef(null);
    const isHydratingRef = useRef(false);

    useEffect(() => {
        const nextTitle = memo?.memo?.title || '';
        const nextContent = memo?.memo?.content || '';
        isHydratingRef.current = true;
        setTitle(nextTitle);
        setContent(nextContent);
        return () => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
                debounceRef.current = null;
            }
        };
    }, [memo?.id, memo?.memo?.title, memo?.memo?.content]);

    useEffect(() => {
        if (!memo || typeof onUpdate !== 'function') {
            return () => undefined;
        }

        if (isHydratingRef.current) {
            isHydratingRef.current = false;
            return () => undefined;
        }

        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }

        debounceRef.current = setTimeout(() => {
            onUpdate({
                title,
                content,
            });
        }, 240);

        return () => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
                debounceRef.current = null;
            }
        };
    }, [title, content, memo, onUpdate]);

    const displayLabel = memo?.memo?.title || memo?.keyword || memo?.id || '메모';

    return (
        <motion.div
            className="flex h-full w-full flex-col rounded-2xl border border-white/8 bg-zinc-950/90 p-6 shadow-2xl backdrop-blur"
            initial={{ opacity: 0, scale: 0.98, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 8 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
        >
            <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-white/40">Memo</p>
                    <h2 className="mt-1 text-xl font-semibold text-white">
                        {displayLabel}
                    </h2>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/70 transition hover:bg-white/15 hover:text-white"
                >
                    닫기
                </button>
            </div>

            <div className="flex flex-1 flex-col gap-4">
                <div className="space-y-2">
                    <label className="text-xs font-medium text-white/60" htmlFor="memo-title-input">
                        제목
                    </label>
                    <Input
                        id="memo-title-input"
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                        placeholder="메모 제목"
                        className="bg-white/5 text-white placeholder:text-white/30"
                    />
                </div>

                <div className="flex-1 space-y-2">
                    <label className="text-xs font-medium text-white/60" htmlFor="memo-content-input">
                        내용
                    </label>
                    <Textarea
                        id="memo-content-input"
                        value={content}
                        onChange={(event) => setContent(event.target.value)}
                        placeholder="메모 내용을 입력하세요"
                        className="min-h-[220px] flex-1 resize-none bg-white/5 text-[13px] text-white placeholder:text-white/30"
                    />
                </div>

                <p className="mt-auto text-right text-[11px] text-white/40">변경사항은 자동으로 저장됩니다.</p>
            </div>
        </motion.div>
    );
};

export default MemoPanel;
