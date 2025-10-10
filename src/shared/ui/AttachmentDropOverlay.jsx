import React from 'react';
import { UploadCloud } from 'lucide-react';
import { cn } from 'shared/utils';

export const AttachmentDropOverlay = ({
  message = '이미지를 놓아 첨부하세요',
  className,
}) => (
  <div
    aria-hidden="true"
    className={cn(
      'pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 rounded-[inherit] border-2 border-dashed border-primary/60 bg-primary/10 text-sm font-medium text-primary/80 backdrop-blur-sm',
      className,
    )}
  >
    <UploadCloud className="h-6 w-6" />
    <span>{message}</span>
  </div>
);

export default AttachmentDropOverlay;
