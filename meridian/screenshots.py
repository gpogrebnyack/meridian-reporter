"""Headless screenshot of each rendered slide, one PNG per slide section.

The deck HTML renders Observable Plot / d3 inside `<svg>` nodes via
`slides_boot.js`. We wait for at least one SVG to appear under every slide's
plot host before capturing, so the screenshot reflects the FINAL composition,
not the empty pre-render state.
"""

from __future__ import annotations

import asyncio
import contextlib
import functools
import http.server
import socket
import threading
from pathlib import Path

from playwright.async_api import async_playwright


@contextlib.contextmanager
def _serve(root: Path):
    """Spin up a threaded HTTP server rooted at `root` on a free port.

    ESM `import` and `fetch` inside the page require an http origin — `file://`
    triggers CORS blocks for sibling modules.
    """
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(root))
    # Port 0 → OS picks a free port.
    httpd = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    port = httpd.server_address[1]
    t = threading.Thread(target=httpd.serve_forever, daemon=True)
    t.start()
    try:
        yield f"http://127.0.0.1:{port}"
    finally:
        httpd.shutdown()
        httpd.server_close()


async def _capture(html_path: Path, out_dir: Path, slide_ids: list[str]) -> dict[str, Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    results: dict[str, Path] = {}
    # Serve the project root so that both slides.html and renderer/*.js resolve.
    project_root = html_path.resolve().parent
    rel = html_path.resolve().relative_to(project_root)
    with _serve(project_root) as origin:
        url = f"{origin}/{rel.as_posix()}"
        async with async_playwright() as p:
            browser = await p.chromium.launch()
            ctx = await browser.new_context(
                viewport={"width": 1600, "height": 900},
                device_scale_factor=2,
            )
            page = await ctx.new_page()
            await page.goto(url)
            # Wait until every plot host has an svg child (all slides rendered).
            await page.wait_for_function(
                """() => {
                  const hosts = document.querySelectorAll('[data-slide-plot]');
                  if (hosts.length === 0) return false;
                  return Array.from(hosts).every(h => h.querySelector('svg'));
                }""",
                timeout=30000,
            )
            # Extra settle tick for font layout.
            await page.wait_for_timeout(400)
            for sid in slide_ids:
                el = await page.query_selector(f"#slide-{sid}")
                if not el:
                    continue
                await el.scroll_into_view_if_needed()
                png_path = out_dir / f"{sid}.png"
                await el.screenshot(path=str(png_path))
                results[sid] = png_path
            await browser.close()
    return results


def screenshot_slides(html_path: Path, out_dir: Path, slide_ids: list[str]) -> dict[str, Path]:
    """Capture one PNG per slide. Returns map of slide_id -> png Path."""
    return asyncio.run(_capture(html_path, out_dir, slide_ids))
