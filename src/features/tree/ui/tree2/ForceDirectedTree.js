import React, { useMemo } from 'react';
import * as d3 from 'd3';
import DataTransformService from 'features/tree/services/DataTransformService';

const DEFAULT_WIDTH = 954;
const DEFAULT_RADIUS_PADDING = 100;

const resolveLabel = (datum = {}) => {
    if (typeof datum.name === 'string' && datum.name.trim()) {
        return datum.name.trim();
    }
    if (typeof datum.keyword === 'string' && datum.keyword.trim()) {
        return datum.keyword.trim();
    }
    if (typeof datum.id === 'string' && datum.id.trim()) {
        return datum.id.trim();
    }
    return '';
};

const buildRadialLayout = (treeData, radius) => {
    if (!treeData) {
        return { nodes: [], links: [] };
    }

    const root = d3.hierarchy(treeData);
    const tree = d3.tree()
        .size([2 * Math.PI, radius])
        .separation((a, b) => (a.parent === b.parent ? 1 : 2) / a.depth);

    tree(root);

    return {
        nodes: root.descendants(),
        links: root.links(),
    };
};

const ForceDirectedTree = ({ data, dimensions }) => {
    const width = DEFAULT_WIDTH;
    const height = DEFAULT_WIDTH;
    const radius = (width / 2) - DEFAULT_RADIUS_PADDING;

    const { nodes, links } = useMemo(() => {
        const nodesArray = Array.isArray(data?.nodes) ? data.nodes : [];
        const linksArray = Array.isArray(data?.links) ? data.links : [];
        const hierarchy = DataTransformService.transformToHierarchy(nodesArray, linksArray);
        return buildRadialLayout(hierarchy, radius);
    }, [data, radius]);

    const radialLink = useMemo(
        () => d3.linkRadial()
            .angle((point) => point.x)
            .radius((point) => point.y),
        [],
    );

    return (
        <svg
            width={width}
            height={height}
            viewBox={[-width / 2, -height / 2, width, height].join(' ')}
            style={{ fontFamily: 'sans-serif', fontSize: 10, background: '#fff' }}
        >
            <g
                fill="none"
                stroke="#555"
                strokeOpacity={0.4}
                strokeWidth={1.5}
            >
                {links.map((link, index) => (
                    <path
                        key={`link-${index}`}
                        d={radialLink(link)}
                    />
                ))}
            </g>

            <g strokeLinejoin="round" strokeWidth={3}>
                {nodes.map((node, index) => {
                    const isLeaf = !node.children;
                    const label = resolveLabel(node.data);
                    const rotation = (node.x * 180) / Math.PI - 90;
                    const translation = `translate(${node.y},0)`;
                    const transform = `rotate(${rotation}) ${translation}`;
                    const textRotation = node.x >= Math.PI ? 'rotate(180)' : '';
                    const textAnchor = node.x < Math.PI === isLeaf ? 'start' : 'end';
                    const textX = node.x < Math.PI === isLeaf ? 6 : -6;

                    return (
                        <g
                            key={`node-${index}`}
                            transform={transform}
                        >
                            <circle
                                fill={isLeaf ? '#999' : '#555'}
                                r={2.5}
                            />
                            {label ? (
                                <text
                                    dy="0.31em"
                                    x={textX}
                                    textAnchor={textAnchor}
                                    transform={textRotation}
                                    fill="#000"
                                    stroke="white"
                                    strokeWidth={3}
                                    paintOrder="stroke"
                                >
                                    {label}
                                </text>
                            ) : null}
                        </g>
                    );
                })}
            </g>
        </svg>
    );
};

export default ForceDirectedTree;
