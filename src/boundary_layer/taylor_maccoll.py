"""
Taylor–Maccoll conical shock solver (axisymmetric cone, calorically perfect gas).

Freestream (M_inf, p_inf, T_inf) + cone half-angle theta_c -> shock angle beta,
cone-surface edge Mach and thermodynamic state.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np

from .constants import GAMMA, R_GAS


@dataclass(frozen=True)
class TaylorMaccollResult:
    beta_deg: float
    delta_deg: float
    M2: float
    M_e: float
    p2_over_p_inf: float
    T2_over_T_inf: float
    rho2_over_rho_inf: float
    p_e_over_p_inf: float
    T_e_over_T_inf: float
    rho_e_over_rho_inf: float
    U_e: float
    p_e: float
    T_e: float
    rho_e: float
    Vtheta_at_cone: float
    attached: bool
    note: str


def _vbar_from_mach(M: float, gamma: float) -> float:
    return math.sqrt(M * M / (M * M + 2.0 / (gamma - 1.0)))


def _shock_jump(M_inf: float, beta: float, gamma: float) -> tuple[float, float, float, float, float, float]:
    """Oblique shock jump for trial shock angle beta [rad]."""
    sb = math.sin(beta)
    Mn1 = M_inf * sb
    gp1 = gamma + 1.0
    gm1 = gamma - 1.0
    p2_p1 = 1.0 + (2.0 * gamma / gp1) * (Mn1 * Mn1 - 1.0)
    rho2_rho1 = (gp1 * Mn1 * Mn1) / (gm1 * Mn1 * Mn1 + 2.0)
    T2_T1 = p2_p1 / rho2_rho1
    tan_delta = (
        2.0
        / math.tan(beta)
        * (M_inf * M_inf * sb * sb - 1.0)
        / (M_inf * M_inf * (gamma + math.cos(2.0 * beta)) + 2.0)
    )
    delta = math.atan(tan_delta)
    Mn2_sq = (1.0 + 0.5 * gm1 * Mn1 * Mn1) / (gamma * Mn1 * Mn1 - 0.5 * gm1)
    if Mn2_sq <= 0.0:
        raise ValueError("Invalid Mn2^2 behind shock.")
    Mn2 = math.sqrt(Mn2_sq)
    sin_delta = math.sin(beta - delta)
    if sin_delta <= 1e-12:
        raise ValueError("Shock angle too close to surface.")
    M2 = Mn2 / sin_delta
    return M2, delta, p2_p1, rho2_rho1, T2_T1


def _tm_rhs(theta: float, vr: float, vt: float, gamma: float) -> tuple[float, float] | None:
    gm1 = 0.5 * (gamma - 1.0)
    one_minus = 1.0 - vr * vr - vt * vt
    den = gm1 * one_minus - vt * vt
    if abs(den) < 1e-14:
        return None
    num = vt * vt * vr - gm1 * one_minus * (2.0 * vr + vt / math.tan(theta))
    return vt, num / den


def _rk4_step(theta: float, vr: float, vt: float, h: float, gamma: float) -> tuple[float, float, float] | None:
    k1 = _tm_rhs(theta, vr, vt, gamma)
    if k1 is None:
        return None
    k2 = _tm_rhs(theta + 0.5 * h, vr + 0.5 * h * k1[0], vt + 0.5 * h * k1[1], gamma)
    if k2 is None:
        return None
    k3 = _tm_rhs(theta + 0.5 * h, vr + 0.5 * h * k2[0], vt + 0.5 * h * k2[1], gamma)
    if k3 is None:
        return None
    k4 = _tm_rhs(theta + h, vr + h * k3[0], vt + h * k3[1], gamma)
    if k4 is None:
        return None
    vr_new = vr + (h / 6.0) * (k1[0] + 2.0 * k2[0] + 2.0 * k3[0] + k4[0])
    vt_new = vt + (h / 6.0) * (k1[1] + 2.0 * k2[1] + 2.0 * k3[1] + k4[1])
    return theta + h, vr_new, vt_new


def _integrate_to_cone(
    beta: float,
    theta_c: float,
    M_inf: float,
    gamma: float,
    *,
    n_steps: int | None = None,
) -> tuple[float, float, float]:
    """Integrate Taylor–Maccoll from theta=beta down to theta=theta_c. Returns (Vr, Vt, M2)."""
    M2, delta, _, _, _ = _shock_jump(M_inf, beta, gamma)
    q2 = _vbar_from_mach(M2, gamma)
    vr = q2 * math.cos(beta - delta)
    vt = -q2 * math.sin(beta - delta)
    if theta_c >= beta - 1e-10:
        raise ValueError("Cone half-angle must be less than shock angle.")

    n = n_steps or max(400, int((beta - theta_c) / 2e-4))
    h = (theta_c - beta) / n  # negative step
    theta = beta
    for _ in range(n):
        step = _rk4_step(theta, vr, vt, h, gamma)
        if step is None:
            raise ValueError("Taylor–Maccoll integration failed (singular ODE).")
        theta, vr, vt = step
        if vr * vr + vt * vt >= 1.0 - 1e-8:
            raise ValueError("Normalized velocity exceeded sonic limit.")
    return vr, vt, M2


def _vt_at_cone(beta: float, theta_c: float, M_inf: float, gamma: float) -> float:
    try:
        _, vt, _ = _integrate_to_cone(beta, theta_c, M_inf, gamma)
        return vt
    except (ValueError, ZeroDivisionError):
        return float("nan")


def _mach_from_vbar(q: float, gamma: float) -> float:
    if q >= 1.0 - 1e-12:
        raise ValueError("q >= 1 in Mach recovery.")
    return math.sqrt((2.0 / (gamma - 1.0)) * q * q / (1.0 - q * q))


def solve_taylor_maccoll(
    M_inf: float,
    p_inf: float,
    T_inf: float,
    theta_c_deg: float,
    *,
    gamma: float = GAMMA,
    R: float = R_GAS,
) -> TaylorMaccollResult:
    """
    Solve for attached conical shock and cone-surface edge conditions.

    theta_c_deg: cone half-angle [deg].
    """
    if M_inf <= 1.0:
        raise ValueError("M_inf must be > 1 for Taylor–Maccoll conical shock.")

    theta_c = math.radians(theta_c_deg)
    mu = math.asin(1.0 / M_inf)
    beta_lo = mu + 1e-4
    beta_hi = 0.5 * math.pi - 1e-4

    def f(b: float) -> float:
        return _vt_at_cone(b, theta_c, M_inf, gamma)

    f_lo = f(beta_lo)
    f_hi = f(beta_hi)

    if not (math.isfinite(f_lo) and math.isfinite(f_hi)) or f_lo * f_hi > 0:
        bracket = None
        scan = np.linspace(beta_lo, beta_hi, 80)
        prev_b, prev_f = None, None
        for b in scan:
            fb = f(float(b))
            if not math.isfinite(fb):
                continue
            if prev_b is not None and prev_f * fb <= 0:
                bracket = (prev_b, float(b))
                break
            prev_b, prev_f = float(b), fb
        if bracket is None:
            raise ValueError(
                "No attached Taylor–Maccoll solution (detached or integration failed)."
            )
        beta_lo, beta_hi = bracket
        f_lo = f(beta_lo)
        f_hi = f(beta_hi)

    for _ in range(70):
        mid = 0.5 * (beta_lo + beta_hi)
        f_mid = f(mid)
        if not math.isfinite(f_mid):
            beta_hi = mid
            continue
        if abs(f_mid) < 1e-9:
            beta_lo = beta_hi = mid
            break
        if f_lo * f_mid <= 0:
            beta_hi = mid
            f_hi = f_mid
        else:
            beta_lo = mid
            f_lo = f_mid

    beta = 0.5 * (beta_lo + beta_hi)
    M2, delta, p2_p1, rho2_rho1, T2_T1 = _shock_jump(M_inf, beta, gamma)
    vr, vt, _ = _integrate_to_cone(beta, theta_c, M_inf, gamma, n_steps=600)
    q_e = math.sqrt(vr * vr + vt * vt)
    M_e = _mach_from_vbar(q_e, gamma)

    T0 = T_inf * (1.0 + 0.5 * (gamma - 1.0) * M_inf * M_inf)
    p2 = p_inf * p2_p1
    p02 = p2 * (1.0 + 0.5 * (gamma - 1.0) * M2 * M2) ** (gamma / (gamma - 1.0))
    T_e = T0 / (1.0 + 0.5 * (gamma - 1.0) * M_e * M_e)
    p_e = p02 / (1.0 + 0.5 * (gamma - 1.0) * M_e * M_e) ** (gamma / (gamma - 1.0))
    rho_inf = p_inf / (R * T_inf)
    rho_e = p_e / (R * T_e)
    U_e = M_e * math.sqrt(gamma * R * T_e)

    return TaylorMaccollResult(
        beta_deg=math.degrees(beta),
        delta_deg=math.degrees(delta),
        M2=M2,
        M_e=M_e,
        p2_over_p_inf=p2_p1,
        T2_over_T_inf=T2_T1,
        rho2_over_rho_inf=rho2_rho1,
        p_e_over_p_inf=p_e / p_inf,
        T_e_over_T_inf=T_e / T_inf,
        rho_e_over_rho_inf=rho_e / rho_inf,
        U_e=U_e,
        p_e=p_e,
        T_e=T_e,
        rho_e=rho_e,
        Vtheta_at_cone=vt,
        attached=True,
        note="Taylor–Maccoll axisymmetric conical shock (attached)",
    )


if __name__ == "__main__":
    r = solve_taylor_maccoll(M_inf=6.0, p_inf=4670.0, T_inf=206.0, theta_c_deg=7.0)
    print("beta [deg] =", r.beta_deg)
    print("M_e =", r.M_e)
    print("p_e/p_inf =", r.p_e_over_p_inf)
    print("T_e/T_inf =", r.T_e_over_T_inf)
    print("Vtheta(theta_c) =", r.Vtheta_at_cone)
