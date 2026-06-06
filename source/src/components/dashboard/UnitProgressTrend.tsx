import { useEffect, useRef } from "react";
import * as d3 from "d3";

export interface ProgressPoint {
  date: string;    // ISO date "YYYY-MM-DD"
  achieved: number;
  total: number;
}

interface UnitProgressTrendProps {
  data: ProgressPoint[];
  height?: number;
}

/**
 * D3 line chart showing cumulative competency achievement over time for a unit.
 * Used on the Unit Leader Dashboard.
 */
export function UnitProgressTrend({ data, height = 200 }: UnitProgressTrendProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const svgEl = svgRef.current;
    const wrap = wrapRef.current;
    if (!svgEl || !wrap) return;

    const width = wrap.clientWidth;
    const margin = { top: 8, right: 16, bottom: 24, left: 36 };
    const innerW = Math.max(0, width - margin.left - margin.right);
    const innerH = Math.max(0, height - margin.top - margin.bottom);

    const svg = d3.select(svgEl);
    svg.selectAll("*").remove();
    svg.attr("width", width).attr("height", height);

    if (data.length === 0) {
      svg
        .append("text")
        .attr("x", width / 2)
        .attr("y", height / 2)
        .attr("text-anchor", "middle")
        .attr("font-size", 11)
        .attr("fill", "var(--muted-foreground)")
        .text("No trend data yet");
      return;
    }

    const parse = d3.timeParse("%Y-%m-%d");
    const points = data
      .map((d) => ({
        date: parse(d.date) ?? new Date(d.date),
        pct: d.total === 0 ? 0 : (d.achieved / d.total) * 100,
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    const x = d3
      .scaleTime()
      .domain(d3.extent(points, (p) => p.date) as [Date, Date])
      .range([0, innerW]);

    const y = d3.scaleLinear().domain([0, 100]).range([innerH, 0]);

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    g.append("g")
      .attr("transform", `translate(0,${innerH})`)
      .call(d3.axisBottom(x).ticks(Math.min(6, points.length)).tickFormat(d3.timeFormat("%b %d") as any))
      .selectAll("text")
      .attr("font-size", 10)
      .attr("fill", "var(--muted-foreground)");

    g.append("g")
      .call(d3.axisLeft(y).ticks(4).tickFormat((d) => `${d}%`))
      .selectAll("text")
      .attr("font-size", 10)
      .attr("fill", "var(--muted-foreground)");

    g.selectAll(".domain").attr("stroke", "var(--border)");
    g.selectAll(".tick line").attr("stroke", "var(--border)");

    const line = d3
      .line<{ date: Date; pct: number }>()
      .x((p) => x(p.date))
      .y((p) => y(p.pct))
      .curve(d3.curveMonotoneX);

    g.append("path")
      .datum(points)
      .attr("fill", "none")
      .attr("stroke", "var(--primary)")
      .attr("stroke-width", 2)
      .attr("d", line as any);

    g.selectAll("circle.point")
      .data(points)
      .enter()
      .append("circle")
      .attr("class", "point")
      .attr("cx", (p) => x(p.date))
      .attr("cy", (p) => y(p.pct))
      .attr("r", 3)
      .attr("fill", "var(--primary)");
  }, [data, height]);

  return (
    <div ref={wrapRef} className="w-full">
      <svg ref={svgRef} role="img" aria-label="Unit progress trend" />
    </div>
  );
}