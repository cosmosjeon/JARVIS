import * as d3 from 'd3';

const DOM_DELTA_PIXEL = 0;
const DOM_DELTA_LINE = 1;
const DOM_DELTA_PAGE = 2;

const normalizeWheelDelta = (value, mode) => {
  if (!Number.isFinite(value)) {
    return 0;
  }

  switch (mode) {
    case DOM_DELTA_LINE:
      return value * 16;
    case DOM_DELTA_PAGE:
      return value * 32;
    case DOM_DELTA_PIXEL:
    default:
      return value;
  }
};

/**
 * Applies wheel gesture to the provided zoom behaviour.
 * @param {Object} params
 * @param {WheelEvent} params.event
 * @param {SVGElement|null} params.svgElement
 * @param {d3.ZoomBehavior} params.zoomBehaviour
 * @returns {boolean}
 */
export const forwardPanZoomGesture = ({ event, svgElement, zoomBehaviour }) => {
  if (!svgElement || !zoomBehaviour || !event) {
    return false;
  }

  const mode = typeof event.deltaMode === 'number' ? event.deltaMode : DOM_DELTA_PIXEL;
  const selection = d3.select(svgElement);
  const isPinch = event.ctrlKey || event.metaKey;

  if (isPinch) {
    const normalizedDeltaY = normalizeWheelDelta(event.deltaY || 0, mode);
    if (!Number.isFinite(normalizedDeltaY) || normalizedDeltaY === 0) {
      return false;
    }

    const rect = svgElement.getBoundingClientRect();
    const clientX = typeof event.clientX === 'number' ? event.clientX : rect.left + rect.width / 2;
    const clientY = typeof event.clientY === 'number' ? event.clientY : rect.top + rect.height / 2;
    const pointerX = clientX - rect.left;
    const pointerY = clientY - rect.top;

    const scaleFactor = Math.pow(2, -normalizedDeltaY / 600);
    if (!Number.isFinite(scaleFactor) || scaleFactor === 0) {
      return false;
    }

    event.preventDefault();
    event.stopPropagation();
    selection.interrupt('focus-node');
    zoomBehaviour.scaleBy(selection, scaleFactor, [pointerX, pointerY]);
    return true;
  }

  const normalizedDeltaX = normalizeWheelDelta(event.deltaX || 0, mode);
  const normalizedDeltaY = normalizeWheelDelta(event.deltaY || 0, mode);
  if (normalizedDeltaX === 0 && normalizedDeltaY === 0) {
    return false;
  }

  const currentTransform = d3.zoomTransform(svgElement);
  const scale = Number.isFinite(currentTransform.k) && currentTransform.k > 0 ? currentTransform.k : 1;

  event.preventDefault();
  event.stopPropagation();
  selection.interrupt('focus-node');
  zoomBehaviour.translateBy(selection, -normalizedDeltaX / scale, -normalizedDeltaY / scale);
  return true;
};

/**
 * Focuses the viewport on a specific node.
 * @param {Object} params
 * @param {{x:number,y:number}} params.node
 * @param {SVGElement|null} params.svgElement
 * @param {d3.ZoomBehavior|null} params.zoomBehaviour
 * @param {{width:number,height:number}} params.dimensions
 * @param {{x:number,y:number,k:number}} params.viewTransform
 * @param {(next:{x:number,y:number,k:number})=>void} params.setViewTransform
 * @param {number} [params.duration]
 * @param {number} [params.scale]
 * @returns {Promise<void>}
 */
export const focusNodeToCenter = ({
  node,
  svgElement,
  zoomBehaviour,
  dimensions,
  viewTransform,
  setViewTransform,
  duration = 620,
  scale: requestedScale,
  allowScaleOverride = true,
  origin = 'top-left',
  offset,
}) => {
  if (!node || !svgElement) {
    return Promise.resolve();
  }

  const rect = typeof svgElement.getBoundingClientRect === 'function'
    ? svgElement.getBoundingClientRect()
    : null;

  const fallbackWidth = typeof dimensions?.width === 'number' ? dimensions.width : 0;
  const fallbackHeight = typeof dimensions?.height === 'number' ? dimensions.height : 0;

  const width = rect?.width || fallbackWidth;
  const height = rect?.height || fallbackHeight;

  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
    return Promise.resolve();
  }

  const nodeX = Number.isFinite(node.x) ? node.x : 0;
  const nodeY = Number.isFinite(node.y) ? node.y : 0;
  const currentScale = Number.isFinite(viewTransform?.k) ? viewTransform.k : 1;
  const preferredScale = typeof requestedScale === 'number' ? requestedScale : (
    allowScaleOverride ? Math.max(currentScale, 1) : currentScale
  );
  const targetScale = Math.min(Math.max(preferredScale, 0.3), 4);

  const offsetX = Number.isFinite(offset?.x) ? offset.x : 0;
  const offsetY = Number.isFinite(offset?.y) ? offset.y : 0;

  let nextTransform;
  if (origin === 'center') {
    nextTransform = d3.zoomIdentity
      .translate(width / 2 + offsetX, height / 2 + offsetY)
      .scale(targetScale)
      .translate(-nodeX, -nodeY);
  } else {
    const translateX = (width / 2) - (nodeX * targetScale) + offsetX;
    const translateY = (height / 2) - (nodeY * targetScale) + offsetY;
    nextTransform = d3.zoomIdentity.translate(translateX, translateY).scale(targetScale);
  }

  if (!zoomBehaviour) {
    setViewTransform({ x: nextTransform.x, y: nextTransform.y, k: targetScale });
    return Promise.resolve();
  }

  const svgSelection = d3.select(svgElement);

  return new Promise((resolve) => {
    const transition = svgSelection
      .transition('focus-node')
      .duration(duration)
      .ease(d3.easeCubicInOut)
      .call(zoomBehaviour.transform, nextTransform);

    transition.on('end', resolve);
    transition.on('interrupt', resolve);
  });
};

const isInteractiveTarget = (target) => {
  if (!target) return false;
  const interactiveSelector = '[data-node-toggle],button,a,input,textarea,select,[contenteditable="true"]';
  return Boolean(target.closest && target.closest(interactiveSelector));
};

const resolveAxisLock = (rawEvent) => {
  if (!rawEvent) return null;
  if (rawEvent.shiftKey) {
    return 'horizontal';
  }
  if (rawEvent.altKey || rawEvent.metaKey) {
    return 'vertical';
  }
  return null;
};

/**
 * Creates a drag behaviour for a specific node.
 * @param {Object} params
 * @param {string} params.nodeId
 * @param {Array} params.nodes
 * @param {(updater:Function)=>void} params.setNodes
 * @param {{current:any}} params.animationRef
 * @param {{current:HTMLElement|null}} params.svgRef
 * @param {{current:HTMLElement|null}} params.contentGroupRef
 * @returns {d3.DragBehavior}
 */
export const createNodeDragHandler = ({
  nodeId,
  nodes,
  setNodes,
  animationRef,
  svgRef,
  contentGroupRef,
}) => {
  let dragStart = null;

  return d3.drag()
    .filter((event) => {
      const rawEvent = event?.sourceEvent || event;
      if (!rawEvent) return false;
      if (typeof rawEvent.button === 'number' && rawEvent.button !== 0) {
        return false;
      }
      if (isInteractiveTarget(rawEvent.target)) {
        return false;
      }
      return true;
    })
    .on('start', () => {
      if (animationRef.current) {
        animationRef.current.stop();
      }

      const targetNode = nodes.find((candidate) => candidate.id === nodeId);
      if (targetNode) {
        dragStart = { x: targetNode.x || 0, y: targetNode.y || 0 };
      }
    })
    .on('drag', (event) => {
      const container = contentGroupRef.current || svgRef.current;
      if (!container) {
        return;
      }

      const rawEvent = event?.sourceEvent || event;
      const pointer = d3.pointer(event, container);
      const axisLock = resolveAxisLock(rawEvent);

      setNodes((currentNodes) => {
        const existing = currentNodes.find((candidate) => candidate.id === nodeId);
        if (!existing) {
          return currentNodes;
        }

        const lockedX = axisLock === 'vertical' && dragStart ? dragStart.x : pointer[0];
        const lockedY = axisLock === 'horizontal' && dragStart ? dragStart.y : pointer[1];

        return currentNodes.map((node) => (
          node.id === nodeId
            ? { ...node, x: lockedX, y: lockedY }
            : node
        ));
      });
    })
    .on('end', () => {
      dragStart = null;
    });
};

/**
 * Applies drag handlers to SVG node elements.
 * @param {Object} params
 * @param {SVGElement|null} params.svgElement
 * @param {Array} params.nodes
 * @param {string|null} params.expandedNodeId
 * @param {(nodeId:string)=>d3.DragBehavior} params.getHandler
 */
export const applyNodeDragHandlers = ({ svgElement, nodes, expandedNodeId, getHandler }) => {
  if (!svgElement) return;
  const svg = d3.select(svgElement);

  nodes.forEach((node) => {
    const selection = svg.selectAll(`[data-node-id="${node.id}"]`);
    if (expandedNodeId) {
      selection.on('.drag', null);
      selection.style('cursor', 'default');
    } else {
      selection.call(getHandler(node.id));
      selection.style('cursor', 'grab');
    }
  });
};

/**
 * Raises a node group to the top of the SVG stacking order.
 */
export const raiseNodeLayer = ({ svgElement, nodeId }) => {
  if (!svgElement || !nodeId) return;
  d3.select(svgElement).selectAll(`[data-node-id="${nodeId}"]`).raise();
};
