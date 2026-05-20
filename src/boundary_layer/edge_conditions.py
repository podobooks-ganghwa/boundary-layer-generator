"""Edge flow condition specification and conversion between input modes."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

import numpy as np

from . import gas
from .constants import GAMMA, R_GAS

InputMode = Literal["mode_a", "mode_b"]


@dataclass(frozen=True)
class EdgeConditions:
    """Uniform edge (freestream) conditions at a streamwise station."""

    M_e: float
    U_e: float
    T_e: float
    p_e: float
    rho_e: float
    mu_e: float
    a_e: float
    Re_unit: float
    T_w: float
    h0: float | None = None
    input_mode: str = ""

    def as_dict(self) -> dict[str, float]:
        return {
            "M_e": self.M_e,
            "U_e": self.U_e,
            "T_e": self.T_e,
            "p_e": self.p_e,
            "rho_e": self.rho_e,
            "mu_e": self.mu_e,
            "a_e": self.a_e,
            "Re_unit": self.Re_unit,
            "T_w": self.T_w,
        }


def _re_unit(rho_e: float, U_e: float, mu_e: float) -> float:
    return rho_e * U_e / mu_e


def from_mode_a(
    M_e: float,
    T_w: float,
    *,
    T0: float | None = None,
    h0: float | None = None,
    Re_unit: float,
    p_e: float | None = None,
    cp: float = 1004.5,
) -> EdgeConditions:
    """
    Mode A: M_e, total enthalpy or T0, Re_unit, T_w, optional p_e.

    If p_e is not given, use rho_e = Re_unit * mu_e / U_e with T_e from total state.
    """
    if (T0 is None) == (h0 is None):
        raise ValueError("Specify exactly one of T0 or h0.")

    if h0 is not None:
        # h0 = cp*T0 for a calorically perfect gas
        T0_val = h0 / cp
    else:
        T0_val = float(T0)

    T_e = gas.temperature_from_total(T0_val, M_e)
    U_e = gas.velocity_from_mach(M_e, T_e)
    mu_e = float(gas.sutherland_viscosity(T_e))

    if p_e is not None:
        rho_e = gas.density_from_ideal_gas(p_e, T_e)
        Re_unit_check = _re_unit(rho_e, U_e, mu_e)
        if not np.isclose(Re_unit_check, Re_unit, rtol=0.05):
            # Prefer user Re_unit for consistency with LST workflows
            rho_e = Re_unit * mu_e / U_e
    else:
        rho_e = Re_unit * mu_e / U_e
        p_e = rho_e * R_GAS * T_e

    a_e = float(gas.speed_of_sound(T_e))
    return EdgeConditions(
        M_e=M_e,
        U_e=U_e,
        T_e=T_e,
        p_e=float(p_e),
        rho_e=float(rho_e),
        mu_e=mu_e,
        a_e=a_e,
        Re_unit=_re_unit(rho_e, U_e, mu_e),
        T_w=T_w,
        h0=cp * T0_val,
        input_mode="mode_a",
    )


def from_mode_b(
    U_e: float,
    p_e: float,
    T_e: float,
    T_w: float,
) -> EdgeConditions:
    """Mode B: U_e, p_e, T_e, T_w."""
    rho_e = float(gas.density_from_ideal_gas(p_e, T_e))
    mu_e = float(gas.sutherland_viscosity(T_e))
    a_e = float(gas.speed_of_sound(T_e))
    M_e = float(U_e / a_e)
    Re_unit = _re_unit(rho_e, U_e, mu_e)
    return EdgeConditions(
        M_e=M_e,
        U_e=U_e,
        T_e=T_e,
        p_e=p_e,
        rho_e=rho_e,
        mu_e=mu_e,
        a_e=a_e,
        Re_unit=Re_unit,
        T_w=T_w,
        input_mode="mode_b",
    )
