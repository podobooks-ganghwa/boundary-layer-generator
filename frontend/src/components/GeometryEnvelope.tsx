import Plot from "react-plotly.js";
import type { ProfileAtX, XSweepResult } from "../physics/profiles";
import { geometryLabel, type GeometryConfig } from "../physics/geometry";

interface Props {
  sweep: XSweepResult;
  prof: ProfileAtX;
  geometry: GeometryConfig;
  xSel: number;
  visualScale: number;
}

export default function GeometryEnvelope({
  sweep,
  prof,
  geometry,
  xSel,
  visualScale,
}: Props) {
  const x = sweep.x;
  const halfRad = (geometry.coneHalfAngleDeg * Math.PI) / 180;
  const scale = Math.max(1, visualScale);

  let ySurf: number[];
  let centerline: number[] | null = null;

  if (geometry.kind === "flat_plate") {
    ySurf = x.map(() => 0);
  } else {
    const angle = geometry.kind === "wedge" ? Math.max(halfRad, 0.001) : halfRad;
    ySurf = x.map((xi) => xi * Math.tan(angle));
    if (geometry.kind === "cone") {
      centerline = x.map(() => 0);
    }
  }

  const ySurfMm = ySurf.map((y) => y * 1e3);
  const yBlMm = ySurf.map((ys, i) => (ys + sweep.delta_99[i] * scale) * 1e3);

  // Profile bulge at x_sel (exaggerated, drawn above surface)
  const ySurfAtX =
    geometry.kind === "flat_plate"
      ? 0
      : xSel * Math.tan(geometry.kind === "wedge" ? Math.max(halfRad, 0.001) : halfRad);
  const ySurfAtXMm = ySurfAtX * 1e3;
  const yProfMm = prof.y.map((yj) => (ySurfAtX + yj * scale) * 1e3);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const traces: any[] = [];

  if (centerline) {
    traces.push({
      x,
      y: centerline.map(() => 0),
      mode: "lines",
      name: "중심선",
      line: { color: "#888", dash: "dot", width: 1 },
    });
  }

  traces.push({
    x,
    y: ySurfMm,
    mode: "lines",
    name: "몸체 표면",
    line: { color: "#1a1a1a", width: 3 },
  });

  traces.push({
    x,
    y: yBlMm,
    mode: "lines",
    name: `δ₉₉ (${scale}× 표시)`,
    line: { color: "#2980b9", dash: "dash", width: 2 },
    fill: "tonexty",
    fillcolor: "rgba(41,128,185,0.2)",
  });

  // Filled BL bulge at selected x (exaggerated)
  const xBulge = [xSel, ...prof.y.map(() => xSel), xSel];
  const yBulge = [ySurfAtXMm, ...yProfMm, ySurfAtXMm];
  traces.push({
    x: xBulge,
    y: yBulge,
    fill: "toself",
    fillcolor: "rgba(231,76,60,0.4)",
    line: { color: "#c0392b", width: 2.5 },
    mode: "lines",
    name: `경계층 @ x=${xSel.toPrecision(3)} m (${scale}×)`,
  });

  const layout: Record<string, unknown> = {
    title: {
      text: `${geometryLabel(geometry)} + 경계층 (시각화 ${scale}× 과장)`,
      font: { size: 14 },
    },
    margin: { l: 55, r: 24, t: 48, b: 48 },
    xaxis: { title: "x [m]" },
    yaxis: { title: "y [mm]", rangemode: "tozero" },
    height: 420,
    legend: { x: 0.02, y: 0.98, font: { size: 10 } },
    shapes: [
      {
        type: "line",
        x0: xSel,
        x1: xSel,
        y0: 0,
        y1: 1,
        yref: "paper",
        line: { color: "#27ae60", dash: "dot", width: 2 },
      },
    ],
    annotations: [
      {
        x: xSel,
        y: 1,
        yref: "paper",
        text: `x = ${xSel.toPrecision(3)} m`,
        showarrow: false,
        font: { size: 11, color: "#27ae60" },
        xanchor: "left",
      },
      {
        x: xSel,
        y: yBlMm[Math.min(Math.max(0, x.findIndex((xi) => xi >= xSel)), x.length - 1)] ?? 0,
        text: "δ₉₉",
        showarrow: true,
        arrowhead: 2,
        ax: 40,
        ay: -20,
        font: { size: 11, color: "#2980b9" },
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
