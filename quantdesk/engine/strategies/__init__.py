"""Strategy package. Importing it registers every strategy."""

from .base import (  # noqa: F401
    Context,
    ParamSpec,
    Strategy,
    all_strategies,
    by_family,
    get,
    register,
)

# Import order does not matter; each module self-registers on import.
from . import breakout, mean_reversion, microstructure, statarb, trend, volatility  # noqa: F401,E402
from . import ensemble  # noqa: F401,E402

__all__ = [
    "Strategy",
    "ParamSpec",
    "Context",
    "register",
    "get",
    "all_strategies",
    "by_family",
]
