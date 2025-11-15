import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import './FileTree.css';

function FileTree({ data }) {
  const svgRef = useRef();

  useEffect(() => {
    if (!data || !svgRef.current) return;

    // Clear previous render
    d3.select(svgRef.current).selectAll('*').remove();

    const width = 800;
    const height = 600;

    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height);

    // Create hierarchy
    const root = d3.hierarchy(data);
    const treeLayout = d3.tree().size([height - 100, width - 200]);
    treeLayout(root);

    // Links
    svg.selectAll('.link')
      .data(root.links())
      .join('path')
      .attr('class', 'link')
      .attr('d', d3.linkHorizontal()
        .x(d => d.y + 100)
        .y(d => d.x + 50)
      )
      .attr('fill', 'none')
      .attr('stroke', '#ccc')
      .attr('stroke-width', 1);

    // Nodes
    const nodes = svg.selectAll('.node')
      .data(root.descendants())
      .join('g')
      .attr('class', 'node')
      .attr('transform', d => `translate(${d.y + 100},${d.x + 50})`);

    // Node circles
    nodes.append('circle')
      .attr('r', d => {
        if (!d.data.operations) return 4;
        return Math.min(10, 4 + Math.log(d.data.operations + 1));
      })
      .attr('fill', d => {
        if (d.data.type === 'directory') return '#4a90e2';
        if (d.data.writes > 0) return '#e74c3c'; // Red for writes
        if (d.data.edits > 0) return '#f39c12'; // Orange for edits
        return '#3498db'; // Blue for reads
      })
      .attr('opacity', d => {
        if (!d.data.operations) return 0.3;
        return Math.min(1, 0.3 + (d.data.operations / 10));
      });

    // Node labels
    nodes.append('text')
      .attr('dx', 12)
      .attr('dy', 4)
      .text(d => d.data.name)
      .attr('font-size', '12px')
      .attr('fill', '#333');

    // Node tooltips
    nodes.append('title')
      .text(d => {
        if (!d.data.operations) return d.data.name;
        return `${d.data.name}\n` +
               `Operations: ${d.data.operations}\n` +
               `Reads: ${d.data.reads}\n` +
               `Writes: ${d.data.writes}\n` +
               `Edits: ${d.data.edits}`;
      });

  }, [data]);

  return (
    <div className="file-tree">
      <svg ref={svgRef}></svg>
    </div>
  );
}

export default FileTree;
