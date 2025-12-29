import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import SunCalc from "suncalc";
import { Source, AltitudeSample } from "../types";
import {
  decodeTimeRange,
  equatorialToHorizontal,
  findNightInterval,
  formatDatetimeLocal,
} from "../utils/coordinates";

interface AltitudeChartProps {
  source: Source | null;
  obsLat: number;
  obsLon: number;
  timeRange: [string, string];
  onHover?: (sample: AltitudeSample | null) => void;
  width?: number;
  height?: number;
}

const STEP_MINUTES = 5;

const AltitudeChart = ({
  source,
  obsLat,
  obsLon,
  timeRange,
  onHover,
  width = 800,
  height = 450,
}: AltitudeChartProps) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hover, setHover] = useState<AltitudeSample | null>(null);

  const { samples, moonSeries, scale } = useMemo(() => {
    if (!source) {
      return { samples: [], moonSeries: [], scale: { start: null as Date | null, end: null as Date | null } };
    }
    const [start, end] = decodeTimeRange(timeRange);
    const samples: AltitudeSample[] = [];
    const moonSeries: { time: Date; alt: number }[] = [];
    for (let ts = start.getTime(); ts <= end.getTime(); ts += STEP_MINUTES * 60 * 1000) {
      const time = new Date(ts);
      const { alt, az } = equatorialToHorizontal(source.ra, source.dec, obsLat, obsLon, time);
      const moon = SunCalc.getMoonPosition(time, obsLat, obsLon);
      const targetAlt = alt;
      const moonAlt = moon.altitude * (180 / Math.PI);
      const rad = Math.PI / 180;
      const alt1 = targetAlt * rad;
      const az1 = az * rad;
      const alt2 = moon.altitude;
      const az2 = moon.azimuth;
      const cosTheta =
        Math.sin(alt1) * Math.sin(alt2) + Math.cos(alt1) * Math.cos(alt2) * Math.cos(az1 - az2);
      const moonAngle = Math.acos(Math.min(1, Math.max(-1, cosTheta))) * (180 / Math.PI);
      if (targetAlt >= 0) {
        samples.push({
          time,
          targetAlt,
          moonAlt,
          moonAngle,
        });
      }
      moonSeries.push({ time, alt: moonAlt });
    }
    return { samples, moonSeries, scale: { start, end } };
  }, [source, obsLat, obsLon, timeRange]);

  useEffect(() => {
    if (!svgRef.current || !source || !samples.length) {
      d3.select(svgRef.current).selectAll("*").remove();
      return;
    }

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    const margin = { top: 20, right: 60, bottom: 50, left: 60 };

    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const domainStart = scale.start ?? samples[0].time;
    const domainEnd = scale.end ?? samples[samples.length - 1].time;

    const xScale = d3
      .scaleTime()
      .domain([domainStart, domainEnd])
      .range([margin.left, margin.left + innerWidth]);

    const yScale = d3.scaleLinear().domain([0, 90]).range([margin.top + innerHeight, margin.top]);

    const moonScale = d3.scaleLinear().domain([0, 90]).range([margin.top + innerHeight, margin.top]);

    const lineAlt = d3
      .line<AltitudeSample>()
      .x(d => xScale(d.time))
      .y(d => yScale(d.targetAlt))
      .curve(d3.curveMonotoneX);

    const lineMoon = d3
      .line<{ time: Date; alt: number }>()
      .x(d => xScale(d.time))
      .y(d => moonScale(Math.max(0, d.alt)))
      .curve(d3.curveMonotoneX);

    svg
      .append("path")
      .datum(samples)
      .attr("fill", "none")
      .attr("stroke", "#b75050ff")
      .attr("stroke-width", 2)
      .attr("d", lineAlt as any);

    svg
      .append("path")
      .datum(moonSeries)
      .attr("fill", "none")
      .attr("stroke", "#4cb54cff")
      .attr("stroke-width", 2)
      .attr("d", lineMoon as any);

    const angleBisector = d3.bisector<AltitudeSample, Date>(d => d.time).left;
    const fourHour = 4 * 60 * 60 * 1000;
    for (let tick = domainStart.getTime(); tick <= domainEnd.getTime(); tick += fourHour) {
      const time = new Date(tick);
      const idx = angleBisector(samples, time);
      const prevSample = samples[Math.max(0, idx - 1)];
      const nextSample = samples[Math.min(samples.length - 1, idx)];
      const sample = !prevSample ? nextSample : !nextSample ? prevSample : Math.abs(prevSample.time.getTime() - tick) <= Math.abs(nextSample.time.getTime() - tick) ? prevSample : nextSample;
      if (!sample || sample.targetAlt < 5 || sample.moonAngle == null) continue;
      const x = xScale(sample.time);
      const y = yScale(sample.targetAlt);
      svg
        .append("text")
        .attr("x", x + 6)
        .attr("y", y - 6)
        .attr("fill", "#4cb54cff")
        .attr("font-size", 12)
        .attr("pointer-events", "none")
        .text(`${sample.moonAngle.toFixed(0)}°`);
    }

    const { start, end } = scale;
    if (start && end) {
      const { start: nightStart, end: nightEnd } = findNightInterval(obsLat, obsLon, start, end);
      const annotate = (label: string, time: Date, color: string) => {
        svg
          .append("line")
          .attr("x1", xScale(time))
          .attr("x2", xScale(time))
          .attr("y1", margin.top)
          .attr("y2", margin.top + innerHeight)
          .attr("stroke", color)
          .attr("stroke-width", 1)
          .attr("stroke-dasharray", "4,2");
        svg
          .append("text")
          .attr("x", xScale(time) + 4)
          .attr("y", margin.top + 14)
          .attr("fill", color)
          .attr("font-size", 12)
          .text(label);
      };
      if (nightStart) annotate(`night start ${nightStart.toLocaleTimeString()}`, nightStart, "#158ebeff");
      if (nightEnd) annotate(`night end ${nightEnd.toLocaleTimeString()}`, nightEnd, "#158ebeff");
    }

    svg
      .append("g")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(yScale))
      .attr("color", "#b75050ff");

    svg
      .append("g")
      .attr("transform", `translate(${margin.left + innerWidth},0)`)
      .call(d3.axisRight(moonScale))
      .attr("color", "#4cb54cff");

    svg
      .append("g")
      .attr("transform", `translate(0,${margin.top + innerHeight})`)
      .call(d3.axisBottom(xScale).ticks(d3.timeHour.every(2)).tickFormat(d3.timeFormat("%H:%M") as any));

    svg
      .append("text")
      .attr("x", width / 2)
      .attr("y", 18)
      .attr("text-anchor", "middle")
      .attr("fill", "grey")
      .text(source.name);

    svg
      .append("text")
      .attr("x", width / 2)
      .attr("y", height - 10)
      .attr("text-anchor", "middle")
      .attr("fill", "grey")
      .text("时间");

    svg
      .append("text")
      .attr("transform", `translate(20,${height / 2}) rotate(-90)`)
      .attr("text-anchor", "middle")
      .attr("fill", "grey")
      .text("高度角 (°)");

    svg
      .append("text")
      .attr("transform", `translate(${width - 20},${height / 2}) rotate(-90)`)
      .attr("text-anchor", "middle")
      .attr("fill", "grey")
      .text("月亮高度 (°)");

    const focus = svg
      .append("g")
      .style("display", "none");

    focus
      .append("circle")
      .attr("r", 5)
      .attr("fill", "yellow")
      .attr("stroke", "black");

    const bisect = d3.bisector<AltitudeSample, Date>(d => d.time).center;

    const overlay = svg
      .append("rect")
      .attr("x", margin.left)
      .attr("y", margin.top)
      .attr("width", innerWidth)
      .attr("height", innerHeight)
      .attr("fill", "transparent")
      .style("cursor", "crosshair")
      .on("mouseover", () => {
        focus.style("display", null);
      })
      .on("mouseout", () => {
        focus.style("display", "none");
        setHover(null);
        onHover?.(null);
      })
      .on("mousemove", event => {
        const [x] = d3.pointer(event);
        const time = xScale.invert(x);
        const index = bisect(samples, time);
        const sample = samples[Math.max(0, Math.min(samples.length - 1, index))];
        if (!sample) return;
        focus.attr("transform", `translate(${xScale(sample.time)},${yScale(sample.targetAlt)})`);
        const result: AltitudeSample = {
          time: sample.time,
          targetAlt: sample.targetAlt,
          moonAlt: sample.moonAlt,
          moonAngle: sample.moonAngle,
        };
        setHover(result);
        onHover?.(result);
      });

    return () => {
      overlay.on("mousemove", null).on("mouseout", null).on("mouseover", null);
    };
  }, [source, samples, moonSeries, obsLat, obsLon, scale, width, height, onHover]);

  if (!source) {
    return <div style={{ padding: "1rem", textAlign: "center" }}>请选择一个源以查看高度变化</div>;
  }

  if (!samples.length) {
    return <div style={{ padding: "1rem", textAlign: "center" }}>在所选时间范围内没有可用的数据</div>;
  }

  return (
    <div style={{ position: "relative" }}>
      {/* Responsive SVG: keep internal drawing coordinates using width/height via viewBox,
          but allow the element to scale to its container. */}
      <svg
        ref={svgRef}
        width="100%"
        viewBox={`0 0 ${width} ${height}`}
        height={height}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`高度曲线 ${source.name}`}
      />
      {hover && (
        <div className="tooltip-box">
          <div>{formatDatetimeLocal(hover.time)}</div>
          <div>目标高度: {hover.targetAlt.toFixed(1)}°</div>
          <div>月亮高度: {hover.moonAlt !== null ? hover.moonAlt.toFixed(1) : "--"}°</div>
          <div>月亮夹角: {hover.moonAngle !== null ? hover.moonAngle.toFixed(1) : "--"}°</div>
        </div>
      )}
    </div>
  );
};

export default AltitudeChart;
