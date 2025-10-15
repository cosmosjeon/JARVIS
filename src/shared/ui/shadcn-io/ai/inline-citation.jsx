import React, { useState } from 'react';
import { cn } from 'shared/utils';
import { ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from 'shared/ui/button';
import { Card, CardContent } from 'shared/ui/card';

// InlineCitation - 메인 컨테이너
export const InlineCitation = ({ children, className }) => (
  <span className={cn('inline-block relative', className)}>
    {children}
  </span>
);

// InlineCitationText - 인용된 텍스트
export const InlineCitationText = ({ children, className }) => (
  <span className={cn('underline decoration-dotted decoration-muted-foreground/50 cursor-help', className)}>
    {children}
  </span>
);

// InlineCitationCard - 출처 카드 컨테이너
export const InlineCitationCard = ({ children, className }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <span className={cn('relative', className)}>
      {React.Children.map(children, (child) => {
        if (child.type === InlineCitationCardTrigger) {
          return React.cloneElement(child, { isOpen, setIsOpen });
        }
        if (child.type === InlineCitationCardBody) {
          return isOpen ? React.cloneElement(child, { setIsOpen }) : null;
        }
        return child;
      })}
    </span>
  );
};

// InlineCitationCardTrigger - 출처 개수 표시 버튼
export const InlineCitationCardTrigger = ({ sources = [], isOpen, setIsOpen, className }) => {
  const count = Array.isArray(sources) ? sources.length : 0;

  return (
    <button
      type="button"
      onClick={() => setIsOpen(!isOpen)}
      className={cn(
        'inline-flex items-center justify-center',
        'h-5 min-w-5 px-1.5',
        'text-xs font-medium',
        'rounded-full',
        'bg-primary/10 hover:bg-primary/20',
        'text-primary',
        'transition-colors',
        'ml-1 align-super',
        className
      )}
      aria-label={`${count} sources`}
    >
      {count}
    </button>
  );
};

// InlineCitationCardBody - 출처 목록 표시
export const InlineCitationCardBody = ({ children, setIsOpen, className }) => {
  const handleClose = () => setIsOpen(false);

  return (
    <div
      className={cn(
        'absolute z-50 mt-2 left-0',
        'w-80 max-w-[calc(100vw-2rem)]',
        className
      )}
    >
      <Card className="shadow-lg border-border/50">
        <CardContent className="p-0">
          {React.Children.map(children, (child) => {
            if (React.isValidElement(child)) {
              return React.cloneElement(child, { onClose: handleClose });
            }
            return child;
          })}
        </CardContent>
      </Card>
    </div>
  );
};

// InlineCitationCarousel - 출처 캐러셀
export const InlineCitationCarousel = ({ children, className }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const sources = React.Children.toArray(children).filter(
    (child) => child.type === InlineCitationCarouselItem
  );
  const totalSources = sources.length;

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % totalSources);
  };

  const goToPrev = () => {
    setCurrentIndex((prev) => (prev - 1 + totalSources) % totalSources);
  };

  return (
    <div className={cn('relative', className)}>
      {React.Children.map(children, (child) => {
        if (child.type === InlineCitationCarouselContent) {
          return React.cloneElement(child, { currentIndex, sources });
        }
        if (child.type === InlineCitationCarouselHeader) {
          return React.cloneElement(child, {
            currentIndex,
            totalSources,
            goToNext,
            goToPrev,
          });
        }
        return null;
      })}
    </div>
  );
};

// InlineCitationCarouselHeader - 캐러셀 헤더
export const InlineCitationCarouselHeader = ({
  currentIndex = 0,
  totalSources = 0,
  goToNext,
  goToPrev,
  onClose,
  className,
}) => (
  <div className={cn('flex items-center justify-between p-3 border-b', className)}>
    <InlineCitationCarouselIndex current={currentIndex + 1} total={totalSources} />
    <div className="flex items-center gap-1">
      <InlineCitationCarouselPrev onClick={goToPrev} disabled={totalSources <= 1} />
      <InlineCitationCarouselNext onClick={goToNext} disabled={totalSources <= 1} />
    </div>
  </div>
);

// InlineCitationCarouselIndex - 현재 위치 표시
export const InlineCitationCarouselIndex = ({ current, total, className }) => (
  <span className={cn('text-xs text-muted-foreground font-medium', className)}>
    {current} of {total}
  </span>
);

// InlineCitationCarouselPrev - 이전 버튼
export const InlineCitationCarouselPrev = ({ onClick, disabled, className }) => (
  <Button
    type="button"
    variant="ghost"
    size="icon"
    className={cn('h-7 w-7', className)}
    onClick={onClick}
    disabled={disabled}
  >
    <ChevronLeft className="h-4 w-4" />
  </Button>
);

// InlineCitationCarouselNext - 다음 버튼
export const InlineCitationCarouselNext = ({ onClick, disabled, className }) => (
  <Button
    type="button"
    variant="ghost"
    size="icon"
    className={cn('h-7 w-7', className)}
    onClick={onClick}
    disabled={disabled}
  >
    <ChevronRight className="h-4 w-4" />
  </Button>
);

// InlineCitationCarouselContent - 캐러셀 콘텐츠
export const InlineCitationCarouselContent = ({ currentIndex = 0, sources = [], className }) => {
  const currentSource = sources[currentIndex];

  return (
    <div className={cn('p-4', className)}>
      {currentSource}
    </div>
  );
};

// InlineCitationCarouselItem - 캐러셀 아이템 (래퍼)
export const InlineCitationCarouselItem = ({ children }) => children;

// InlineCitationSource - 출처 정보 표시
export const InlineCitationSource = ({ title, url, description, favicon, className }) => (
  <a
    href={url}
    target="_blank"
    rel="noopener noreferrer"
    className={cn(
      'block group',
      'hover:bg-accent/50 rounded-lg p-3 -m-3',
      'transition-colors',
      className
    )}
  >
    <div className="flex items-start gap-3">
      {favicon && (
        <img
          src={favicon}
          alt=""
          className="w-4 h-4 mt-0.5 rounded"
          onError={(e) => {
            e.target.style.display = 'none';
          }}
        />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h4 className="text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate">
            {title}
          </h4>
          <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
        </div>
        {description && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {description}
          </p>
        )}
        {url && (
          <p className="text-xs text-muted-foreground/70 truncate mt-1">
            {new URL(url).hostname}
          </p>
        )}
      </div>
    </div>
  </a>
);
