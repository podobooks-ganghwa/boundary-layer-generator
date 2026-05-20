"""
Compressible Blasius-like boundary-layer approximation.

NOT a full coupled compressible similarity solution.
Uses incompressible Blasius f'(eta) for u/Ue and a Crocco-like temperature relation.
"""

from __future__ import annotations

import numpy as np

from .blasius import BlasiusSolution, solve_blasius
from .constants import GAMMA, PR, R_GAS
from .edge_conditions import EdgeConditions
from . import gas

MODEL_LABEL = (
    "Compressible Blasius-like approximation, not full coupled "
    "compressible similarity solution."
)


def recovery_factor() -> float:
    """Aerodynamic heating recovery factor r = sqrt(Pr)."""
    return float(np.sqrt(PR))


def adiabatic_wall_temperature(T_e: float, M_e: float) -> float:
    """Adiabatic wall temperature T_aw."""
    r = recovery_factor()
    return T_e * (1.0 + r * (GAMMA - 1.0) / 2.0 * M_e**2)


def temperature_profile(
    u_over_Ue: np.ndarray,
    T_e: float,
    T_w: float,
    M_e: float,
) -> np.ndarray:
    """
    T(eta) = T_w + (T_aw - T_w)*(u/Ue) + (T_e - T_aw)*(u/Ue)^2
    """
    T_aw = adiabatic_wall_temperature(T_e, M_e)
    u = np.asarray(u_over_Ue, dtype=float)
    return T_w + (T_aw - T_w) * u + (T_e - T_aw) * u**2


def build_similarity_profiles(
    edge: EdgeConditions,
    blasius: BlasiusSolution | None = None,
) -> dict[str, np.ndarray]:
    """
    Similarity-coordinate profiles (eta) before streamwise scaling.

    Returns eta, u/Ue, T, T/Te, rho, rho/rhoe, mu, mu/mue, M.
    """
    if blasius is None:
        blasius = solve_blasius()

    eta = blasius.eta
    u_over_Ue = blasius.fp
    T = temperature_profile(u_over_Ue, edge.T_e, edge.T_w, edge.M_e)
    rho = gas.density_from_ideal_gas(edge.p_e, T)
    mu = gas.sutherland_viscosity(T)
    u = u_over_Ue * edge.U_e
    M = u / gas.speed_of_sound(T)

    return {
        "eta": eta,
        "u_over_Ue": u_over_Ue,
        "T": T,
        "T_over_Te": T / edge.T_e,
        "rho": rho,
        "rho_over_rhoe": rho / edge.rho_e,
        "mu": mu,
        "mu_over_mue": mu / edge.mu_e,
        "M": M,
        "fpp0": np.array([blasius.fpp[0]]),
        "model_label": np.array([MODEL_LABEL]),
    }
