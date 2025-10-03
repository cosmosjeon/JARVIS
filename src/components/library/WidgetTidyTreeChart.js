import React, { useMemo } from "react";
import * as d3 from "d3";
import { buildTidyTreeLayout } from "../../utils/tidyTreeLayout";

const WidgetTidyTreeChart = ({ data, onClose }) => {
  const layout = useMemo(
    () => buildTidyTreeLayout(data, {
      width: 928,
      includeConnectionLinks: true,
      nodeVerticalSpacing: 18,
    }),
    [data],
  );

  const linkGenerator = useMemo(
    () => d3.linkHorizontal().x((point) => point.y).y((point) => point.x),
    [],
  );

  if (!layout) {
    return (
      <div className="w-full max-w-4xl rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">Tidy Tree Chart</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-slate-200 px-3 py-1 text-sm font-medium text-slate-700 hover:bg-slate-300"
          >
            Close
          </button>
        </div>
        <div className="py-12 text-center text-sm text-slate-500">No nodes are available to display.</div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl rounded-lg bg-white p-6 shadow-2xl">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Tidy Tree Chart</h2>
          <p className="text-xs text-slate-500">Hierarchical layout rendered with the D3 tidy tree algorithm.</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md bg-slate-200 px-3 py-1 text-sm font-medium text-slate-700 hover:bg-slate-300"
        >
          Close
        </button>
      </div>
      <div className="w-full overflow-auto">
        <svg
          width={layout.width}
          height={layout.height}
          viewBox={`${layout.viewBox[0]} ${layout.viewBox[1]} ${layout.viewBox[2]} ${layout.viewBox[3]}`}
          style={{ maxWidth: '100%', height: 'auto', font: '12px sans-serif' }}
        >
          <g fill="none" stroke="#555" strokeOpacity={0.4} strokeWidth={1.5}>
            {layout.links.map((link) => (
              <path key={`${link.source.data.id}->${link.target.data.id}`} d={linkGenerator(link)} />
            ))}
          </g>
          <g strokeLinecap="round" strokeLinejoin="round" strokeWidth={3}>
            {layout.nodes.map((node) => {
              const hasChildren = Array.isArray(node.children) && node.children.length > 0;
              return (
                <g key={node.data.id} transform={`translate(${node.y},${node.x})`}>
                  <circle fill={hasChildren ? '#555' : '#999'} r={2.5} />
                  <text
                    dy="0.31em"
                    x={hasChildren ? -6 : 6}
                    textAnchor={hasChildren ? 'end' : 'start'}
                    fill="#1f2937"
                    stroke="white"
                    paintOrder="stroke"
                  >
                    {node.data.name}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>
    </div>
  );
};

export default WidgetTidyTreeChart;
