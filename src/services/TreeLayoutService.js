import * as d3 from 'd3';

/**
 * TreeLayoutService - calculates tidy tree coordinates via d3-hierarchy.
 * Business Logic Layer: presentation-agnostic layout computation.
 */
class TreeLayoutService {
    constructor() {
        this.treeLayout = d3.tree();
    }

    /**
     * Converts a flat node/link graph into a nested d3.hierarchy structure.
     */
    convertToHierarchy(nodes, links) {
        const nodeMap = new Map();
        nodes.forEach(node => {
            nodeMap.set(node.id, {
                ...node,
                children: []
            });
        });

        links.forEach(link => {
            const sourceId = link.source.id || link.source;
            const targetId = link.target.id || link.target;

            const sourceNode = nodeMap.get(sourceId);
            const targetNode = nodeMap.get(targetId);

            if (sourceNode && targetNode) {
                sourceNode.children.push(targetNode);
            }
        });

        const rootNodes = Array.from(nodeMap.values()).filter(node =>
            !links.some(link => {
                const targetId = link.target.id || link.target;
                return targetId === node.id;
            })
        );

        if (rootNodes.length === 0) {
            throw new Error('No root node found in the hierarchy');
        }

        const hasMultipleRoots = rootNodes.length > 1;
        const rootNode = hasMultipleRoots
            ? {
                id: '__virtual_root__',
                keyword: '__virtual_root__',
                fullText: '__virtual_root__',
                children: rootNodes,
            }
            : rootNodes[0];

        return d3.hierarchy(rootNode, d => d.children);
    }

    /**
     * Calculates a tidy layout for the provided nodes and links.
     */
    calculateTreeLayout(nodes, links, dimensions, options = {}) {
        try {
            const safeDimensions = dimensions || {};
            const baseWidth = Number.isFinite(safeDimensions.width) ? safeDimensions.width : 900;
            const baseHeight = Number.isFinite(safeDimensions.height) ? safeDimensions.height : 700;
            const usableWidth = Math.max(baseWidth - 120, 120);
            const usableHeight = Math.max(baseHeight - 120, 120);
            const orientationSetting = typeof options?.orientation === 'string' ? options.orientation : 'vertical';
            const isHorizontal = orientationSetting === 'horizontal';

            const root = this.convertToHierarchy(nodes, links);

            root.sort((a, b) => {
                const left = a.data?.keyword || a.data?.name || '';
                const right = b.data?.keyword || b.data?.name || '';
                return d3.ascending(left.toString(), right.toString());
            });

            const totalLeaves = Math.max(root.leaves().length, 1);
            const breadthSpacing = Math.max(28, Math.min(96, (isHorizontal ? usableHeight : usableWidth) / totalLeaves));
            const depthSpacingCandidate = (isHorizontal ? usableWidth : usableHeight) / Math.max(1, root.height + 1);
            const depthSpacing = Math.max(140, depthSpacingCandidate);

            this.treeLayout
                .nodeSize([breadthSpacing, depthSpacing])
                .separation((a, b) => (a.parent === b.parent ? 1 : 1.5));

            this.treeLayout(root);

            let minX = Infinity;
            let maxX = -Infinity;
            root.each(node => {
                if (node.x < minX) minX = node.x;
                if (node.x > maxX) maxX = node.x;
            });

            const breadthOffset = Math.max(breadthSpacing, 40);
            const depthOffset = Math.max(depthSpacing * 0.35, 50);

            const layoutNodes = root.descendants()
                .filter(node => node.data.id !== '__virtual_root__')
                .map(node => {
                    const breadth = (node.x - minX) + breadthOffset;
                    const depth = node.y + depthOffset;

                    return {
                        ...node.data,
                        x: isHorizontal ? depth : breadth,
                        y: isHorizontal ? breadth : depth,
                        depth: node.depth,
                        height: node.height,
                        layoutBreadth: breadth,
                        layoutDepth: depth,
                    };
                });

            const layoutLinks = root.links()
                .filter(link => link.source.data.id !== '__virtual_root__')
                .map(link => ({
                    source: link.source.data.id,
                    target: link.target.data.id,
                    value: 1,
                }));

            return {
                nodes: layoutNodes,
                links: layoutLinks,
            };
        } catch (error) {
            if (process.env.NODE_ENV === 'development') {
                console.error('Tree layout calculation failed:', error);
            }
            return {
                nodes: nodes.map(node => ({ ...node, x: node.x || 0, y: node.y || 0 })),
                links,
            };
        }
    }

    sortNodes(a, b) {
        if (a.level !== b.level) {
            return a.level - b.level;
        }
        return (a.keyword || '').localeCompare(b.keyword || '');
    }

    sortLinks(a, b) {
        const aSource = a.source.id || a.source;
        const bSource = b.source.id || b.source;

        if (aSource !== bSource) {
            return aSource.localeCompare(bSource);
        }

        const aTarget = a.target.id || a.target;
        const bTarget = b.target.id || b.target;
        return aTarget.localeCompare(bTarget);
    }
}

export default TreeLayoutService;
