"""Geometry definitions and Mangler-type streamwise scaling."""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Literal

import numpy as np

GeometryType = Literal["flat_plate", "wedge", "cone"]

MANGLER_NOTE = (
    "Cone boundary layer (first-order): streamwise distance scaled as "
    "x_eff = x / 3 (Mangler-type correction). This is a first-order cone "
    "boundary-layer approximation, not a full axisymmetric similarity solution."
)


class Geometry(Enum):
    FLAT_PLATE = "flat_plate"
    WEDGE = "wedge"
    CONE = "cone"


@dataclass(frozen=True)
class GeometryConfig:
    kind: GeometryType
    cone_half_angle_deg: float = 0.0

    @property
    def label(self) -> str:
        labels = {
            "flat_plate": "2D flat plate",
            "wedge": "2D wedge (local flat-plate approximation)",
            "cone": "Axisymmetric cone (Mangler x_eff = x/3)",
        }
        return labels.get(self.kind, self.kind)

    @property
    def mangler_note(self) -> str | None:
        if self.kind == "cone":
            return MANGLER_NOTE
        return None


def effective_streamwise_distance(x: float | np.ndarray, geometry: GeometryConfig) -> np.ndarray:
    """
    Effective streamwise coordinate for boundary-layer similarity scaling.

    flat plate / wedge: x_eff = x
    cone: x_eff = x / 3
    """
    x_arr = np.asarray(x, dtype=float)
    if geometry.kind == "cone":
        return x_arr / 3.0
    return x_arr.copy()
