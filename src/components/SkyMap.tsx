import { useEffect, useRef } from "react";
import * as d3 from "d3";
import * as d3geo from "d3-geo-projection";
import { Source } from "../types";
import {
  convertEquatorialToGalactic,
  computeObservableRegions,
  formatLon,
  galacticX,
  isAstronomicalNight,
  computeMoonInfo,
} from "../utils/coordinates";

export const projections = {
  Mollweide: () => d3geo.geoMollweide(),
  Equirectangular: () => d3.geoEquirectangular(),
  Aitoff: () => d3geo.geoAitoff(),
};

type ProjectionName = keyof typeof projections;

interface SkyMapProps {
  sources: Source[];
  highlight: Source | null;
  projectionName: ProjectionName;
  rotation: [number, number];
  onRotationChange: (rotation: [number, number]) => void;
  width?: number;
  height?: number;
  obsLat: number;
  obsLon: number;
  obsTime: string;
}

const latitudes = [-60, -30, 0, 30, 60];
const longitudes = [-180, -120, -60, 0, 60, 120, 180];
const blockSize = 4;

const SkyMap = ({
  sources,
  highlight,
  projectionName,
  rotation,
  onRotationChange,
  width = 800,
  height = 600,
  obsLat,
  obsLon,
  obsTime,
}: SkyMapProps) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const rotationRef = useRef<[number, number]>(rotation);

  // Keep a ref to the latest rotation so we don't have to re-bind the drag handler
  // whenever rotation state changes (that would interrupt an in-progress drag).
  useEffect(() => {
    rotationRef.current = rotation;
  }, [rotation]);

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.call(
      d3
        .drag<SVGSVGElement, unknown>()
        .on("start", event => {
          dragRef.current = { x: event.x, y: event.y };
        })
        .on("drag", event => {
          if (!dragRef.current) return;
          const dx = event.x - dragRef.current.x;
          const dy = event.y - dragRef.current.y;
          const sensitivity = 0.5;
          const prev = rotationRef.current;
          onRotationChange([prev[0] + dx * sensitivity, prev[1] - dy * sensitivity]);
          dragRef.current = { x: event.x, y: event.y };
        })
        .on("end", () => {
          dragRef.current = null;
        })
    );
  }, [onRotationChange]);

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const scaleBase = 150;
    const scale = scaleBase * (width / 1000);

    const projection = projections[projectionName]()
      .translate([width / 2, height / 2])
      .scale(scale)
      .rotate(rotation);

    const path = d3.geoPath(projection);

    const graticule = d3.geoGraticule10();
    svg
      .append("path")
      .datum(graticule)
      .attr("d", path as any)
      .attr("fill", "none")
      .attr("stroke", "#999")
      .attr("stroke-opacity", 0.5);

    latitudes.forEach(lat => {
      const lonRange = d3.range(-180, 181, 1);
      const line = { type: "LineString", coordinates: lonRange.map(l => [l, lat]) };
      svg
        .append("path")
        .datum(line as any)
        .attr("d", path as any)
        .attr("fill", "none")
        .attr("stroke", "#158ebeff")
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "4,2");
      const textPos = projection([galacticX(180), lat]);
      if (textPos) {
        svg
          .append("text")
          .attr("x", textPos[0] + 5)
          .attr("y", textPos[1])
          .text(`${lat}°`)
          .attr("font-size", 12)
          .attr("fill", "#158ebeff");
      }
    });

    longitudes.forEach(lon => {
      const latRange = d3.range(-90, 91, 1);
      const line = { type: "LineString", coordinates: latRange.map(lat => [lon, lat]) };
      svg
        .append("path")
        .datum(line as any)
        .attr("d", path as any)
        .attr("fill", "none")
        .attr("stroke", "#4cb54cff")
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "4,2");
      const textPos = projection([galacticX(lon), 0]);
      if (textPos) {
        svg
          .append("text")
          .attr("x", textPos[0])
          .attr("y", textPos[1] - 5)
          .text(`${formatLon(lon)}°`)
          .attr("font-size", 12)
          .attr("fill", "#4cb54cff");
      }
    });

    const date = new Date(obsTime);
    const observablePoints = isAstronomicalNight(date, obsLat, obsLon)
      ? computeObservableRegions(obsLat, obsLon, date)
      : [];

    if (observablePoints.length) {
      svg
        .selectAll("rect")
        .data(observablePoints)
        .join("rect")
        .attr("x", d => {
          const projected = projection([galacticX(d[0]), d[1]]);
          return projected ? projected[0] - blockSize / 2 : -100;
        })
        .attr("y", d => {
          const projected = projection([galacticX(d[0]), d[1]]);
          return projected ? projected[1] - blockSize / 2 : -100;
        })
        .attr("width", blockSize)
        .attr("height", blockSize)
        .attr("fill", "rgba(255,0,0,0.35)");
    }

    const moonInfo = computeMoonInfo(date);
    const merged = svg
      .selectAll<SVGCircleElement, Source>("circle")
      .data(sources, d => d.name)
      .join(
        enter => {
          const circle = enter.append("circle");
          circle.append("title");
          return circle;
        },
        update => update,
        exit => exit.remove()
      );

    merged
      .attr("cx", d => {
        const gal = convertEquatorialToGalactic(d.ra, d.dec);
        return projection([galacticX(gal.l), gal.b])?.[0] ?? 0;
      })
      .attr("cy", d => {
        const gal = convertEquatorialToGalactic(d.ra, d.dec);
        return projection([galacticX(gal.l), gal.b])?.[1] ?? 0;
      })
      .attr("r", d => (highlight && d.name === highlight.name ? 7 : 4))
      .attr("fill", d => (highlight && d.name === highlight.name ? "yellow" : "#b75050ff"))
      .attr("stroke", d => (highlight && d.name === highlight.name ? "black" : "none"))
      .attr("stroke-width", d => (highlight && d.name === highlight.name ? 2 : 0));

    merged
      .select("title")
      .text(
        d =>
          `${d.name}\nRA: ${d.ra.toFixed(3)}\nDEC: ${d.dec.toFixed(3)}\n月相: ${moonInfo.name} ${(
            moonInfo.fraction *
            100
          ).toFixed(1)}%`
      );
  }, [sources, highlight, projectionName, rotation, obsLat, obsLon, obsTime]);

  // Use viewBox + width:100% so the SVG is responsive inside flex containers.
  // The projection and drawing still use the numeric `width`/`height` for coordinates,
  // but the rendered SVG will scale to fit its parent, avoiding overflow on zoom.
  return (
    <svg
      ref={svgRef}
      width="100%"
      viewBox={`0 0 ${width} ${height}`}
      height={height}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="全天地图"
    />
  );
};

export default SkyMap;
