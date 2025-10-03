import { useCallback, useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import TreeAnimationService from '../../../services/force-tree/TreeAnimationService';
import { markNewLinks } from '../../../utils/linkAnimationUtils';
import {
  DOM_DELTA_PIXEL,
  normalizeWheelDelta,
  getViewportDimensions,
  calculateNodeScaleFactor,
} from '../geometry';

const DEFAULT_TRANSFORM = { x: 0, y: 0, k: 1 };

const useHierarchicalTreeViewport = ({
  data,
  visibleNodes,
  visibleLinks,
  layoutOrientation,
  viewMode,
}) => {
  const svgRef = useRef(null);
  const contentGroupRef = useRef(null);
  const overlayContainerRef = useRef(null);
  const zoomBehaviourRef = useRef(null);
  const treeAnimationService = useRef(new TreeAnimationService());
  const animationRef = useRef(null);
  const linkKeysRef = useRef(new Set());

  const [dimensions, setDimensions] = useState(getViewportDimensions());
  const [nodeScaleFactor, setNodeScaleFactor] = useState(() => (
    calculateNodeScaleFactor(getViewportDimensions())
  ));
  const [nodes, setNodes] = useState([]);
  const [links, setLinks] = useState([]);
  const [viewTransform, setViewTransform] = useState(DEFAULT_TRANSFORM);
  const [overlayElement, setOverlayElement] = useState(null);
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    setOverlayElement(overlayContainerRef.current);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setIsResizing(true);
      const nextDimensions = getViewportDimensions();
      setDimensions(nextDimensions);
      setNodeScaleFactor(calculateNodeScaleFactor(nextDimensions));
      if (handleResize._t) clearTimeout(handleResize._t);
      handleResize._t = setTimeout(() => setIsResizing(false), 140);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (animationRef.current) {
      animationRef.current.stop();
    }

    const animation = treeAnimationService.current.calculateTreeLayoutWithAnimation(
      nodes,
      visibleNodes,
      visibleLinks,
      dimensions,
      (animatedNodes, animatedLinks) => {
        setNodes(animatedNodes);
        const { annotatedLinks, nextKeys } = markNewLinks(linkKeysRef.current, animatedLinks);
        linkKeysRef.current = nextKeys;
        setLinks(annotatedLinks);
      },
      { orientation: layoutOrientation },
    );

    animationRef.current = animation;

    return () => {
      if (animationRef.current) {
        animationRef.current.stop();
      }
    };
  }, [dimensions, layoutOrientation, nodes, visibleLinks, visibleNodes]);

  const stopCurrentAnimation = useCallback(() => {
    if (animationRef.current) {
      animationRef.current.stop();
    }
  }, []);

  const forwardPanZoomGesture = useCallback((event) => {
    const svgElement = svgRef.current;
    const zoomBehaviour = zoomBehaviourRef.current;
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
  }, []);

  useEffect(() => {
    if (!svgRef.current || viewMode !== 'tree1') return undefined;

    const svgSelection = d3.select(svgRef.current);
    const zoomFactory = typeof d3.zoom === 'function' ? d3.zoom : null;
    if (!zoomFactory) {
      return undefined;
    }

    const isSecondaryButtonDrag = (evt) => {
      if (typeof evt.button === 'number' && (evt.button === 1 || evt.button === 2)) return true;
      if (typeof evt.buttons === 'number') {
        const mask = evt.buttons;
        return (mask & 4) === 4 || (mask & 2) === 2;
      }
      return false;
    };

    const isPrimaryButtonDrag = (evt) => {
      if (typeof evt.buttons === 'number') {
        return (evt.buttons & 1) === 1;
      }
      if (typeof evt.button === 'number') {
        return evt.button === 0;
      }
      return false;
    };

    const allowTouchGesture = (evt) => {
      if (evt.type.startsWith('touch')) {
        const touches = evt.touches || (evt.originalEvent && evt.originalEvent.touches);
        return Boolean(touches && touches.length > 1);
      }
      if (evt.type.startsWith('pointer') && evt.pointerType === 'touch') {
        return true;
      }
      return false;
    };

    const isPinchZoomWheel = (evt) => {
      if (!evt) return false;
      if (evt.ctrlKey || evt.metaKey) return true;
      if (typeof evt.deltaZ === 'number' && evt.deltaZ !== 0) return true;
      const capabilities = evt.sourceCapabilities;
      if (capabilities && capabilities.firesTouchEvents) {
        const absDelta = Math.abs(evt.deltaY || 0) + Math.abs(evt.deltaX || 0);
        if (absDelta > 0 && absDelta < 1.25) {
          return true;
        }
      }
      return false;
    };

    const zoomBehaviour = zoomFactory()
      .scaleExtent([0.3, 8])
      .filter((event) => {
        const target = event.target instanceof Element ? event.target : null;
        const isForeignObject = target && target.closest('foreignObject');
        if (isForeignObject) return false;

        const panHandleElement = target && target.closest('[data-pan-handle="true"]');
        const panBlocked = target && target.closest('[data-block-pan="true"]');
        const withinNode = target && target.closest('[data-node-id]');

        if (panHandleElement && !panBlocked) {
          if (event.type === 'wheel') {
            return isPinchZoomWheel(event);
          }
          if (allowTouchGesture(event)) {
            return true;
          }
          if (event.type === 'pointerdown' || event.type === 'mousedown') {
            return isPrimaryButtonDrag(event) || isSecondaryButtonDrag(event);
          }
          if (event.type === 'pointermove' || event.type === 'mousemove') {
            return isPrimaryButtonDrag(event) || isSecondaryButtonDrag(event);
          }
          if (event.type === 'pointerup' || event.type === 'pointercancel' || event.type === 'mouseup') {
            return true;
          }
        }

        if (withinNode) {
          if (event.type === 'wheel') {
            if (isPinchZoomWheel(event)) return true;
            return false;
          }
          if (allowTouchGesture(event)) {
            return true;
          }
          if (event.type === 'pointerdown' || event.type === 'pointermove' || event.type === 'mousedown' || event.type === 'mousemove') {
            return isSecondaryButtonDrag(event);
          }
          if (event.type === 'pointerup' || event.type === 'pointercancel' || event.type === 'mouseup') {
            return true;
          }
          return false;
        }

        if (event.type === 'wheel') {
          return true;
        }
        if (event.type === 'dblclick') return false;
        if (allowTouchGesture(event)) return true;
        if (event.type === 'pointerup' || event.type === 'pointercancel' || event.type === 'mouseup') return true;
        if (event.type === 'pointerdown' || event.type === 'pointermove' || event.type === 'mousedown' || event.type === 'mousemove') {
          return isPrimaryButtonDrag(event) || isSecondaryButtonDrag(event);
        }
        return false;
      })
      .on('zoom', (event) => {
        setViewTransform({ x: event.transform.x, y: event.transform.y, k: event.transform.k });
      });

    const defaultWheelDelta = zoomBehaviour.wheelDelta();
    zoomBehaviour.wheelDelta((event) => {
      if (event.ctrlKey || event.metaKey) {
        const base = typeof defaultWheelDelta === 'function'
          ? defaultWheelDelta(event)
          : (-event.deltaY * (event.deltaMode ? 120 : 1) / 500);
        return base * 0.3;
      }

      return 0;
    });

    svgSelection
      .style('touch-action', 'none')
      .call(zoomBehaviour)
      .on('dblclick.zoom', null);

    zoomBehaviourRef.current = zoomBehaviour;

    svgSelection.on('pointerdown.background', null);
    svgSelection.on('wheel.treepan', (event) => {
      if (event.ctrlKey || event.metaKey) {
        return;
      }

      event.preventDefault();
      const mode = typeof event.deltaMode === 'number' ? event.deltaMode : DOM_DELTA_PIXEL;
      const deltaX = normalizeWheelDelta(event.deltaX || 0, mode);
      const deltaY = normalizeWheelDelta(event.deltaY || 0, mode);
      if (deltaX === 0 && deltaY === 0) {
        return;
      }

      const currentTransform = d3.zoomTransform(svgSelection.node());
      const scale = Number.isFinite(currentTransform.k) && currentTransform.k > 0 ? currentTransform.k : 1;
      const panX = -deltaX / scale;
      const panY = -deltaY / scale;
      zoomBehaviour.translateBy(svgSelection, panX, panY);
    });

    return () => {
      svgSelection.on('.zoom', null);
      svgSelection.on('.treepan', null);
      if (zoomBehaviourRef.current === zoomBehaviour) {
        zoomBehaviourRef.current = null;
      }
    };
  }, [viewMode]);

  const focusNodeToCenter = useCallback((node, options = {}) => {
    if (!node || !svgRef.current) {
      return Promise.resolve();
    }

    const svgElement = svgRef.current;
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

    const { duration = 620, scale: requestedScale } = options;
    const nodeX = Number.isFinite(node.x) ? node.x : 0;
    const nodeY = Number.isFinite(node.y) ? node.y : 0;
    const currentScale = Number.isFinite(viewTransform.k) ? viewTransform.k : 1;
    const preferredScale = typeof requestedScale === 'number' ? requestedScale : Math.max(currentScale, 1);
    const targetScale = Math.min(Math.max(preferredScale, 0.3), 4);

    const translateX = (width / 2) - (nodeX * targetScale);
    const translateY = (height / 2) - (nodeY * targetScale);
    const nextTransform = d3.zoomIdentity.translate(translateX, translateY).scale(targetScale);

    const svgSelection = d3.select(svgElement);
    const zoomBehaviour = zoomBehaviourRef.current;

    if (!zoomBehaviour) {
      setViewTransform({ x: translateX, y: translateY, k: targetScale });
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      const transition = svgSelection
        .transition('focus-node')
        .duration(duration)
        .ease(d3.easeCubicInOut)
        .call(zoomBehaviour.transform, nextTransform);

      transition.on('end', resolve);
      transition.on('interrupt', resolve);
    });
  }, [dimensions, viewTransform.k]);

  const createNodeDragHandler = useCallback((nodeId, { onDragStart } = {}) => {
    let dragStart = null;

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
      .on('start', (event) => {
        if (typeof onDragStart === 'function') {
          onDragStart(event);
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
  }, [nodes]);

  return {
    svgRef,
    contentGroupRef,
    overlayContainerRef,
    overlayElement,
    zoomBehaviourRef,
    nodes,
    setNodes,
    links,
    setLinks,
    dimensions,
    nodeScaleFactor,
    viewTransform,
    setViewTransform,
    forwardPanZoomGesture,
    focusNodeToCenter,
    createNodeDragHandler,
    stopCurrentAnimation,
    isResizing,
  };
};

export default useHierarchicalTreeViewport;
