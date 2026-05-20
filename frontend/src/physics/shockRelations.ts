/**
 * Oblique shock relations (2D, calorically perfect gas).
 * Same framework as standard compressible calculators (e.g. VT AOE 3114).
 * Cone: wedge-angle equivalent (θ = half-angle) — first-order attached-shock estimate.
 */

import { GAMMA } from "./constants";

export interface FreestreamState {
  M_inf: number;
  p_inf: number;
  T_inf: number;
}

export interface PostShockState {
  M_e: number;
  p_e: number;
  T_e: number;
  beta_rad: number;
  beta_deg: number;
  theta_deg: number;
  attached: boolean;
  note: string;
}

const DEG = Math.PI / 180;

/** θ–β–M relation: deflection θ for given shock angle β and upstream M. */
function deflectionFromBeta(M1: number, beta: number, gamma: number): number {
  const sb = Math.sin(beta);
  const m1sb2 = M1 * M1 * sb * sb;
  const num = 2 / Math.tan(beta) * (m1sb2 - 1);
  const den = M1 * M1 * (gamma + Math.cos(2 * beta)) + 2;
  return Math.atan(num / den);
}

/** Rankine–Hugoniot jump across normal Mach component Mn1. */
function postNormalShock(Mn1: number, p1: number, T1: number, gamma: number) {
  const gp1 = gamma + 1;
  const gm1 = gamma - 1;
  const p2 = p1 * (1 + (gp1 / gm1) * (Mn1 * Mn1 - 1));
  const T2 =
    T1 *
    ((2 * gamma * Mn1 * Mn1 - gm1) * (gm1 * Mn1 * Mn1 + 2)) /
    (gp1 * gp1 * Mn1 * Mn1);
  const Mn2_sq = (Mn1 * Mn1 + 2 / gm1) / ((2 * gamma / gm1) * Mn1 * Mn1 + 1);
  const Mn2 = Math.sqrt(Math.max(Mn2_sq, 1e-12));
  return { p2, T2, Mn2 };
}

/**
 * Weak attached oblique shock for deflection angle θ [rad].
 * θ = 0 → no shock (freestream = edge).
 */
export function obliqueShock(
  freestream: FreestreamState,
  thetaRad: number,
  gamma = GAMMA
): PostShockState {
  const { M_inf: M1, p_inf: p1, T_inf: T1 } = freestream;
  const theta_deg = thetaRad / DEG;

  if (thetaRad < 1e-8) {
    return {
      M_e: M1,
      p_e: p1,
      T_e: T1,
      beta_rad: Math.PI / 2,
      beta_deg: 90,
      theta_deg,
      attached: true,
      note: "각도 0° — 충격파 없음, 엣지 = 프리스트림",
    };
  }

  if (M1 <= 1) {
    throw new Error("프리스트림 마하수는 1보다 커야 충격파 계산이 가능합니다.");
  }

  const mu = Math.asin(1 / M1);
  const thetaMax = maxDeflection(M1, gamma);
  if (thetaRad > thetaMax + 1e-6) {
    throw new Error(
      `편향각 ${theta_deg.toFixed(2)}° 가 최대 가능각 ${(thetaMax / DEG).toFixed(2)}° 를 넘습니다 (충격파 분리).`
    );
  }

  // Weak shock: smallest β > μ satisfying θ(β) = θ
  let lo = mu + 1e-5;
  let hi = Math.PI / 2 - 1e-5;
  let fLo = deflectionFromBeta(M1, lo, gamma) - thetaRad;
  let fHi = deflectionFromBeta(M1, hi, gamma) - thetaRad;

  if (fLo * fHi > 0) {
    throw new Error("Oblique shock solution not found for this M and deflection angle.");
  }

  for (let i = 0; i < 80; i++) {
    const mid = 0.5 * (lo + hi);
    const fMid = deflectionFromBeta(M1, mid, gamma) - thetaRad;
    if (Math.abs(fMid) < 1e-10) {
      lo = hi = mid;
      break;
    }
    if (fLo * fMid <= 0) {
      hi = mid;
      fHi = fMid;
    } else {
      lo = mid;
      fLo = fMid;
    }
  }

  const beta = 0.5 * (lo + hi);
  const delta = beta - thetaRad;
  if (delta <= 1e-8) {
    throw new Error("Shock angle too close to surface — detached shock.");
  }

  const Mn1 = M1 * Math.sin(beta);
  const { p2, T2, Mn2 } = postNormalShock(Mn1, p1, T1, gamma);
  const M2 = Mn2 / Math.sin(delta);

  return {
    M_e: M2,
    p_e: p2,
    T_e: T2,
    beta_rad: beta,
    beta_deg: beta / DEG,
    theta_deg,
    attached: true,
    note:
      "사각(날개) 충격파 근사 — 콘은 반각을 동일 θ 로 둔 1차 근사 (VT 압축성 계산기와 같은 Rankine–Hugoniot)",
  };
}

function maxDeflection(M1: number, gamma: number): number {
  let tMax = 0;
  const mu = Math.asin(1 / M1);
  const n = 200;
  for (let i = 0; i <= n; i++) {
    const beta = mu + (i / n) * (Math.PI / 2 - mu - 1e-4);
    const t = deflectionFromBeta(M1, beta, gamma);
    if (t > tMax) tMax = t;
  }
  return tMax;
}
