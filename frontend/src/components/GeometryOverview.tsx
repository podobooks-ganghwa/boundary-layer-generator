import Plot from "react-plotly.js";
import type { XSweepResult } from "../physics/profiles";
import { geometryLabel, type GeometryConfig } from "../physics/geometry";
import {
  interpAtX,
  OVERVIEW_LENGTH_M,
  OVERVIEW_LENGTH_MM,
  shockYMm,
  surfaceYMm,
} from "./geometryPlotUtils";

interface Props {
  sweep: XSweepResult;
  geometry: GeometryConfig;
  xSel: number;
  shockAngleDeg?: number;
}

export default function GeometryOverview({ sweep, geometry, xSel, shockAngleDeg }: Props) {
  const n = 120;
  const x = Array.from({ length: n }, (_, i) => (i / (n - 1)) * OVERVIEW_LENGTH_M);
  const xMm = x.map((xi) => xi * 1e3);
  const ySurfMm = x.map((xi) => surfaceYMm(xi, geometry));
  const yBlMm = x.map((xi, i) => {
    const d99 = interpAtX(sweep.x, sweep.delta_99, xi);
    return (ySurfMm[i] + d99 * 1e3);
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const traces: any[] = [];

  if (geometry.kind === "cone") {
    traces.push({
      x: xMm,
      y: xMm.map(() => 0),
      mode: "lines",
      name: "중심선",
      line: { color: "#999", dash: "dot", width: 1 },
    });
  }

  traces.push({
    x: xMm,
    y: ySurfMm,
    mode: "lines",
    name: "표면",
    line: { color: "#1a1a1a", width: 3 },
  });

  if (shockAngleDeg != null && shockAngleDeg > 0) {
    traces.push({
      x: xMm,
      y: x.map((xi) => shockYMm(xi, shockAngleDeg)),
      mode: "lines",
      name: `충격파 (${shockAngleDeg.toFixed(1)}°)`,
      line: { color: "#e67e22", dash: "dashdot", width: 2 },
    });
  }

  traces.push({
    x: xMm,
    y: yBlMm,
    mode: "lines",
    name: "δ₉₉",
    line: { color: "#2980b9", dash: "dash", width: 2 },
    fill: "tonexty",
    fillcolor: "rgba(41,128,185,0.15)",
  });

  const xSelMm = xSel * 1e3;

  const layout: Record<string, unknown> = {
    title: {
      text: `${geometryLabel(geometry)} — 전체 (${OVERVIEW_LENGTH_MM} mm)`,
      font: { size: 14 },
    },
    margin: { l: 55, r: 24, t: 48, b: 48 },
    xaxis: { title: "x [mm]", range: [0, OVERVIEW_LENGTH_MM] },
    yaxis: { title: "y [mm]", rangemode: "tozero" },
    height: 400,
    legend: { x: 0.02, y: 0.98, font: { size: 10 } },
    shapes: [
      {
        type: "line",
        x0: xSelMm,
        x1: xSelMm,
        y0: 0,
        y1: 1,
        yref: "paper",
        line: { color: "#27ae60", dash: "dot", width: 2 },
      },
    ],
    annotations: [
      {
        x: xSelMm,
        y: 1,
        yref: "paper",
        text: `x = ${xSelMm.toFixed(0)} mm`,
        showarrow: false,
        font: { size: 11, color: "#27ae60" },
        xanchor: "left",
      },
    ],
    paper_bgcolor: "transparent",
    plot_bgcolor: "#fafbfc",
  };

  return (
    <Plot
      data={traces}
      layout={layout}
      config={{ responsive: true, displayModeBar: false }}
      style={{ width: "100%" }}
    />
  );
}
