#!/usr/bin/env python3
"""Example: hypersonic cone boundary layer (Mode B edge conditions)."""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd

# Allow imports when run as: python src/run_examples.py
_SRC = Path(__file__).resolve().parent
if str(_SRC) not in sys.path:
    sys.path.insert(0, str(_SRC))

from boundary_layer.compressible_profile import MODEL_LABEL
from boundary_layer.edge_conditions import from_mode_b
from boundary_layer.geometry import GeometryConfig
from boundary_layer.plotting import plot_all_example
from boundary_layer.profiles import profile_at_x, profile_to_dict, x_sweep, x_sweep_to_dict


def main() -> None:
    project_root = _SRC.parent
    out_dir = project_root / "outputs" / "example_cone"
    out_dir.mkdir(parents=True, exist_ok=True)

    edge = from_mode_b(
        U_e=1698.0,
        p_e=4670.0,
        T_e=206.0,
        T_w=300.0,
    )

    geometry = GeometryConfig(kind="cone", cone_half_angle_deg=7.0)
    x_sel = 0.3
    x_arr = np.linspace(0.05, 0.5, 30)

    prof = profile_at_x(edge, geometry, x_sel)
    sweep = x_sweep(edge, geometry, x_arr)

    print("=== Boundary Layer Generator — Example ===")
    print(f"Model: {MODEL_LABEL}")
    if geometry.mangler_note:
        print(f"Geometry note: {geometry.mangler_note}")
    print("\nEdge conditions:")
    for k, v in edge.as_dict().items():
        print(f"  {k:10s} = {v:.6g}")
    print(f"\nAt x = {x_sel} m (x_eff = {prof.x_eff:.4g} m):")
    print(f"  Re_x     = {prof.Re_x:.4g}")
    print(f"  delta_99 = {prof.delta_99*1e3:.3f} mm")
    print(f"  delta*   = {prof.delta_star*1e3:.3f} mm")
    print(f"  theta    = {prof.theta*1e6:.3f} µm")
    print(f"  Cf       = {prof.Cf:.4g} (approx.)")

    profile_cols = [
        "x", "y", "eta", "u", "u_over_Ue", "T", "T_over_Te",
        "rho", "rho_over_rhoe", "mu", "mu_over_mue", "Mach",
    ]
    sweep_cols = ["x", "x_eff", "Re_x", "delta_99", "delta_star", "theta", "Cf"]
    pd.DataFrame(profile_to_dict(prof))[profile_cols].to_csv(
        out_dir / "profile_x0.3.csv", index=False
    )
    pd.DataFrame(x_sweep_to_dict(sweep))[sweep_cols].to_csv(
        out_dir / "x_sweep.csv", index=False
    )

    paths = plot_all_example(prof, sweep, geometry, edge, out_dir)
    print(f"\nSaved outputs to: {out_dir}")
    for p in paths:
        print(f"  {p.name}")


if __name__ == "__main__":
    main()
