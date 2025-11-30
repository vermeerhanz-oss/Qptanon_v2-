import React from 'react';
import OrgChartNode from './OrgChartNode';

export default function OrgChartTree({ 
  nodes, 
  expandedNodes, 
  onToggleExpand,
  highlightedNodeId,
  visualizeBy,
  onNodeClick,
  level = 0
}) {
  if (!nodes || nodes.length === 0) return null;

  return (
    <div className="flex flex-col items-center">
      <div className="flex gap-8 justify-center">
        {nodes.map((node, index) => {
          const isExpanded = expandedNodes.has(node.id);
          const hasChildren = node.directReports && node.directReports.length > 0;

          return (
            <div key={node.id} className="flex flex-col items-center">
              {/* Connector lines */}
              {level > 0 && (
                <div className="h-6 w-px bg-gray-300" />
              )}

              {/* Node */}
              <OrgChartNode
                node={node}
                isExpanded={isExpanded}
                onToggleExpand={onToggleExpand}
                hasChildren={hasChildren}
                isHighlighted={highlightedNodeId === node.id}
                visualizeBy={visualizeBy}
                onNodeClick={onNodeClick}
              />

              {/* Children */}
              {hasChildren && isExpanded && (
                <div className="flex flex-col items-center mt-6">
                  {/* Vertical line down */}
                  <div className="h-6 w-px bg-gray-300" />
                  
                  {/* Horizontal connector for multiple children */}
                  {node.directReports.length > 1 && (
                    <div className="relative">
                      <div 
                        className="h-px bg-gray-300" 
                        style={{ 
                          width: `${(node.directReports.length - 1) * 272}px`,
                          position: 'relative',
                        }}
                      />
                    </div>
                  )}

                  {/* Children nodes */}
                  <OrgChartTree
                    nodes={node.directReports}
                    expandedNodes={expandedNodes}
                    onToggleExpand={onToggleExpand}
                    highlightedNodeId={highlightedNodeId}
                    visualizeBy={visualizeBy}
                    onNodeClick={onNodeClick}
                    level={level + 1}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}