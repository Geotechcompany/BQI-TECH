"""Windows-only startup tweaks (must run before pymongo is imported)."""

import sys


def patch_platform_wmi() -> None:
    """Avoid multi-minute WMI timeouts during pymongo import on Windows."""
    if sys.platform != "win32":
        return

    import platform

    def _disabled_wmi_query(*_args, **_kwargs):
        raise OSError("WMI query disabled for faster startup")

    platform._wmi_query = _disabled_wmi_query  # type: ignore[attr-defined]


patch_platform_wmi()
