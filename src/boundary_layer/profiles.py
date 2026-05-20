"""Streamwise scaling, integral thicknesses, and profile assembly."""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from .blasius import BlasiusSolution, solve_blasius, wall_shear_parameter
from .compressible_profile import build_similarity_profiles
from .edge_conditions import EdgeConditions
from .geometry import GeometryConfig, effective_streamwise_distance


@dataclass(frozen=True)
class ProfileAtX:
    """Physical profiles at streamwise location x."""

    x: float
    x_eff: float
    Re_x: float
    delta_scale: float
    y: np.ndarray
    eta: np.ndarray
    u: np.ndarray
    u_over_Ue: np.ndarray
    T: np.ndarray
    T_over_Te: np.ndarray
    rho: np.ndarray
    rho_over_rhoe: np.ndarray
    mu: np.ndarray
    mu_over_mue: np.ndarray
    M: np.ndarray
    delta_99: float
    delta_star: float
    theta: float
    Cf: float


@dataclass(frozen=True)
class XSweepResult:
    x: np.ndarray
    x_eff: np.ndarray
    Re_x: np.ndarray
    delta_99: np.ndarray
    delta_star: np.ndarray
    theta: np.ndarray
    Cf: np.ndarray


def delta_scale_length(
    edge: EdgeConditions, x_eff: float, Re_x: float | None = None
) -> float:
    """Blasius length scale delta ~ sqrt(mu_e * x_eff / (rho_e * U_e))."""
    if Re_x is None:
        Re_x = edge.Re_unit * x_eff
    if Re_x <= 0:
        return 0.0
    return float(np.sqrt(edge.mu_e * x_eff / (edge.rho_e * edge.U_e)))


def reynolds_x(edge: EdgeConditions, x_eff: float) -> float:
    return float(edge.Re_unit * x_eff)


def skin_friction_coefficient(fpp0: float, Re_x: float) -> float:
    """
    Approximate local skin friction coefficient (incompressible Blasius form).

    Cf = 2 * f''(0) / sqrt(Re_x)
    For compressible flows this remains labeled approximate.
    """
    if Re_x <= 0:
        return np.nan
    return float(2.0 * fpp0 / np.sqrt(Re_x))


def _integrate_thicknesses(
    y: np.ndarray,
    u_over_Ue: np.ndarray,
    rho_over_rhoe: np.ndarray,
) -> tuple[float, float, float]:
    """delta_99, delta*, theta using trapezoidal integration."""
    u = u_over_Ue
    rho_ratio = rho_over_rhoe

    idx_99 = np.searchsorted(u, 0.99)
    if idx_99 >= len(y):
        delta_99 = float(y[-1])
    else:
        # linear interpolation for 0.99 crossing
        i0 = max(idx_99 - 1, 0)
        i1 = min(idx_99, len(y) - 1)
        if i1 == i0 or u[i1] == u[i0]:
            delta_99 = float(y[idx_99])
        else:
            frac = (0.99 - u[i0]) / (u[i1] - u[i0])
            delta_99 = float(y[i0] + frac * (y[i1] - y[i0]))

    integrand_star = rho_ratio * (1.0 - u)
    integrand_theta = rho_ratio * u * (1.0 - u)
    delta_star = float(np.trapezoid(integrand_star, y))
    theta = float(np.trapezoid(integrand_theta, y))
    return delta_99, delta_star, theta


def profile_at_x(
    edge: EdgeConditions,
    geometry: GeometryConfig,
    x: float,
    blasius: BlasiusSolution | None = None,
) -> ProfileAtX:
    """Build full physical profiles at streamwise station x."""
    if blasius is None:
        blasius = solve_blasius()

    sim = build_similarity_profiles(edge, blasius)
    x_eff = float(effective_streamwise_distance(x, geometry))
    Rex = reynolds_x(edge, x_eff)
    d_scale = delta_scale_length(edge, x_eff, Rex)

    eta = sim["eta"]
    y = eta * d_scale
    u_over_Ue = sim["u_over_Ue"]
    u = u_over_Ue * edge.U_e

    delta_99, delta_star, theta = _integrate_thicknesses(
        y, u_over_Ue, sim["rho_over_rhoe"]
    )
    fpp0 = float(sim["fpp0"][0])
    Cf = skin_friction_coefficient(fpp0, Rex)

    return ProfileAtX(
        x=x,
        x_eff=x_eff,
        Re_x=Rex,
        delta_scale=d_scale,
        y=y,
        eta=eta,
        u=u,
        u_over_Ue=u_over_Ue,
        T=sim["T"],
        T_over_Te=sim["T_over_Te"],
        rho=sim["rho"],
        rho_over_rhoe=sim["rho_over_rhoe"],
        mu=sim["mu"],
        mu_over_mue=sim["mu_over_mue"],
        M=sim["M"],
        delta_99=delta_99,
        delta_star=delta_star,
        theta=theta,
        Cf=Cf,
    )


def profile_to_dict(prof: ProfileAtX) -> dict[str, np.ndarray]:
    n = prof.y.size
    return {
        "x": np.full(n, prof.x),
        "y": prof.y,
        "eta": prof.eta,
        "u": prof.u,
        "u_over_Ue": prof.u_over_Ue,
        "T": prof.T,
        "T_over_Te": prof.T_over_Te,
        "rho": prof.rho,
        "rho_over_rhoe": prof.rho_over_rhoe,
        "mu": prof.mu,
        "mu_over_mue": prof.mu_over_mue,
        "Mach": prof.M,
    }


def x_sweep(
    edge: EdgeConditions,
    geometry: GeometryConfig,
    x_array: np.ndarray,
    blasius: BlasiusSolution | None = None,
) -> XSweepResult:
    """Compute integral quantities vs streamwise distance."""
    if blasius is None:
        blasius = solve_blasius()

    sim = build_similarity_profiles(edge, blasius)
    fpp0 = float(sim["fpp0"][0])

    x_arr = np.asarray(x_array, dtype=float)
    x_eff = effective_streamwise_distance(x_arr, geometry)
    Re_x = edge.Re_unit * x_eff
    d_scale = np.sqrt(edge.mu_e * x_eff / (edge.rho_e * edge.U_e))

    eta = sim["eta"]
    u_over_Ue = sim["u_over_Ue"]
    rho_ratio = sim["rho_over_rhoe"]

    n_x = x_arr.size
    delta_99 = np.zeros(n_x)
    delta_star = np.zeros(n_x)
    theta = np.zeros(n_x)
    Cf = np.zeros(n_x)

    for i in range(n_x):
        y = eta * d_scale[i]
        d99, ds, th = _integrate_thicknesses(y, u_over_Ue, rho_ratio)
        delta_99[i] = d99
        delta_star[i] = ds
        theta[i] = th
        Cf[i] = skin_friction_coefficient(fpp0, Re_x[i])

    return XSweepResult(
        x=x_arr,
        x_eff=x_eff,
        Re_x=Re_x,
        delta_99=delta_99,
        delta_star=delta_star,
        theta=theta,
        Cf=Cf,
    )


def x_sweep_to_dict(sweep: XSweepResult) -> dict[str, np.ndarray]:
    return {
        "x": sweep.x,
        "x_eff": sweep.x_eff,
        "Re_x": sweep.Re_x,
        "delta_99": sweep.delta_99,
        "delta_star": sweep.delta_star,
        "theta": sweep.theta,
        "Cf": sweep.Cf,
    }
