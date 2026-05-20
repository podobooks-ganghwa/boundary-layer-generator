#!/usr/bin/env python3
"""Streamlit UI for the boundary-layer generator."""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd
import streamlit as st

_SRC = Path(__file__).resolve().parent
if str(_SRC) not in sys.path:
    sys.path.insert(0, str(_SRC))

from boundary_layer.blasius import solve_blasius
from boundary_layer.compressible_profile import MODEL_LABEL
from boundary_layer.edge_conditions import from_mode_a, from_mode_b
from boundary_layer.geometry import MANGLER_NOTE, GeometryConfig
from boundary_layer.plotting import (
    plot_cf_vs_x,
    plot_delta_99_vs_x,
    plot_delta_star_vs_x,
    plot_density_profile,
    plot_field_contour,
    plot_geometry_envelope,
    plot_mach_profile,
    plot_temperature_profile,
    plot_theta_vs_x,
    plot_velocity_profile,
)
from boundary_layer.profiles import profile_at_x, profile_to_dict, x_sweep, x_sweep_to_dict

PROFILE_COLUMNS = [
    "x", "y", "eta", "u", "u_over_Ue", "T", "T_over_Te",
    "rho", "rho_over_rhoe", "mu", "mu_over_mue", "Mach",
]
SWEEP_COLUMNS = ["x", "x_eff", "Re_x", "delta_99", "delta_star", "theta", "Cf"]

st.set_page_config(
    page_title="Boundary Layer Generator",
    page_icon="🌬️",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ---------------------------------------------------------------------------
# Header
# ---------------------------------------------------------------------------
st.title("Boundary Layer Generator")
st.caption(
    "Fast similarity-profile baseflow generator for flat plates, wedges, and cones."
)
st.warning(
    "Approximate compressible Blasius-like model. "
    "Not a full coupled compressible similarity solution."
)

# ---------------------------------------------------------------------------
# Sidebar
# ---------------------------------------------------------------------------
with st.sidebar:
    st.header("Flow input mode")
    input_mode = st.radio(
        "Mode",
        ["Mode A — M, T₀, Re_unit", "Mode B — U, p, T"],
        label_visibility="collapsed",
    )

    st.header("Edge flow condition")
    if input_mode.startswith("Mode A"):
        M_e = st.number_input("Edge Mach M_e", value=5.9, min_value=0.01)
        T0 = st.number_input("Total temperature T₀ [K]", value=1500.0, min_value=1.0)
        Re_unit = st.number_input("Unit Reynolds Re_unit [1/m]", value=9.9e6, format="%e")
        p_optional = st.checkbox("Specify edge pressure p_e")
        p_e = (
            st.number_input("p_e [Pa]", value=4670.0, disabled=not p_optional)
            if p_optional
            else None
        )
    else:
        U_e = st.number_input("Edge velocity U_e [m/s]", value=1698.0)
        p_e = st.number_input("Edge pressure p_e [Pa]", value=4670.0)
        T_e = st.number_input("Edge temperature T_e [K]", value=206.0)

    st.header("Geometry")
    geom_label = st.selectbox(
        "Type",
        ["2D flat plate", "2D wedge", "Axisymmetric cone"],
        label_visibility="collapsed",
    )
    geom_map = {
        "2D flat plate": "flat_plate",
        "2D wedge": "wedge",
        "Axisymmetric cone": "cone",
    }
    geom_kind = geom_map[geom_label]
    cone_angle = 7.0
    if geom_kind in ("wedge", "cone"):
        cone_angle = st.number_input(
            "Half-angle [deg]",
            value=7.0,
            min_value=0.1,
            max_value=45.0,
        )

    st.header("Wall condition")
    T_w = st.number_input("Wall temperature T_w [K]", value=300.0, min_value=1.0)

    st.header("x location / x range")
    x_sel = st.number_input("Selected x [m]", value=0.3, min_value=1e-6, format="%.4f")
    x_min = st.number_input("x sweep min [m]", value=0.05, min_value=1e-6)
    x_max = st.number_input("x sweep max [m]", value=0.5, min_value=1e-6)
    n_x = st.slider("Sweep points", 5, 120, 40)

    st.header("Advanced numerical settings")
    eta_max = st.number_input("η_max", value=8.0, min_value=4.0, max_value=20.0)
    n_eta = st.slider("η points", 100, 800, 400, step=50)

    st.header("Display")
    y_scale = st.radio("Profile y-axis", ["linear", "log"], horizontal=True)
    show_contours = st.checkbox("Show x–y contour maps (similarity-scaled)", value=True)

# ---------------------------------------------------------------------------
# Compute
# ---------------------------------------------------------------------------
geometry = GeometryConfig(kind=geom_kind, cone_half_angle_deg=cone_angle)

try:
    if input_mode.startswith("Mode A"):
        edge = from_mode_a(
            M_e=M_e,
            T0=T0,
            Re_unit=Re_unit,
            T_w=T_w,
            p_e=p_e if p_optional else None,
        )
    else:
        edge = from_mode_b(U_e=U_e, p_e=p_e, T_e=T_e, T_w=T_w)

    x_arr = np.linspace(x_min, x_max, n_x)
    blasius = solve_blasius(eta_max=eta_max, n_points=n_eta)
    prof = profile_at_x(edge, geometry, x_sel, blasius=blasius)
    sweep = x_sweep(edge, geometry, x_arr, blasius=blasius)
except Exception as exc:
    st.error(f"Computation failed: {exc}")
    st.stop()

plot_kw = dict(geometry=geometry, x_sel=x_sel)
y_scale_t = y_scale  # type: ignore[arg-type]

# ---------------------------------------------------------------------------
# A. Edge condition summary
# ---------------------------------------------------------------------------
st.subheader("A. Edge condition summary")
edge_df = pd.DataFrame([edge.as_dict()]).T
edge_df.columns = ["Value"]
edge_df.index.name = "Quantity"
st.dataframe(edge_df, use_container_width=True)

m1, m2, m3, m4 = st.columns(4)
m1.metric("δ₉₉ @ x", f"{prof.delta_99 * 1e3:.3f} mm")
m2.metric("Re_x", f"{prof.Re_x:.3e}")
m3.metric("C_f (approx.)", f"{prof.Cf:.4e}")
m4.metric("x_eff", f"{prof.x_eff:.4f} m")

if geometry.kind == "cone":
    st.info(MANGLER_NOTE)

# ---------------------------------------------------------------------------
# B. Geometry + envelope
# ---------------------------------------------------------------------------
st.subheader("B. Geometry & boundary-layer envelope")
fig_g = plot_geometry_envelope(geometry, sweep, edge, path=None, x_sel=x_sel)
st.pyplot(fig_g, use_container_width=True)

# ---------------------------------------------------------------------------
# C. Profile plots at selected x
# ---------------------------------------------------------------------------
st.subheader(f"C. Profiles at x = {x_sel} m")
r1c1, r1c2 = st.columns(2)
r2c1, r2c2 = st.columns(2)
with r1c1:
    st.pyplot(plot_velocity_profile(prof, geometry, y_scale=y_scale_t), use_container_width=True)
with r1c2:
    st.pyplot(plot_temperature_profile(prof, geometry, y_scale=y_scale_t), use_container_width=True)
with r2c1:
    st.pyplot(plot_density_profile(prof, geometry, y_scale=y_scale_t), use_container_width=True)
with r2c2:
    st.pyplot(plot_mach_profile(prof, geometry, y_scale=y_scale_t), use_container_width=True)

# ---------------------------------------------------------------------------
# D. x-sweep plots
# ---------------------------------------------------------------------------
st.subheader("D. Streamwise evolution")
s1, s2 = st.columns(2)
s3, s4 = st.columns(2)
with s1:
    st.pyplot(plot_delta_99_vs_x(sweep, geometry, **plot_kw), use_container_width=True)
with s2:
    st.pyplot(plot_delta_star_vs_x(sweep, geometry, **plot_kw), use_container_width=True)
with s3:
    st.pyplot(plot_theta_vs_x(sweep, geometry, **plot_kw), use_container_width=True)
with s4:
    st.pyplot(plot_cf_vs_x(sweep, geometry, **plot_kw), use_container_width=True)

if show_contours:
    st.markdown("**Approximate x–y fields** (similarity shape, scaled δ(x))")
    c1, c2, c3 = st.columns(3)
    with c1:
        st.pyplot(
            plot_field_contour(edge, geometry, x_arr, "u_over_Ue", blasius, x_sel=x_sel),
            use_container_width=True,
        )
    with c2:
        st.pyplot(
            plot_field_contour(edge, geometry, x_arr, "T_over_Te", blasius, x_sel=x_sel),
            use_container_width=True,
        )
    with c3:
        st.pyplot(
            plot_field_contour(edge, geometry, x_arr, "M", blasius, x_sel=x_sel),
            use_container_width=True,
        )

# ---------------------------------------------------------------------------
# E. CSV export
# ---------------------------------------------------------------------------
st.subheader("E. CSV export")
prof_df = pd.DataFrame(profile_to_dict(prof))[PROFILE_COLUMNS]
sweep_df = pd.DataFrame(x_sweep_to_dict(sweep))[SWEEP_COLUMNS]

dl1, dl2 = st.columns(2)
with dl1:
    st.download_button(
        "Download selected profile CSV",
        prof_df.to_csv(index=False).encode(),
        file_name=f"profile_x{x_sel:.3f}.csv",
        mime="text/csv",
        use_container_width=True,
    )
with dl2:
    st.download_button(
        "Download x-sweep CSV",
        sweep_df.to_csv(index=False).encode(),
        file_name="x_sweep.csv",
        mime="text/csv",
        use_container_width=True,
    )

# ---------------------------------------------------------------------------
# F. Assumptions / limitations
# ---------------------------------------------------------------------------
st.subheader("F. Assumptions & limitations")
st.markdown(
    f"""
- **Model:** {MODEL_LABEL}
- **Velocity:** incompressible Blasius \(f''' + \\tfrac{{1}}{{2}} f f'' = 0\) via shooting; \(u/U_e = f'(\\eta)\).
- **Temperature:** Crocco-like algebraic relation with \(r = \\sqrt{{\\mathrm{{Pr}}}}\); not a coupled compressible ODE.
- **Geometry:** flat plate and wedge use \(x_\\mathrm{{eff}} = x\); cone uses Mangler-style \(x_\\mathrm{{eff}} = x/3\) (first-order).
- **Wedge:** constant edge conditions, local flat-plate patch.
- **Skin friction:** \(C_f \\approx 2 f''(0)/\\sqrt{{\\mathrm{{Re}}_x}}\) — labeled approximate for compressible flow.
- **Contours:** similarity-structured strip; not a full CFD or LST baseflow.
- **Out of scope:** LST stability, CFD, AI/ML, full compressible similarity solve.
"""
)
