import type { GeometryConfig } from "../physics/geometry";

/** Meridional plot streamwise extent [m] */
export const OVERVIEW_LENGTH_M = 0.5;
export const OVERVIEW_LENGTH_MM = OVERVIEW_LENGTH_M * 1e3;

export function surfaceAngleRad(geometry: GeometryConfig): number {
  if (geometry.kind === "flat_plate") return 0;
  const halfRad = (geometry.coneHalfAngleDeg * Math.PI) / 180;
  return geometry.kind === "wedge" ? Math.max(halfRad, 0.001) : halfRad;
}

export function surfaceYMm(xM: number, geometry: GeometryConfig): number {
  return xM * Math.tan(surfaceAngleRad(geometry)) * 1e3;
}

export function shockYMm(xM: number, shockAngleDeg: number): number {
  return xM * Math.tan((shockAngleDeg * Math.PI) / 180) * 1e3;
}

/** Zoom window [m] around x_sel for detail plot */
export function detailXWindow(xSel: number, halfWidth = 0.08): { x0: number; x1: number } {
  const x0 = Math.max(0, xSel - halfWidth);
  const x1 = Math.min(OVERVIEW_LENGTH_M, xSel + halfWidth);
  return { x0, x1 };
}

export function interpAtX(xArr: number[], yArr: number[], x: number): number {
  if (x <= xArr[0]) return yArr[0];
  if (x >= xArr[xArr.length - 1]) return yArr[yArr.length - 1];
  for (let i = 0; i < xArr.length - 1; i++) {
    if (x >= xArr[i] && x <= xArr[i + 1]) {
      const t = (x - xArr[i]) / (xArr[i + 1] - xArr[i]);
      return yArr[i] + t * (yArr[i + 1] - yArr[i]);
    }
  }
  return yArr[yArr.length - 1];
}
