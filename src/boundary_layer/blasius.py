"""Incompressible Blasius similarity solution: f''' + 0.5 f f'' = 0."""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from scipy.integrate import solve_ivp
from scipy.optimize import brentq

# Module-level cache keyed by (eta_max, n_points)
_CACHE: dict[tuple[float, int], "BlasiusSolution"] = {}

# Classical wall shear: f''(0) ≈ 0.332057
FPP0_BRACKET = (0.31, 0.35)


@dataclass(frozen=True)
class BlasiusSolution:
    eta: np.ndarray
    f: np.ndarray
    fp: np.ndarray  # f' = u/Ue
    fpp: np.ndarray  # f''


def _integrate_blasius(fpp0: float, eta_max: float) -> tuple[np.ndarray, np.ndarray]:
    """Integrate Blasius ODE from wall; return eta, state (3, n)."""

    def ode(eta: float, y: np.ndarray) -> np.ndarray:
        f, fp, fpp = y
        return np.array([fp, fpp, -0.5 * f * fpp])

    sol = solve_ivp(
        ode,
        (0.0, eta_max),
        np.array([0.0, 0.0, fpp0]),
        method="DOP853",
        rtol=1e-10,
        atol=1e-12,
        max_step=eta_max / 2000.0,
    )
    if not sol.success:
        raise RuntimeError(f"Blasius IVP integration failed: {sol.message}")
    return sol.t, sol.y


def _shooting_residual(fpp0: float, eta_max: float) -> float:
    eta, y = _integrate_blasius(fpp0, eta_max)
    return float(y[1, -1] - 1.0)  # f'(eta_max) - 1


def _solve_shooting(eta_max: float, n_points: int) -> BlasiusSolution:
    fpp0 = brentq(_shooting_residual, *FPP0_BRACKET, args=(eta_max,))
    eta_fine, y = _integrate_blasius(fpp0, eta_max)
    eta = np.linspace(0.0, eta_max, n_points)

    f = np.interp(eta, eta_fine, y[0])
    fp = np.interp(eta, eta_fine, y[1])
    fpp = np.interp(eta, eta_fine, y[2])
    return BlasiusSolution(eta=eta, f=f, fp=fp, fpp=fpp)


def solve_blasius(eta_max: float = 8.0, n_points: int = 400) -> BlasiusSolution:
    """
    Solve the Blasius equation with caching (shooting on f''(0)).

    Boundary conditions: f(0)=0, f'(0)=0, f'(eta_max)=1.
    """
    key = (float(eta_max), int(n_points))
    if key not in _CACHE:
        _CACHE[key] = _solve_shooting(eta_max, n_points)
    return _CACHE[key]


def wall_shear_parameter(solution: BlasiusSolution | None = None) -> float:
    """f''(0) from the Blasius solution."""
    if solution is None:
        solution = solve_blasius()
    return float(solution.fpp[0])


def clear_cache() -> None:
    """Clear cached Blasius solutions (mainly for testing)."""
    _CACHE.clear()
