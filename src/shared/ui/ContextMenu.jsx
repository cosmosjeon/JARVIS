import React, { useState, useEffect, useRef } from 'react';
import { cn } from 'shared/utils';

const ContextMenu = ({ 
  children, 
  items = [], 
  onOpen, 
  onClose,
  className = ""
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const menuRef = useRef(null);
  const triggerRef = useRef(null);

  const handleContextMenu = (e) => {
    e.preventDefault();
    
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      const x = e.clientX;
      const y = e.clientY;
      
      // 화면 경계 체크
      const menuWidth = 200;
      const menuHeight = items.length * 32 + 16; // 대략적인 높이
      
      let adjustedX = x;
      let adjustedY = y;
      
      if (x + menuWidth > window.innerWidth) {
        adjustedX = x - menuWidth;
      }
      
      if (y + menuHeight > window.innerHeight) {
        adjustedY = y - menuHeight;
      }
      
      setPosition({ x: adjustedX, y: adjustedY });
    }
    
    setIsOpen(true);
    onOpen?.(e);
  };

  const handleClose = () => {
    setIsOpen(false);
    onClose?.();
  };

  const handleItemClick = (item) => {
    if (item.onClick) {
      item.onClick();
    }
    handleClose();
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target) && 
          triggerRef.current && !triggerRef.current.contains(e.target)) {
        handleClose();
      }
    };

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  return (
    <>
      <div
        ref={triggerRef}
        onContextMenu={handleContextMenu}
        className={className}
      >
        {children}
      </div>
      
      {isOpen && (
        <div
          ref={menuRef}
          className="fixed z-50 min-w-[160px] bg-popover border border-border rounded-md shadow-lg py-1"
          style={{
            left: position.x,
            top: position.y,
          }}
        >
          {items.map((item, index) => (
            <button
              key={index}
              onClick={() => handleItemClick(item)}
              className={cn(
                "w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground transition-colors",
                item.disabled && "opacity-50 cursor-not-allowed",
                item.danger && "text-destructive hover:text-destructive"
              )}
              disabled={item.disabled}
            >
              <div className="flex items-center gap-2">
                {item.icon && <span className="h-4 w-4">{item.icon}</span>}
                <span>{item.label}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </>
  );
};

export default ContextMenu;
