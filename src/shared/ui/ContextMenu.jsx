import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
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
  const pointerRef = useRef({ x: 0, y: 0 });
  const [portalTarget, setPortalTarget] = useState(null);

  const handleContextMenu = (e) => {
    e.preventDefault();
    
    const rect = triggerRef.current?.getBoundingClientRect();
    let x = e.clientX;
    let y = e.clientY;

    // 키보드로 컨텍스트 메뉴를 연 경우 client 좌표가 (0,0)이 될 수 있으므로
    // 트리거 요소 중심을 기준으로 위치를 계산한다.
    if (x === 0 && y === 0 && rect) {
      x = rect.left + rect.width / 2;
      y = rect.top + rect.height / 2;
    }

    pointerRef.current = { x, y };
    setPosition({ x, y });
    
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
    if (typeof document !== 'undefined') {
      setPortalTarget(document.body);
    }
  }, []);

  useLayoutEffect(() => {
    if (!isOpen || !menuRef.current || typeof window === 'undefined') {
      return;
    }

    const menuRect = menuRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const { x, y } = pointerRef.current;

    let adjustedX = x;
    let adjustedY = y;

    if (x + menuRect.width > viewportWidth) {
      adjustedX = Math.max(0, viewportWidth - menuRect.width - 8);
    }

    if (y + menuRect.height > viewportHeight) {
      adjustedY = Math.max(0, viewportHeight - menuRect.height - 8);
    }

    setPosition((prev) => {
      if (prev.x === adjustedX && prev.y === adjustedY) {
        return prev;
      }
      return { x: adjustedX, y: adjustedY };
    });
  }, [isOpen, items.length]);

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

  const renderMenu = () => {
    if (!isOpen) {
      return null;
    }

    const menu = (
      <div
        ref={menuRef}
        className="fixed z-50 min-w-[160px] bg-popover border border-border rounded-md shadow-lg py-1"
        style={{
          left: position.x,
          top: position.y,
        }}
        onContextMenu={(event) => event.preventDefault()}
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
    );

    if (portalTarget) {
      return createPortal(menu, portalTarget);
    }

    return menu;
  };

  return (
    <>
      <div
        ref={triggerRef}
        onContextMenu={handleContextMenu}
        className={className}
      >
        {children}
      </div>
      {renderMenu()}
    </>
  );
};

export default ContextMenu;
