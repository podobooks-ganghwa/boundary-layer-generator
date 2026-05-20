"""
Fast boundary-layer baseflow generator for 2D and axisymmetric geometries.

Approximate compressible Blasius-like profiles — not full LST or coupled
compressible similarity solvers.
"""

from .blasius import BlasiusSolution, solve_blasius, wall_shear_parameter
from .compressible_profile import MODEL_LABEL, build_similarity_profiles
from .edge_conditions import EdgeConditions, from_mode_a, from_mode_b
from .geometry import GeometryConfig, MANGLER_NOTE
from .profiles import ProfileAtX, XSweepResult, profile_at_x, x_sweep

__all__ = [
    "BlasiusSolution",
    "EdgeConditions",
    "GeometryConfig",
    "MANGLER_NOTE",
    "MODEL_LABEL",
    "ProfileAtX",
    "XSweepResult",
    "build_similarity_profiles",
    "from_mode_a",
    "from_mode_b",
    "profile_at_x",
    "solve_blasius",
    "wall_shear_parameter",
    "x_sweep",
]
