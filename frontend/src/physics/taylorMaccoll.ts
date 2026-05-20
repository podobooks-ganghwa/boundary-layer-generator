/**
 * Taylor–Maccoll conical shock solver (axisymmetric cone, calorically perfect gas).
 * Equations match src/boundary_layer/taylor_maccoll.py.
 */

import { GAMMA, R_GAS } from "./constants";

export interface TaylorMaccollResult {
  beta_deg: number;
  delta_deg: number;
  M2: number;
  M_e: number;
  p2_over_p_inf: number;
  T2_over_T_inf: number;
  rho2_over_rho_inf: number;
  p_e_over_p_inf: number;
  T_e_over_T_inf: number;
  rho_e_over_rho_inf: number;
  U_e: number;
  p_e: number;
  T_e: number;
  rho_e: number;
  Vtheta_at_cone: number;
  attached: boolean;
  note: string;
}

function vbarFromMach(M: number, gamma: number): number {
  return Math.sqrt((M * M) / (M * M + 2 / (gamma - 1)));
}

function shockJump(
  M_inf: number,
  beta: number,
  gamma: number
): { M2: number; delta: number; p2_p1: number; rho2_rho1: number; T2_T1: number } {
  const sb = Math.sin(beta);
  const Mn1 = M_inf * sb;
  const gp1 = gamma + 1;
  const gm1 = gamma - 1;
  const p2_p1 = 1 + ((2 * gamma) / gp1) * (Mn1 * Mn1 - 1);
  const rho2_rho1 = (gp1 * Mn1 * Mn1) / (gm1 * Mn1 * Mn1 + 2);
  const T2_T1 = p2_p1 / rho2_rho1;
  const tanDelta =
    ((2 / Math.tan(beta)) * (M_inf * M_inf * sb * sb - 1)) /
    (M_inf * M_inf * (gamma + Math.cos(2 * beta)) + 2);
  const delta = Math.atan(tanDelta);
  const Mn2_sq = (1 + 0.5 * gm1 * Mn1 * Mn1) / (gamma * Mn1 * Mn1 - 0.5 * gm1);
  if (Mn2_sq <= 0) throw new Error("Invalid Mn2² behind shock.");
  const Mn2 = Math.sqrt(Mn2_sq);
  const sinDelta = Math.sin(beta - delta);
  if (sinDelta <= 1e-12) throw new Error("Shock angle too close to surface.");
  const M2 = Mn2 / sinDelta;
  return { M2, delta, p2_p1, rho2_rho1, T2_T1 };
}

function tmRhs(
  theta: number,
  vr: number,
  vt: number,
  gamma: number
): { dVr: number; dVt: number } | null {
  const gm1 = 0.5 * (gamma - 1);
  const oneMinus = 1 - vr * vr - vt * vt;
  const den = gm1 * oneMinus - vt * vt;
  if (Math.abs(den) < 1e-14) return null;
  const num = vt * vt * vr - gm1 * oneMinus * (2 * vr + vt / Math.tan(theta));
  return { dVr: vt, dVt: num / den };
}

function rk4Step(
  theta: number,
  vr: number,
  vt: number,
  h: number,
  gamma: number
): { theta: number; vr: number; vt: number } | null {
  const k1 = tmRhs(theta, vr, vt, gamma);
  if (!k1) return null;
  const k2 = tmRhs(theta + 0.5 * h, vr + 0.5 * h * k1.dVr, vt + 0.5 * h * k1.dVt, gamma);
  if (!k2) return null;
  const k3 = tmRhs(theta + 0.5 * h, vr + 0.5 * h * k2.dVr, vt + 0.5 * h * k2.dVt, gamma);
  if (!k3) return null;
  const k4 = tmRhs(theta + h, vr + h * k3.dVr, vt + h * k3.dVt, gamma);
  if (!k4) return null;
  return {
    theta: theta + h,
    vr: vr + (h / 6) * (k1.dVr + 2 * k2.dVr + 2 * k3.dVr + k4.dVr),
    vt: vt + (h / 6) * (k1.dVt + 2 * k2.dVt + 2 * k3.dVt + k4.dVt),
  };
}

function integrateToCone(
  beta: number,
  theta_c: number,
  M_inf: number,
  gamma: number,
  nSteps?: number
): { vr: number; vt: number; M2: number } {
  const { M2, delta } = shockJump(M_inf, beta, gamma);
  const q2 = vbarFromMach(M2, gamma);
  let vr = q2 * Math.cos(beta - delta);
  let vt = -q2 * Math.sin(beta - delta);
  if (theta_c >= beta - 1e-10) {
    throw new Error("Cone half-angle must be less than shock angle.");
  }
  const n = nSteps ?? Math.max(400, Math.floor((beta - theta_c) / 2e-4));
  const h = (theta_c - beta) / n;
  let theta = beta;
  for (let i = 0; i < n; i++) {
    const step = rk4Step(theta, vr, vt, h, gamma);
    if (!step) throw new Error("Taylor–Maccoll integration failed (singular ODE).");
    theta = step.theta;
    vr = step.vr;
    vt = step.vt;
    if (vr * vr + vt * vt >= 1 - 1e-8) {
      throw new Error("Normalized velocity exceeded sonic limit.");
    }
  }
  return { vr, vt, M2 };
}

function vtAtCone(beta: number, theta_c: number, M_inf: number, gamma: number): number {
  try {
    return integrateToCone(beta, theta_c, M_inf, gamma).vt;
  } catch {
    return NaN;
  }
}

function machFromVbar(q: number, gamma: number): number {
  if (q >= 1 - 1e-12) throw new Error("q ≥ 1 in Mach recovery.");
  return Math.sqrt(((2 / (gamma - 1)) * q * q) / (1 - q * q));
}

export function solveTaylorMaccoll(params: {
  M_inf: number;
  p_inf: number;
  T_inf: number;
  theta_c_deg: number;
  gamma?: number;
  R?: number;
}): TaylorMaccollResult {
  const gamma = params.gamma ?? GAMMA;
  const R = params.R ?? R_GAS;
  const { M_inf, p_inf, T_inf, theta_c_deg } = params;

  if (M_inf <= 1) {
    throw new Error("M∞ must be > 1 for Taylor–Maccoll conical shock.");
  }

  const theta_c = (theta_c_deg * Math.PI) / 180;
  const mu = Math.asin(1 / M_inf);
  let betaLo = mu + 1e-4;
  let betaHi = 0.5 * Math.PI - 1e-4;

  const f = (b: number) => vtAtCone(b, theta_c, M_inf, gamma);
  let fLo = f(betaLo);
  let fHi = f(betaHi);

  if (!(Number.isFinite(fLo) && Number.isFinite(fHi)) || fLo * fHi > 0) {
    let bracket: [number, number] | null = null;
    const nScan = 80;
    let prevB: number | null = null;
    let prevF: number | null = null;
    for (let i = 0; i <= nScan; i++) {
      const b = betaLo + (i / nScan) * (betaHi - betaLo);
      const fb = f(b);
      if (!Number.isFinite(fb)) continue;
      if (prevB != null && prevF != null && prevF * fb <= 0) {
        bracket = [prevB, b];
        break;
      }
      prevB = b;
      prevF = fb;
    }
    if (!bracket) {
      throw new Error(
        "No attached Taylor–Maccoll solution (detached or integration failed)."
      );
    }
    [betaLo, betaHi] = bracket;
    fLo = f(betaLo);
    fHi = f(betaHi);
  }

  for (let iter = 0; iter < 70; iter++) {
    const mid = 0.5 * (betaLo + betaHi);
    const fMid = f(mid);
    if (!Number.isFinite(fMid)) {
      betaHi = mid;
      continue;
    }
    if (Math.abs(fMid) < 1e-9) {
      betaLo = betaHi = mid;
      break;
    }
    if (fLo * fMid <= 0) {
      betaHi = mid;
      fHi = fMid;
    } else {
      betaLo = mid;
      fLo = fMid;
    }
  }

  const beta = 0.5 * (betaLo + betaHi);
  const { M2, delta, p2_p1, rho2_rho1, T2_T1 } = shockJump(M_inf, beta, gamma);
  const { vr, vt } = integrateToCone(beta, theta_c, M_inf, gamma, 600);
  const q_e = Math.sqrt(vr * vr + vt * vt);
  const M_e = machFromVbar(q_e, gamma);

  const T0 = T_inf * (1 + 0.5 * (gamma - 1) * M_inf * M_inf);
  const p2 = p_inf * p2_p1;
  const p02 = p2 * (1 + 0.5 * (gamma - 1) * M2 * M2) ** (gamma / (gamma - 1));
  const T_e = T0 / (1 + 0.5 * (gamma - 1) * M_e * M_e);
  const p_e = p02 / (1 + 0.5 * (gamma - 1) * M_e * M_e) ** (gamma / (gamma - 1));
  const rho_inf = p_inf / (R * T_inf);
  const rho_e = p_e / (R * T_e);
  const U_e = M_e * Math.sqrt(gamma * R * T_e);

  return {
    beta_deg: (beta * 180) / Math.PI,
    delta_deg: (delta * 180) / Math.PI,
    M2,
    M_e,
    p2_over_p_inf: p2_p1,
    T2_over_T_inf: T2_T1,
    rho2_over_rho_inf: rho2_rho1,
    p_e_over_p_inf: p_e / p_inf,
    T_e_over_T_inf: T_e / T_inf,
    rho_e_over_rho_inf: rho_e / rho_inf,
    U_e,
    p_e,
    T_e,
    rho_e,
    Vtheta_at_cone: vt,
    attached: true,
    note: "Taylor–Maccoll axisymmetric conical shock (attached)",
  };
}
