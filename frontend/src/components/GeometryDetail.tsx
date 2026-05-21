import Plot from "react-plotly.js";
import type { ProfileAtX, XSweepResult } from "../physics/profiles";
import { geometryLabel, type GeometryConfig } from "../physics/geometry";
import {
  detailXWindow,
  interpAtX,
  shockYMm,
  surfaceYMm,
} from "./geometryPlotUtils";

interface Props {
  sweep: XSweepResult;
  prof: ProfileAtX;
  geometry: GeometryConfig;
  xSel: number;
  shockAngleDeg?: number;
}

const PROFILE_FAN_MM = 45;

export default function GeometryDetail({
  sweep,
  prof,
  geometry,
  xSel,
  shockAngleDeg,
}: Props) {
  const { x0, x1 } = detailXWindow(xSel);
  const n = 80;
  const x = Array.from({ length: n }, (_, i) => x0 + (i / (n - 1)) * (x1 - x0));
  const xMm = x.map((xi) => xi * 1e3);
  const ySurfMm = x.map((xi) => surfaceYMm(xi, geometry));
  const yBlMm = x.map((xi, i) => {
    const d99 = interpAtX(sweep.x, sweep.delta_99, xi);
    return ySurfMm[i] + d99 * 1e3;
  });

  const xSelMm = xSel * 1e3;
  const ySurfAtSel = surfaceYMm(xSel, geometry);
  const yMm = prof.y.map((yj) => (ySurfAtSel + yj * 1e3));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const traces: any[] = [];

  traces.push({
    x: xMm,
    y: ySurfMm,
    mode: "lines",
    name: "표면",
    line: { color: "#1a1a1a", width: 3 },
    fill: "tozeroy",
    fillcolor: "rgba(0,0,0,0.04)",
  });

  if (shockAngleDeg != null && shockAngleDeg > 0) {
    traces.push({
      x: xMm,
      y: x.map((xi) => shockYMm(xi, shockAngleDeg)),
      mode: "lines",
      name: "충격파",
      line: { color: "#e67e22", dash: "dashdot", width: 2 },
    });
  }

  traces.push({
    x: xMm,
    y: yBlMm,
    mode: "lines",
    name: "δ₉₉",
    line: { color: "#2980b9", dash: "dash", width: 1.5 },
  });

  const xBl = [xSelMm, ...prof.y.map(() => xSelMm), xSelMm];
  const yBl = [ySurfAtSel, ...yMm, ySurfAtSel];
  traces.push({
    x: xBl,
    y: yBl,
    fill: "toself",
    fillcolor: "rgba(231,76,60,0.25)",
    line: { color: "#c0392b", width: 2 },
    mode: "lines",
    name: "경계층",
  });

  const profileSeries = [
    { name: "u/U_e", values: prof.u_over_Ue, color: "#2980b9" },
    { name: "T/T_e", values: prof.T_over_Te, color: "#c0392b" },
    { name: "ρ/ρ_e", values: prof.rho_over_rhoe, color: "#27ae60" },
    { name: "Mach", values: prof.M, color: "#8e44ad" },
  ];

  for (const ps of profileSeries) {
    traces.push({
      x: ps.values.map((v) => xSelMm + PROFILE_FAN_MM * v),
      y: yMm,
      mode: "lines",
      name: ps.name,
      line: { color: ps.color, width: 2 },
      xaxis: "x",
      yaxis: "y",
    });
  }

  const layout: Record<string, unknown> = {
    title: {
      text: `${geometryLabel(geometry)} — x = ${xSelMm.toFixed(0)} mm 확대 + 프로파일`,
      font: { size: 14 },
    },
    margin: { l: 55, r: 24, t: 48, b: 48 },
    xaxis: {
      title: "x [mm] (표면) / 프로파일 →",
      range: [x0 * 1e3 - 5, x1 * 1e3 + PROFILE_FAN_MM + 15],
    },
    yaxis: { title: "y [mm]", rangemode: "tozero" },
    height: 420,
    legend: { x: 0.55, y: 0.98, font: { size: 10 } },
    shapes: [
      {
        type: "line",
        x0: xSelMm,
        x1: xSelMm,
        y0: 0,
        y1: 1,
        yref: "paper",
        line: { color: "#27ae60", width: 2 },
      },
    ],
    annotations: [
      {
        x: xSelMm + PROFILE_FAN_MM * 0.5,
        y: 1.02,
        yref: "paper",
        text: "프로파일 가로축: 정규화 값 (0→1 ≈ 45 mm)",
        showarrow: false,
        font: { size: 10, color: "#555" },
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
