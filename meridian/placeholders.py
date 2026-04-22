"""Resolve `{{data:path}}` and `{{fmt:path|style}}` placeholders against enriched JSON.

Paths support dotted attribute access, positional array indexing (`segments[0]`),
and negative indexing (`revenue.total[-1]`). Unknown paths and format styles
fail loud — we want rendering to surface data misses, not silently fill gaps.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date, datetime
from typing import Any, Callable

PLACEHOLDER_RE = re.compile(r"\{\{\s*(data|fmt|derive)\s*:\s*([^|}\s]+)(?:\s*\|\s*([^}]+))?\s*\}\}")
PATH_STEP_RE = re.compile(r"([A-Za-z0-9_][A-Za-z0-9_]*)|\[(-?\d+)\]")


class PathError(KeyError):
    pass


def _walk(root: Any, path: str) -> Any:
    cur: Any = root
    steps = PATH_STEP_RE.findall(path.replace(" ", ""))
    if not steps:
        raise PathError(f"empty path: {path!r}")
    for attr, idx in steps:
        try:
            if attr:
                cur = cur[attr]
            else:
                cur = cur[int(idx)]
        except (KeyError, IndexError, TypeError) as e:
            raise PathError(f"cannot resolve step {attr or idx!r} in {path!r}: {e}") from e
    return cur


# ── Format styles ────────────────────────────────────────────────────────

def _aed(val: float, scale: int, label: str, decimals: int = 1) -> str:
    v = val / scale
    return f"AED {v:,.{decimals}f}{label}"


def _aed_bn(v: float) -> str:
    # Values in enriched JSON are generally AED thousands; bn = /1_000_000
    return _aed(v, 1_000_000, "bn", 2)


def _aed_mn(v: float) -> str:
    return _aed(v, 1_000, "mn", 0)


def _aed_k(v: float) -> str:
    return f"AED {v:,.0f}k"


def _pct(v: float) -> str:
    return f"{v:.1f}%"


def _pct_pp(v: float) -> str:
    sign = "+" if v >= 0 else ""
    return f"{sign}{v:.1f}pp"


def _signed_pct(v: float) -> str:
    sign = "+" if v >= 0 else ""
    return f"{sign}{_pct(v)}"


def _x(v: float) -> str:
    return f"{v:.1f}x"


def _int(v: float) -> str:
    return f"{int(round(v)):,}"


def _num(v: float) -> str:
    if isinstance(v, int):
        return f"{v:,}"
    return f"{v:,.2f}"


def _usc_kwh(v: float) -> str:
    return f"{v:.1f} US¢/kWh"


def _year(v: Any) -> str:
    if isinstance(v, (int, float)):
        return str(int(v))
    return str(v)


def _date_long(v: Any) -> str:
    d = _parse_date(v)
    return d.strftime("%d %B %Y")


def _date_short(v: Any) -> str:
    d = _parse_date(v)
    return d.strftime("%d %b %Y")


def _parse_date(v: Any) -> date:
    if isinstance(v, date):
        return v
    if isinstance(v, datetime):
        return v.date()
    if isinstance(v, str):
        return datetime.fromisoformat(v).date()
    raise ValueError(f"cannot parse date: {v!r}")


def _string(v: Any) -> str:
    return str(v)


FORMATTERS: dict[str, Callable[[Any], str]] = {
    "aed_bn": _aed_bn,
    "aed_mn": _aed_mn,
    "aed_k": _aed_k,
    "pct": _pct,
    "pct_pp": _pct_pp,
    "signed_pct": _signed_pct,
    "x": _x,
    "int": _int,
    "num": _num,
    "usc_kwh": _usc_kwh,
    "date_long": _date_long,
    "date_short": _date_short,
    "year": _year,
    "string": _string,
}


@dataclass
class ResolveReport:
    resolved: int = 0
    missing: list[str] = None  # type: ignore[assignment]
    unknown_format: list[str] = None  # type: ignore[assignment]

    def __post_init__(self) -> None:
        if self.missing is None:
            self.missing = []
        if self.unknown_format is None:
            self.unknown_format = []


def resolve(text: str, data: dict[str, Any], *, strict: bool = False) -> tuple[str, ResolveReport]:
    """Resolve placeholders in `text` against `data`. Returns (rendered, report).

    In lenient mode (default), missing paths render as `[?path]` and unknown
    formats fall back to string. In strict mode, both raise.
    """
    report = ResolveReport()

    def sub(m: re.Match[str]) -> str:
        kind, path, fmt = m.group(1), m.group(2), (m.group(3) or "").strip() or None
        try:
            value = _walk(data, path)
        except PathError as e:
            if strict:
                raise
            report.missing.append(path)
            return f"[?{path}]"

        if kind == "data":
            report.resolved += 1
            return _string(value)

        if kind == "fmt":
            formatter = FORMATTERS.get(fmt or "string")
            if formatter is None:
                if strict:
                    raise ValueError(f"unknown format style: {fmt!r}")
                report.unknown_format.append(fmt or "")
                return _string(value)
            try:
                rendered = formatter(value)
            except Exception as e:  # noqa: BLE001
                if strict:
                    raise
                report.unknown_format.append(f"{fmt}(error:{e})")
                return _string(value)
            report.resolved += 1
            return rendered

        # `derive` is a future hook; for now treat as data
        report.resolved += 1
        return _string(value)

    rendered = PLACEHOLDER_RE.sub(sub, text)
    return rendered, report


def resolve_recursive(obj: Any, data: dict[str, Any], *, strict: bool = False) -> tuple[Any, ResolveReport]:
    """Walk a JSON-like structure, resolving placeholders in every string leaf."""
    aggregate = ResolveReport()

    def walk(node: Any) -> Any:
        if isinstance(node, str):
            rendered, rep = resolve(node, data, strict=strict)
            aggregate.resolved += rep.resolved
            aggregate.missing.extend(rep.missing)
            aggregate.unknown_format.extend(rep.unknown_format)
            return rendered
        if isinstance(node, dict):
            return {k: walk(v) for k, v in node.items()}
        if isinstance(node, list):
            return [walk(v) for v in node]
        return node

    return walk(obj), aggregate
