"use client";

import { useCallback, useMemo } from "react";
import { Handle, Position, NodeProps, Node } from "@xyflow/react";
import { BaseNode } from "./BaseNode";
import { useWorkflowStore } from "@/store/workflowStore";
import { GridSplitNodeData } from "@/types";

type GridSplitNodeType = Node<GridSplitNodeData, "gridSplit">;

export function GridSplitNode({
  id,
  data,
  selected,
}: NodeProps<GridSplitNodeType>) {
  const nodeData = data;
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);

  const handleRowsChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseInt(e.target.value, 10);
      if (!isNaN(value) && value >= 1 && value <= 10) {
        updateNodeData(id, { rows: value, tileOutputs: {} });
      }
    },
    [id, updateNodeData]
  );

  const handleColumnsChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseInt(e.target.value, 10);
      if (!isNaN(value) && value >= 1 && value <= 10) {
        updateNodeData(id, { columns: value, tileOutputs: {} });
      }
    },
    [id, updateNodeData]
  );

  const tileCount = nodeData.rows * nodeData.columns;
  const exceedsMax = tileCount > 64;

  // Generate tile handles
  const tileHandles = useMemo(() => {
    const handles = [];
    for (let row = 0; row < nodeData.rows; row++) {
      for (let col = 0; col < nodeData.columns; col++) {
        const index = row * nodeData.columns + col;
        const handleId = `tile-${index}`;
        const label = `r${row + 1}c${col + 1}`;

        handles.push({
          handleId,
          label,
          index,
        });
      }
    }
    return handles;
  }, [nodeData.rows, nodeData.columns]);

  const statusColor = {
    idle: "text-gray-400",
    ready: "text-blue-400",
    loading: "text-yellow-400",
    complete: "text-green-400",
    error: "text-red-400",
  }[nodeData.status];

  return (
    <BaseNode id={id} title="Grid Split" selected={selected}>
      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Left}
        id="image"
        style={{ top: 60 }}
        className="w-3 h-3 !bg-purple-500 border-2 border-gray-800"
      />

      <div className="space-y-3">
        {/* Controls */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Rows</label>
            <input
              type="number"
              min="1"
              max="10"
              value={nodeData.rows}
              onChange={handleRowsChange}
              className="w-full px-2 py-1 text-sm bg-gray-800 border border-gray-700 rounded focus:outline-none focus:border-purple-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Columns</label>
            <input
              type="number"
              min="1"
              max="10"
              value={nodeData.columns}
              onChange={handleColumnsChange}
              className="w-full px-2 py-1 text-sm bg-gray-800 border border-gray-700 rounded focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>

        {/* Tile count info */}
        <div className="text-xs text-gray-400 flex items-center justify-between">
          <span>
            {tileCount} tile{tileCount !== 1 ? "s" : ""}
          </span>
          <span className={statusColor}>{nodeData.status}</span>
        </div>

        {exceedsMax && (
          <div className="text-xs text-red-400 bg-red-900/20 border border-red-800 rounded px-2 py-1">
            Max 64 tiles exceeded
          </div>
        )}

        {/* Preview */}
        {nodeData.inputImage && (
          <div className="relative">
            <img
              src={nodeData.inputImage}
              alt="Preview"
              className="w-full rounded border border-gray-700"
            />
            {/* Grid overlay */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              style={{ mixBlendMode: "difference" }}
            >
              {/* Vertical lines */}
              {Array.from({ length: nodeData.columns - 1 }).map((_, i) => {
                const x = ((i + 1) / nodeData.columns) * 100;
                return (
                  <line
                    key={`v-${i}`}
                    x1={`${x}%`}
                    y1="0%"
                    x2={`${x}%`}
                    y2="100%"
                    stroke="white"
                    strokeWidth="1"
                    opacity="0.6"
                  />
                );
              })}
              {/* Horizontal lines */}
              {Array.from({ length: nodeData.rows - 1 }).map((_, i) => {
                const y = ((i + 1) / nodeData.rows) * 100;
                return (
                  <line
                    key={`h-${i}`}
                    x1="0%"
                    y1={`${y}%`}
                    x2="100%"
                    y2={`${y}%`}
                    stroke="white"
                    strokeWidth="1"
                    opacity="0.6"
                  />
                );
              })}
            </svg>
          </div>
        )}

        {!nodeData.inputImage && (
          <div className="text-xs text-gray-500 text-center py-4 border border-dashed border-gray-700 rounded">
            Connect an image input
          </div>
        )}

        {nodeData.error && (
          <div className="text-xs text-red-400 bg-red-900/20 border border-red-800 rounded px-2 py-1">
            {nodeData.error}
          </div>
        )}
      </div>

      {/* Output handles - dynamic based on grid size */}
      {tileHandles.map((tile, idx) => {
        // Distribute handles evenly across the node height
        // Start at 15% and end at 85% of node height to avoid edges
        const percentage =
          tileCount === 1 ? 50 : 15 + (idx / (tileCount - 1)) * 70;
        const label = tileCount <= 16 ? tile.label : `t${tile.index}`;

        return (
          <Handle
            key={tile.handleId}
            type="source"
            position={Position.Right}
            id={tile.handleId}
            style={{ top: `${percentage}%` }}
            className="w-3 h-3 !bg-purple-500 border-2 border-gray-800"
          >
            <span className="absolute left-full ml-2 text-xs text-gray-400 whitespace-nowrap">
              {label}
            </span>
          </Handle>
        );
      })}
    </BaseNode>
  );
}
