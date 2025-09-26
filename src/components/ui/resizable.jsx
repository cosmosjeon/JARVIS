import * as React from "react";
import {
  PanelGroup,
  Panel,
  PanelResizeHandle,
} from "react-resizable-panels";

import { cn } from "lib/utils";

const ResizablePanelGroup = ({ className, ...props }) => (
  <PanelGroup className={cn("flex h-full w-full", className)} {...props} />
);
ResizablePanelGroup.displayName = "ResizablePanelGroup";

const ResizablePanel = Panel;

const ResizableHandle = React.forwardRef(({ className, withHandle, ...props }, ref) => (
  <PanelResizeHandle
    ref={ref}
    className={cn(
      "relative flex w-px items-center justify-center bg-border transition-colors hover:bg-primary/40",
      className
    )}
    {...props}
  >
    {withHandle && (
      <div className="absolute inset-y-0 -start-[0.35rem] flex items-center">
        <div className="h-10 w-[3px] rounded-full bg-border" />
      </div>
    )}
  </PanelResizeHandle>
));
ResizableHandle.displayName = "ResizableHandle";

export { ResizablePanelGroup, ResizablePanel, ResizableHandle };
