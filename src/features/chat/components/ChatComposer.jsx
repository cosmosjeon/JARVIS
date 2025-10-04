import React, { useState } from 'react';
import { Textarea } from 'shared/ui/textarea';
import { Button } from 'shared/ui/button';
import { Send } from 'lucide-react';

export default function ChatComposer({ onSend, placeholder = '아이디어, 질문, 다음 액션을 입력하세요...' }) {
  const [value, setValue] = useState('');
  const [isComposing, setIsComposing] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    onSend?.(trimmed);
    setValue('');
  };

  return (
    <form className="flex flex-col gap-3 border-t border-border/80 bg-background/10 p-5" onSubmit={handleSubmit}>
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && !isComposing) {
            e.preventDefault();
            handleSubmit(e);
          }
        }}
        onCompositionStart={() => setIsComposing(true)}
        onCompositionEnd={() => setIsComposing(false)}
        placeholder={placeholder}
        className="min-h-[108px] resize-none rounded-2xl border border-border/80 bg-card/80 px-4 py-3 text-sm text-card-foreground placeholder:text-muted-foreground"
      />
      <div className="flex items-center justify-end">
        <Button type="submit" disabled={!value.trim()} className="gap-2">
          <Send className="h-4 w-4" />
          전송
        </Button>
      </div>
    </form>
  );
}


