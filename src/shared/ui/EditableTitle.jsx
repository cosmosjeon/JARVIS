import React, { useState, useRef, useEffect } from 'react';
import { Edit3 } from 'lucide-react';

export const EDITABLE_TITLE_ACTIVE_ATTR = 'data-editable-title-active';

const EditableTitle = ({ 
  title, 
  onUpdate, 
  className = "text-lg font-semibold text-foreground",
  placeholder = "제목을 입력하세요"
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(title);
  const inputRef = useRef(null);

  useEffect(() => {
    setEditValue(title);
  }, [title]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleStartEdit = () => {
    setIsEditing(true);
  };

  const handleDoubleClick = () => {
    handleStartEdit();
  };

  const handleEditIconClick = () => {
    handleStartEdit();
  };

  const handleSave = () => {
    const trimmedValue = editValue.trim();
    if (trimmedValue && trimmedValue !== title) {
      onUpdate(trimmedValue);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(title);
    setIsEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };

  const handleBlur = () => {
    handleSave();
  };

  if (isEditing) {
    const editableAttrs = { [EDITABLE_TITLE_ACTIVE_ATTR]: 'true' };
    return (
      <div
        className="group relative inline-flex items-center gap-2 p-1 -m-1 rounded bg-muted/20"
        {...editableAttrs}
      >
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder={placeholder}
          className={`${className} bg-transparent border-b-2 border-primary outline-none flex-1 min-w-0`}
          {...editableAttrs}
        />
        <Edit3
          className="h-4 w-4 text-primary animate-pulse flex-shrink-0"
          title="편집 중"
        />
      </div>
    );
  }

  return (
    <div className="group relative inline-flex items-center gap-2 p-1 -m-1 rounded hover:bg-muted/50 transition-colors">
      <h1 
        className={`${className} cursor-pointer hover:text-primary transition-colors`}
        onDoubleClick={handleDoubleClick}
        title="더블클릭하여 편집"
      >
        {title}
      </h1>
      <Edit3 
        className="h-4 w-4 text-muted-foreground/70 cursor-pointer hover:text-primary hover:scale-110 transition-all duration-200 flex-shrink-0" 
        title="편집 가능 (클릭 또는 더블클릭)"
        onClick={handleEditIconClick}
      />
    </div>
  );
};

export default EditableTitle;
