import type { GeometryKind } from "./physics/geometry";

export type InputMode = "mode_a" | "mode_b";
export type BodyType = "2d" | "axisymmetric";
export type FlowLevel = "freestream" | "edge";

export interface AppInputs {
  /** Step 1 */
  bodyType: BodyType;
  /** Step 2: 2D wedge angle [deg], 0 = flat plate; axisymmetric = cone half-angle */
  halfAngleDeg: number;
  /** Step 3 */
  flowLevel: FlowLevel;
  /** Step 4–5: edge path only */
  inputMode: InputMode;
  /** Freestream mode A: M∞, T₀/h₀, Re_unit */
  M_inf: number;
  /** Freestream mode B: U∞, p∞, T∞ */
  U_inf: number;
  p_inf: number;
  T_inf: number;
  /** Edge path — mode A */
  M_e: number;
  T0: number;
  useH0: boolean;
  h0: number;
  Re_unit: number;
  /** Edge path — mode B */
  U_e: number;
  p_e: number;
  T_e: number;
  /** Step 6 */
  T_w: number;
  /** Results location */
  x_sel: number;
  x_min: number;
  x_max: number;
  n_x: number;
  eta_max: number;
  n_eta: number;
  yLogScale: boolean;
  /** Visual only: exaggerate BL thickness on geometry plot */
  blVisualScale: number;
}

export const DEFAULT_INPUTS: AppInputs = {
  bodyType: "axisymmetric",
  halfAngleDeg: 7,
  flowLevel: "freestream",
  inputMode: "mode_a",
  M_inf: 6.5,
  U_inf: 1700,
  p_inf: 1200,
  T_inf: 220,
  M_e: 5.9,
  T0: 1500,
  useH0: true,
  h0: 1.5e6,
  Re_unit: 9.9e6,
  U_e: 1698,
  p_e: 4670,
  T_e: 206,
  T_w: 300,
  x_sel: 0.3,
  x_min: 0.05,
  x_max: 0.5,
  n_x: 40,
  eta_max: 8,
  n_eta: 400,
  yLogScale: false,
  blVisualScale: 12,
};

export function deriveGeometry(inputs: AppInputs): {
  kind: GeometryKind;
  coneHalfAngleDeg: number;
} {
  if (inputs.bodyType === "axisymmetric") {
    return { kind: "cone", coneHalfAngleDeg: inputs.halfAngleDeg };
  }
  if (inputs.halfAngleDeg < 0.05) {
    return { kind: "flat_plate", coneHalfAngleDeg: 0 };
  }
  return { kind: "wedge", coneHalfAngleDeg: inputs.halfAngleDeg };
}

export const TOTAL_STEPS = 6;
