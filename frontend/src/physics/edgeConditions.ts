import { CP, R_GAS } from "./constants";
import {
  densityFromIdealGas,
  sutherlandViscosity,
  speedOfSound,
  temperatureFromTotal,
  velocityFromMach,
} from "./gas";
import { obliqueShock, type FreestreamState, type PostShockState } from "./shockRelations";

export interface EdgeConditions {
  M_e: number;
  U_e: number;
  T_e: number;
  p_e: number;
  rho_e: number;
  mu_e: number;
  a_e: number;
  Re_unit: number;
  T_w: number;
}

export interface EdgeFromFreestreamResult {
  edge: EdgeConditions;
  freestream: FreestreamState;
  shock: PostShockState;
  resolved: ResolvedFreestream;
}

function reUnit(rho_e: number, U_e: number, mu_e: number): number {
  return (rho_e * U_e) / mu_e;
}

function edgeFromPostShock(
  shock: PostShockState,
  T_w: number
): EdgeConditions {
  const { M_e, p_e, T_e } = shock;
  const rho_e = densityFromIdealGas(p_e, T_e) as number;
  const mu_e = sutherlandViscosity(T_e) as number;
  const U_e = velocityFromMach(M_e, T_e);
  const a_e = speedOfSound(T_e) as number;
  return {
    M_e,
    U_e,
    T_e,
    p_e,
    rho_e,
    mu_e,
    a_e,
    Re_unit: reUnit(rho_e, U_e, mu_e),
    T_w,
  };
}

export interface ResolvedFreestream extends FreestreamState {
  U_inf: number;
  Re_unit_fs: number;
  inputLabel: string;
}

/** Mode B: U∞, p∞, T∞ (정적 프리스트림). */
export function resolveFreestreamModeB(params: {
  U_inf: number;
  p_inf: number;
  T_inf: number;
}): ResolvedFreestream {
  const { U_inf, p_inf, T_inf } = params;
  const a = speedOfSound(T_inf) as number;
  const M_inf = U_inf / a;
  const rho = densityFromIdealGas(p_inf, T_inf) as number;
  const mu = sutherlandViscosity(T_inf) as number;
  return {
    M_inf,
    p_inf,
    T_inf,
    U_inf,
    Re_unit_fs: reUnit(rho, U_inf, mu),
    inputLabel: "U∞ + p∞ + T∞",
  };
}

/** Mode A: M∞, T₀(또는 h₀), Re_unit — 정적 T∞, p∞ 유도 (프리스트림 기준 Re). */
export function resolveFreestreamModeA(params: {
  M_inf: number;
  Re_unit: number;
  T0?: number;
  h0?: number;
}): ResolvedFreestream {
  let T0_val: number;
  if (params.T0 != null && params.h0 == null) {
    T0_val = params.T0;
  } else if (params.h0 != null && params.T0 == null) {
    T0_val = params.h0 / CP;
  } else {
    throw new Error("T₀ 또는 h₀ 중 하나만 지정하세요.");
  }

  const M_inf = params.M_inf;
  const T_inf = temperatureFromTotal(T0_val, M_inf);
  const U_inf = velocityFromMach(M_inf, T_inf);
  const mu_inf = sutherlandViscosity(T_inf) as number;
  const p_inf = (params.Re_unit * mu_inf * R_GAS * T_inf) / U_inf;

  return {
    M_inf,
    p_inf,
    T_inf,
    U_inf,
    Re_unit_fs: params.Re_unit,
        inputLabel: params.h0 != null ? "M∞ + Re_unit + h_tot" : "M∞ + Re_unit + T₀",
  };
}

/**
 * 프리스트림 입력 → 정적 (M∞,p∞,T∞) → oblique shock → 엣지.
 */
export function fromFreestreamWithShock(params: {
  inputMode: "mode_a" | "mode_b";
  T_w: number;
  deflectionDeg: number;
  M_inf?: number;
  T0?: number;
  h0?: number;
  Re_unit?: number;
  U_inf?: number;
  p_inf?: number;
  T_inf?: number;
}): EdgeFromFreestreamResult & { resolved: ResolvedFreestream } {
  const resolved =
    params.inputMode === "mode_b"
      ? resolveFreestreamModeB({
          U_inf: params.U_inf!,
          p_inf: params.p_inf!,
          T_inf: params.T_inf!,
        })
      : resolveFreestreamModeA({
          M_inf: params.M_inf!,
          Re_unit: params.Re_unit!,
          ...(params.h0 != null ? { h0: params.h0 } : { T0: params.T0 }),
        });

  const freestream: FreestreamState = {
    M_inf: resolved.M_inf,
    p_inf: resolved.p_inf,
    T_inf: resolved.T_inf,
  };
  const shock = obliqueShock(freestream, (params.deflectionDeg * Math.PI) / 180);
  const edge = edgeFromPostShock(shock, params.T_w);
  return { edge, freestream, shock, resolved };
}

export function fromModeA(params: {
  M_e: number;
  T_w: number;
  T0?: number;
  h0?: number;
  Re_unit: number;
  p_e?: number;
}): EdgeConditions {
  const { M_e, T_w, Re_unit, p_e: p_eIn } = params;
  let T0_val: number;
  if (params.T0 != null && params.h0 == null) {
    T0_val = params.T0;
  } else if (params.h0 != null && params.T0 == null) {
    T0_val = params.h0 / CP;
  } else {
    throw new Error("T₀ 또는 h₀ 중 하나만 지정하세요.");
  }

  const T_e = temperatureFromTotal(T0_val, M_e);
  const U_e = velocityFromMach(M_e, T_e);
  const mu_e = sutherlandViscosity(T_e) as number;

  const rho_e = (Re_unit * mu_e) / U_e;
  const p_e = p_eIn ?? rho_e * R_GAS * T_e;

  const a_e = speedOfSound(T_e) as number;
  return {
    M_e,
    U_e,
    T_e,
    p_e,
    rho_e,
    mu_e,
    a_e,
    Re_unit: reUnit(rho_e, U_e, mu_e),
    T_w,
  };
}

export function fromModeB(params: {
  U_e: number;
  p_e: number;
  T_e: number;
  T_w: number;
}): EdgeConditions {
  const { U_e, p_e, T_e, T_w } = params;
  const rho_e = densityFromIdealGas(p_e, T_e) as number;
  const mu_e = sutherlandViscosity(T_e) as number;
  const a_e = speedOfSound(T_e) as number;
  const M_e = U_e / a_e;
  return {
    M_e,
    U_e,
    T_e,
    p_e,
    rho_e,
    mu_e,
    a_e,
    Re_unit: reUnit(rho_e, U_e, mu_e),
    T_w,
  };
}

export function edgeToRows(edge: EdgeConditions): { quantity: string; value: string }[] {
  return [
    { quantity: "M_e (엣지)", value: edge.M_e.toPrecision(5) },
    { quantity: "U_e [m/s]", value: edge.U_e.toPrecision(5) },
    { quantity: "T_e [K]", value: edge.T_e.toPrecision(5) },
    { quantity: "p_e [Pa]", value: edge.p_e.toPrecision(5) },
    { quantity: "ρ_e [kg/m³]", value: edge.rho_e.toPrecision(5) },
    { quantity: "μ_e [Pa·s]", value: edge.mu_e.toExponential(3) },
    { quantity: "a_e [m/s]", value: edge.a_e.toPrecision(5) },
    { quantity: "Re_unit [1/m]", value: edge.Re_unit.toExponential(4) },
    { quantity: "T_w [K]", value: edge.T_w.toPrecision(5) },
  ];
}

export function freestreamShockToRows(
  resolved: ResolvedFreestream,
  shock: PostShockState
): { quantity: string; value: string }[] {
  return [
    { quantity: "입력 형식", value: resolved.inputLabel },
    { quantity: "M∞", value: resolved.M_inf.toPrecision(5) },
    { quantity: "U∞ [m/s]", value: resolved.U_inf.toPrecision(5) },
    { quantity: "p∞ [Pa] (유도/입력)", value: resolved.p_inf.toPrecision(5) },
    { quantity: "T∞ [K] (유도/입력)", value: resolved.T_inf.toPrecision(5) },
    { quantity: "Re_unit,∞ [1/m]", value: resolved.Re_unit_fs.toExponential(4) },
    { quantity: "θ [deg]", value: shock.theta_deg.toFixed(2) },
    { quantity: "β [deg]", value: shock.beta_deg.toFixed(2) },
    { quantity: "→ M_e", value: shock.M_e.toPrecision(5) },
    { quantity: "→ p_e [Pa]", value: shock.p_e.toPrecision(5) },
    { quantity: "→ T_e [K]", value: shock.T_e.toPrecision(5) },
  ];
}
