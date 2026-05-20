"""Thermodynamic and transport properties for air."""

from __future__ import annotations

import numpy as np

from .constants import GAMMA, R_GAS

# Sutherland law for air (SI)
MU_REF = 1.716e-5  # Pa·s at T_REF
T_REF = 273.15  # K
S_SUTH = 110.4  # K


def sutherland_viscosity(T: float | np.ndarray) -> float | np.ndarray:
    """Dynamic viscosity [Pa·s] via Sutherland's law."""
    T = np.asarray(T, dtype=float)
    return MU_REF * (T / T_REF) ** 1.5 * (T_REF + S_SUTH) / (T + S_SUTH)


def speed_of_sound(T: float | np.ndarray) -> float | np.ndarray:
    """Speed of sound [m/s]."""
    return np.sqrt(GAMMA * R_GAS * np.asarray(T, dtype=float))


def density_from_ideal_gas(p: float, T: float | np.ndarray) -> float | np.ndarray:
    """Density [kg/m³] from ideal gas law."""
    return p / (R_GAS * np.asarray(T, dtype=float))


def mach_number(U: float, T: float) -> float:
    """Mach number from velocity and static temperature."""
    return float(U / speed_of_sound(T))


def velocity_from_mach(M: float, T: float) -> float:
    """Velocity [m/s] from Mach and static temperature."""
    return float(M * speed_of_sound(T))


def temperature_from_total(T0: float, M: float) -> float:
    """Static temperature from total temperature and Mach (isentropic)."""
    return T0 / (1.0 + 0.5 * (GAMMA - 1.0) * M**2)


def total_temperature_from_static(T: float, M: float) -> float:
    """Total temperature from static temperature and Mach."""
    return T * (1.0 + 0.5 * (GAMMA - 1.0) * M**2)


def pressure_from_mach_static(p0: float, M: float, T: float, T0: float) -> float:
    """Static pressure from total pressure, Mach, and temperatures."""
    return p0 * (T / T0) ** (GAMMA / (GAMMA - 1.0))
