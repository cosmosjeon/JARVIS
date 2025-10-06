import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from 'shared/utils';

const VoranToastStack = ({ toasts, toastVisuals, onToastAction }) => (
  <div className="pointer-events-none fixed right-6 top-6 z-[101] space-y-2">
    <AnimatePresence>
      {toasts.map((toast) => {
        const visuals = toastVisuals[toast.type] || toastVisuals.default;
        const Icon = visuals.Icon;
        return (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.18 }}
            className={cn(
              'pointer-events-auto flex min-w-[260px] max-w-[320px] items-start gap-3 rounded-lg px-4 py-3 shadow-lg backdrop-blur-sm',
              visuals.container,
            )}
          >
            <Icon className={cn('h-4 w-4 mt-0.5 flex-shrink-0', visuals.iconClass)} />
            <div className="flex-1 text-xs leading-5">{toast.message}</div>
            {toast.actionLabel && toast.onAction && (
              <button
                type="button"
                className="text-xs font-semibold text-blue-200 hover:text-white"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onToastAction(toast);
                }}
              >
                {toast.actionLabel}
              </button>
            )}
          </motion.div>
        );
      })}
    </AnimatePresence>
  </div>
);

export default VoranToastStack;
