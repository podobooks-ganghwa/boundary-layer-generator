"""Matplotlib plotting utilities for boundary-layer profiles and sweeps."""

from __future__ import annotations

from pathlib import Path
from typing import Literal

import matplotlib.pyplot as plt
import numpy as np
from matplotlib import ticker
from matplotlib.figure import Figure

from .blasius import BlasiusSolution, solve_blasius
from .compressible_profile import build_similarity_profiles
from .edge_conditions import EdgeConditions
from .geometry import GeometryConfig, effective_streamwise_distance
from .profiles import ProfileAtX, XSweepResult

YScale = Literal["linear", "log"]
FieldName = Literal["u_over_Ue", "T_over_Te", "M"]

# Consistent style for UI and saved figures
plt.rcParams.update(
    {
        "font.size": 10,
        "axes.labelsize": 11,
        "axes.titlesize": 11,
        "legend.fontsize": 9,
        "figure.dpi": 120,
    }
)


def _save_or_show(fig: Figure, path: Path | None, dpi: int = 150) -> None:
    if path is not None:
        path.parent.mkdir(parents=True, exist_ok=True)
        fig.savefig(path, dpi=dpi, bbox_inches="tight")
        plt.close(fig)


def _style_axes(ax: plt.Axes) -> None:
    ax.grid(True, alpha=0.35, linestyle="--", linewidth=0.6)
    ax.tick_params(direction="in", top=True, right=True)


def _apply_y_scale(ax: plt.Axes, y_mm: np.ndarray, y_scale: YScale) -> None:
    if y_scale == "log":
        ax.set_yscale("log")
        positive = y_mm[y_mm > 0]
        ymin = float(positive.min()) if positive.size else 1e-4
        ax.set_ylim(bottom=max(ymin * 0.5, 1e-4))
    else:
        ax.set_ylim(bottom=0)


def _profile_title(quantity: str, prof: ProfileAtX, geometry: GeometryConfig) -> str:
    return f"{quantity} — {geometry.label} @ x = {prof.x:.4g} m"


def _mark_x_location(ax: plt.Axes, x_sel: float | None, color: str = "#c0392b") -> None:
    if x_sel is None:
        return
    ax.axvline(x_sel, color=color, ls=":", lw=1.5, zorder=5)
    ylim = ax.get_ylim()
    ax.text(
        x_sel,
        ylim[1] * 0.95,
        f"  x = {x_sel:.3g} m",
        color=color,
        fontsize=9,
        va="top",
        ha="left",
        rotation=90,
    )


def _surface_coords(
    geometry: GeometryConfig, x: np.ndarray
) -> tuple[np.ndarray, np.ndarray | None]:
    """
    Return surface y(x) in metres and optional centerline y (cone).

    Flat plate: surface at y=0, no centerline.
    Wedge/cone: y_surf = x tan(theta).
    """
    if geometry.kind == "flat_plate":
        return np.zeros_like(x), None
    half_rad = np.deg2rad(
        geometry.cone_half_angle_deg if geometry.kind != "wedge" else max(geometry.cone_half_angle_deg, 0.1)
    )
    y_surf = x * np.tan(half_rad)
    centerline = np.zeros_like(x) if geometry.kind == "cone" else None
    return y_surf, centerline


# --- Profile plots ---


def plot_velocity_profile(
    prof: ProfileAtX,
    geometry: GeometryConfig,
    path: Path | None = None,
    y_scale: YScale = "linear",
) -> Figure:
    y_mm = prof.y * 1e3
    fig, ax = plt.subplots(figsize=(5.2, 4.2))
    ax.plot(prof.u_over_Ue, y_mm, color="#1f77b4", lw=2)
    ax.set_xlabel(r"$u/U_e$")
    ax.set_ylabel(r"$y$ [mm]")
    ax.set_title(_profile_title(r"$u/U_e$ vs $y$", prof, geometry))
    _apply_y_scale(ax, y_mm, y_scale)
    _style_axes(ax)
    _save_or_show(fig, path)
    return fig


def plot_temperature_profile(
    prof: ProfileAtX,
    geometry: GeometryConfig,
    path: Path | None = None,
    y_scale: YScale = "linear",
) -> Figure:
    y_mm = prof.y * 1e3
    fig, ax = plt.subplots(figsize=(5.2, 4.2))
    ax.plot(prof.T_over_Te, y_mm, color="#d62728", lw=2)
    ax.set_xlabel(r"$T/T_e$")
    ax.set_ylabel(r"$y$ [mm]")
    ax.set_title(_profile_title(r"$T/T_e$ vs $y$", prof, geometry))
    _apply_y_scale(ax, y_mm, y_scale)
    _style_axes(ax)
    _save_or_show(fig, path)
    return fig


def plot_density_profile(
    prof: ProfileAtX,
    geometry: GeometryConfig,
    path: Path | None = None,
    y_scale: YScale = "linear",
) -> Figure:
    y_mm = prof.y * 1e3
    fig, ax = plt.subplots(figsize=(5.2, 4.2))
    ax.plot(prof.rho_over_rhoe, y_mm, color="#2ca02c", lw=2)
    ax.set_xlabel(r"$\rho/\rho_e$")
    ax.set_ylabel(r"$y$ [mm]")
    ax.set_title(_profile_title(r"$\rho/\rho_e$ vs $y$", prof, geometry))
    _apply_y_scale(ax, y_mm, y_scale)
    _style_axes(ax)
    _save_or_show(fig, path)
    return fig


def plot_mach_profile(
    prof: ProfileAtX,
    geometry: GeometryConfig,
    path: Path | None = None,
    y_scale: YScale = "linear",
) -> Figure:
    y_mm = prof.y * 1e3
    fig, ax = plt.subplots(figsize=(5.2, 4.2))
    ax.plot(prof.M, y_mm, color="#9467bd", lw=2)
    ax.set_xlabel("Mach number")
    ax.set_ylabel(r"$y$ [mm]")
    ax.set_title(_profile_title("Mach vs y", prof, geometry))
    _apply_y_scale(ax, y_mm, y_scale)
    _style_axes(ax)
    _save_or_show(fig, path)
    return fig


# --- x-sweep plots ---


def plot_delta_99_vs_x(
    sweep: XSweepResult,
    geometry: GeometryConfig,
    path: Path | None = None,
    x_sel: float | None = None,
) -> Figure:
    fig, ax = plt.subplots(figsize=(5.2, 4.2))
    ax.plot(sweep.x, sweep.delta_99 * 1e3, "ko-", ms=4, lw=1.5)
    ax.set_xlabel(r"$x$ [m]")
    ax.set_ylabel(r"$\delta_{99}$ [mm]")
    ax.set_title(f"$\\delta_{{99}}$ vs $x$ — {geometry.label}")
    _mark_x_location(ax, x_sel)
    _style_axes(ax)
    _save_or_show(fig, path)
    return fig


def plot_delta_star_vs_x(
    sweep: XSweepResult,
    geometry: GeometryConfig,
    path: Path | None = None,
    x_sel: float | None = None,
) -> Figure:
    fig, ax = plt.subplots(figsize=(5.2, 4.2))
    ax.plot(sweep.x, sweep.delta_star * 1e3, color="#e67e22", marker="o", ms=4, lw=1.5)
    ax.set_xlabel(r"$x$ [m]")
    ax.set_ylabel(r"$\delta^*$ [mm]")
    ax.set_title(f"Displacement thickness — {geometry.label}")
    _mark_x_location(ax, x_sel)
    _style_axes(ax)
    _save_or_show(fig, path)
    return fig


def plot_theta_vs_x(
    sweep: XSweepResult,
    geometry: GeometryConfig,
    path: Path | None = None,
    x_sel: float | None = None,
) -> Figure:
    fig, ax = plt.subplots(figsize=(5.2, 4.2))
    ax.plot(sweep.x, sweep.theta * 1e3, color="#16a085", marker="o", ms=4, lw=1.5)
    ax.set_xlabel(r"$x$ [m]")
    ax.set_ylabel(r"$\theta$ [mm]")
    ax.set_title(f"Momentum thickness — {geometry.label}")
    _mark_x_location(ax, x_sel)
    _style_axes(ax)
    _save_or_show(fig, path)
    return fig


def plot_cf_vs_x(
    sweep: XSweepResult,
    geometry: GeometryConfig,
    path: Path | None = None,
    x_sel: float | None = None,
) -> Figure:
    fig, ax = plt.subplots(figsize=(5.2, 4.2))
    ax.plot(sweep.x, sweep.Cf, color="#2980b9", marker="o", ms=4, lw=1.5)
    ax.set_xlabel(r"$x$ [m]")
    ax.set_ylabel(r"$C_f$ (approx.)")
    ax.set_title(f"Skin friction — {geometry.label}")
    ax.yaxis.set_major_formatter(ticker.ScalarFormatter(useMathText=True))
    ax.ticklabel_format(axis="y", style="sci", scilimits=(0, 0))
    _mark_x_location(ax, x_sel)
    _style_axes(ax)
    _save_or_show(fig, path)
    return fig


# --- Geometry envelope ---


def plot_geometry_envelope(
    geometry: GeometryConfig,
    sweep: XSweepResult,
    edge: EdgeConditions,
    path: Path | None = None,
    x_sel: float | None = None,
) -> Figure:
    """Body geometry, centerline (cone), and delta_99 envelope in the meridional plane."""
    fig, ax = plt.subplots(figsize=(8, 4.5))
    x = sweep.x
    delta = sweep.delta_99
    y_surf, centerline = _surface_coords(geometry, x)
    y_surf_mm = y_surf * 1e3
    y_bl_mm = (y_surf + delta) * 1e3

    if geometry.kind == "cone" and centerline is not None:
        ax.plot(x, centerline * 1e3, "k-.", lw=1, label="Centerline")

    ax.plot(x, y_surf_mm, "k-", lw=2.5, label="Body surface", zorder=3)
    ax.plot(x, y_bl_mm, "b--", lw=2, label=r"$\delta_{99}$", zorder=3)
    ax.fill_between(x, y_surf_mm, y_bl_mm, alpha=0.2, color="#3498db", zorder=1)

    # Annotate delta_99 at selected x or mid-stream
    x_ann = x_sel if x_sel is not None else float(x[len(x) // 2])
    i_ann = int(np.argmin(np.abs(x - x_ann)))
    ax.annotate(
        r"$\delta_{99}$",
        xy=(x[i_ann], y_bl_mm[i_ann]),
        xytext=(8, 8),
        textcoords="offset points",
        fontsize=10,
        color="#2980b9",
        arrowprops=dict(arrowstyle="->", color="#2980b9", lw=1),
    )

    _mark_x_location(ax, x_sel)

    ax.set_xlabel(r"$x$ [m]")
    ax.set_ylabel(r"$y$ [mm]")
    ax.set_title(f"Geometry & boundary layer — {geometry.label}")
    ax.legend(loc="upper left", framealpha=0.9)
    ax.set_ylim(bottom=0)
    _style_axes(ax)
    _save_or_show(fig, path)
    return fig


# --- Contour fields (approximate similarity strip) ---


def build_contour_grid(
    edge: EdgeConditions,
    geometry: GeometryConfig,
    x_array: np.ndarray,
    blasius: BlasiusSolution | None = None,
    field: FieldName = "u_over_Ue",
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """
    Build (X, Y_mm, Z) for contour plots.

    Similarity solution: profiles identical in eta; only delta_scale(x) stretches y.
  """
    if blasius is None:
        blasius = solve_blasius()
    sim = build_similarity_profiles(edge, blasius)
    eta = sim["eta"]
    x_arr = np.asarray(x_array, dtype=float)
    x_eff = effective_streamwise_distance(x_arr, geometry)
    d_scale = np.sqrt(edge.mu_e * x_eff / (edge.rho_e * edge.U_e))

    n_x = x_arr.size
    n_eta = eta.size
    X_out = np.tile(x_arr[None, :], (n_eta, 1))
    Y_mm = np.outer(eta, d_scale) * 1e3
    values = sim["M"] if field == "M" else sim[field]
    Z = np.tile(values[:, None], (1, n_x))
    return X_out, Y_mm, Z


def plot_field_contour(
    edge: EdgeConditions,
    geometry: GeometryConfig,
    x_array: np.ndarray,
    field: FieldName,
    blasius: BlasiusSolution | None = None,
    path: Path | None = None,
    x_sel: float | None = None,
) -> Figure:
    """Approximate x–y contour of a similarity-scaled field."""
    labels = {
        "u_over_Ue": (r"$u/U_e$", "viridis"),
        "T_over_Te": (r"$T/T_e$", "inferno"),
        "M": ("Mach", "plasma"),
    }
    label, cmap = labels[field]
    X, Y_mm, Z = build_contour_grid(edge, geometry, x_array, blasius, field)

    fig, ax = plt.subplots(figsize=(7, 4.5))
    cf = ax.contourf(X, Y_mm, Z, levels=32, cmap=cmap)
    fig.colorbar(cf, ax=ax, label=label, shrink=0.9)
    _mark_x_location(ax, x_sel)
    ax.set_xlabel(r"$x$ [m]")
    ax.set_ylabel(r"$y$ [mm]")
    ax.set_title(f"{label} field (similarity-scaled) — {geometry.label}")
    ax.set_ylim(bottom=0)
    _style_axes(ax)
    _save_or_show(fig, path)
    return fig


def plot_all_example(
    prof: ProfileAtX,
    sweep: XSweepResult,
    geometry: GeometryConfig,
    edge: EdgeConditions,
    out_dir: Path,
) -> list[Path]:
    """Generate full example plot set; return saved paths."""
    out_dir = Path(out_dir)
    x_sel = prof.x
    paths = {
        "velocity": out_dir / "velocity_profile.png",
        "temperature": out_dir / "temperature_profile.png",
        "density": out_dir / "density_profile.png",
        "mach": out_dir / "mach_profile.png",
        "delta_99": out_dir / "delta_99_vs_x.png",
        "delta_star": out_dir / "delta_star_vs_x.png",
        "theta": out_dir / "theta_vs_x.png",
        "cf": out_dir / "cf_vs_x.png",
        "geometry": out_dir / "geometry_envelope.png",
    }
    plot_velocity_profile(prof, geometry, paths["velocity"])
    plot_temperature_profile(prof, geometry, paths["temperature"])
    plot_density_profile(prof, geometry, paths["density"])
    plot_mach_profile(prof, geometry, paths["mach"])
    plot_delta_99_vs_x(sweep, geometry, paths["delta_99"], x_sel=x_sel)
    plot_delta_star_vs_x(sweep, geometry, paths["delta_star"], x_sel=x_sel)
    plot_theta_vs_x(sweep, geometry, paths["theta"], x_sel=x_sel)
    plot_cf_vs_x(sweep, geometry, paths["cf"], x_sel=x_sel)
    plot_geometry_envelope(geometry, sweep, edge, paths["geometry"], x_sel=x_sel)
    return list(paths.values())
