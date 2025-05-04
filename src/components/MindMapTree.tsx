'use client';

import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

export default function MindMapTree({ data }) {
    const ref = useRef(null);
    const [svgSize, setSvgSize] = useState({ width: 1000, height: 600 });

    useEffect(() => {
        const baseWidth = 1000;
        const baseHeight = 600;
        const margin = 100;

        d3.select(ref.current).selectAll('*').remove();

        const svg = d3.select(ref.current)
            .attr("width", baseWidth)
            .attr("height", baseHeight)
            .append("g");

        const root = d3.hierarchy(data);
        const treeLayout = d3.tree().nodeSize([60, 220]);
        treeLayout(root);

        const x0 = d3.min(root.descendants(), d => d.x);
        const x1 = d3.max(root.descendants(), d => d.x);
        const y0 = d3.min(root.descendants(), d => d.y);
        const y1 = d3.max(root.descendants(), d => d.y);

        const dx = x1 - x0;
        const dy = y1 - y0;

        const svgWidth = dy + 2 * margin + 200;
        const svgHeight = dx + 2 * margin;

        setSvgSize({ width: svgWidth, height: svgHeight });

        svg.attr("transform", `translate(${(svgWidth - dy) / 2 - y0}, ${(svgHeight - dx) / 2 - x0})`);

        svg.selectAll("path.link")
            .data(root.links())
            .enter()
            .append("path")
            .attr("fill", "none")
            .attr("stroke", "#888")
            .attr("stroke-width", 2)
            .attr("d", d3.linkHorizontal()
                .x(d => d.y)
                .y(d => d.x)
            );

        const node = svg.selectAll("g.node")
            .data(root.descendants())
            .enter()
            .append("g")
            .attr("transform", d => `translate(${d.y},${d.x})`);

        node.append("circle")
            .attr("r", 6)
            .attr("fill", "#1d4ed8");

        node.append("foreignObject")
            .attr("x", d => d.children ? -180 : 10)
            .attr("y", -20)
            .attr("width", 200)
            .attr("height", 60)
            .append("xhtml:div")
            .style("color", "#fff")
            .style("font-size", "14px")
            .style("white-space", "normal")
            .style("word-wrap", "break-word")
            .style("overflow", "visible")
            .style("font-family", "sans-serif")
            .text(d => d.data.topic);

        node.append("title").text(d => d.data.summary || "");

    }, [data]);

    return (
        <div className="w-full overflow-auto">
            <div className="min-w-[1200px]">
                <svg
                    ref={ref}
                    width={svgSize.width}
                    height={svgSize.height}
                    viewBox={`0 0 ${svgSize.width} ${svgSize.height}`}
                    preserveAspectRatio="xMidYMid meet"
                    className="overflow-visible block"
                />
            </div>
        </div>
    );
}