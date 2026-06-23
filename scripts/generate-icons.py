from __future__ import annotations

from pathlib import Path
from typing import Iterable

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
BUILD_DIR = ROOT / "build"
APP_DIR = BUILD_DIR / "app-icons"
FILE_DIR = BUILD_DIR / "file-icons"

MASTER_SIZE = 1024
APP_SIZES = [1024, 512, 256, 128, 64, 32, 16]
FILE_SIZES = [1024, 512, 256, 128, 64, 32, 16]


PALETTE = {
    "paper": "#FFF8EF",
    "paper_shadow": "#F2E7D8",
    "white": "#FFFFFF",
    "blue": "#3568D4",
    "blue_dark": "#274BA0",
    "sage": "#7CBF9B",
    "coral": "#F17D67",
    "apricot": "#F6C483",
}


def _rounded_rectangle(draw: ImageDraw.ImageDraw, box: tuple[float, float, float, float], radius: float, **kwargs) -> None:
    draw.rounded_rectangle(box, radius=radius, **kwargs)


def _branch_stroke(draw: ImageDraw.ImageDraw, points: Iterable[tuple[float, float]], width: int, fill: str) -> None:
    draw.line(list(points), fill=fill, width=width, joint="curve")


def _draw_leaf(draw: ImageDraw.ImageDraw, center: tuple[float, float], radius: float, fill: str) -> None:
    x, y = center
    draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=fill)


def render_app_master(size: int = MASTER_SIZE) -> Image.Image:
    img = Image.new("RGBA", (size, size), (255, 255, 255, 0))
    draw = ImageDraw.Draw(img)

    margin = size * 0.08
    _rounded_rectangle(
        draw,
        (margin, margin, size - margin, size - margin),
        radius=size * 0.22,
        fill=PALETTE["blue"],
    )

    # Card shadow gives the icon body a clearer silhouette without going glossy.
    shadow = (
        size * 0.24,
        size * 0.20,
        size * 0.76,
        size * 0.80,
    )
    _rounded_rectangle(draw, shadow, radius=size * 0.08, fill=PALETTE["paper_shadow"])

    card = (
        size * 0.21,
        size * 0.17,
        size * 0.73,
        size * 0.77,
    )
    _rounded_rectangle(draw, card, radius=size * 0.075, fill=PALETTE["paper"])

    # Fold corner.
    fold = [
        (size * 0.62, size * 0.17),
        (size * 0.73, size * 0.17),
        (size * 0.73, size * 0.28),
    ]
    draw.polygon(fold, fill=PALETTE["apricot"])
    draw.line([fold[0], fold[1], fold[2]], fill=PALETTE["blue"], width=int(size * 0.012))

    stroke = int(size * 0.03)
    trunk = [
        (size * 0.47, size * 0.36),
        (size * 0.47, size * 0.58),
    ]
    left_branch = [
        (size * 0.47, size * 0.46),
        (size * 0.37, size * 0.39),
        (size * 0.30, size * 0.31),
    ]
    right_branch = [
        (size * 0.47, size * 0.46),
        (size * 0.58, size * 0.38),
        (size * 0.66, size * 0.30),
    ]
    low_left = [
        (size * 0.47, size * 0.58),
        (size * 0.37, size * 0.65),
        (size * 0.31, size * 0.73),
    ]
    low_right = [
        (size * 0.47, size * 0.58),
        (size * 0.58, size * 0.65),
        (size * 0.65, size * 0.72),
    ]

    for path in (trunk, left_branch, right_branch, low_left, low_right):
        _branch_stroke(draw, path, stroke, PALETTE["blue"])

    _draw_leaf(draw, (size * 0.30, size * 0.31), size * 0.042, PALETTE["coral"])
    _draw_leaf(draw, (size * 0.66, size * 0.30), size * 0.042, PALETTE["sage"])
    _draw_leaf(draw, (size * 0.31, size * 0.73), size * 0.036, PALETTE["coral"])
    _draw_leaf(draw, (size * 0.65, size * 0.72), size * 0.036, PALETTE["sage"])
    _draw_leaf(draw, (size * 0.47, size * 0.58), size * 0.034, PALETTE["apricot"])

    return img


def render_file_master(size: int = MASTER_SIZE) -> Image.Image:
    img = Image.new("RGBA", (size, size), (255, 255, 255, 0))
    draw = ImageDraw.Draw(img)

    # Distinct file silhouette for OS file lists.
    page = [
        (size * 0.24, size * 0.10),
        (size * 0.62, size * 0.10),
        (size * 0.78, size * 0.26),
        (size * 0.78, size * 0.88),
        (size * 0.24, size * 0.88),
    ]
    draw.polygon(page, fill=PALETTE["white"])
    draw.line(page + [page[0]], fill=PALETTE["blue"], width=int(size * 0.028))

    fold = [
        (size * 0.62, size * 0.10),
        (size * 0.62, size * 0.26),
        (size * 0.78, size * 0.26),
    ]
    draw.polygon(fold, fill=PALETTE["apricot"])
    draw.line(
        [(size * 0.62, size * 0.10), (size * 0.62, size * 0.26), (size * 0.78, size * 0.26)],
        fill=PALETTE["blue"],
        width=int(size * 0.024),
    )

    stroke = int(size * 0.03)
    trunk = [(size * 0.49, size * 0.33), (size * 0.49, size * 0.60)]
    branch_left = [(size * 0.49, size * 0.43), (size * 0.39, size * 0.36), (size * 0.33, size * 0.30)]
    branch_right = [(size * 0.49, size * 0.43), (size * 0.59, size * 0.36), (size * 0.66, size * 0.28)]
    branch_bottom = [(size * 0.49, size * 0.60), (size * 0.59, size * 0.68), (size * 0.66, size * 0.76)]

    for path in (trunk, branch_left, branch_right, branch_bottom):
        _branch_stroke(draw, path, stroke, PALETTE["blue"])

    # FILE-FINAL-2 characteristic: fold participates in the right branch.
    connector = [(size * 0.66, size * 0.28), (size * 0.70, size * 0.24), (size * 0.72, size * 0.22)]
    _branch_stroke(draw, connector, stroke, PALETTE["blue"])

    _draw_leaf(draw, (size * 0.33, size * 0.30), size * 0.038, PALETTE["coral"])
    _draw_leaf(draw, (size * 0.66, size * 0.28), size * 0.038, PALETTE["sage"])
    _draw_leaf(draw, (size * 0.66, size * 0.76), size * 0.036, PALETTE["coral"])
    _draw_leaf(draw, (size * 0.49, size * 0.60), size * 0.032, PALETTE["apricot"])

    return img


def export_pngs(master: Image.Image, target_dir: Path, basename: str, sizes: list[int]) -> None:
    target_dir.mkdir(parents=True, exist_ok=True)
    for size in sizes:
        resized = master.resize((size, size), Image.Resampling.LANCZOS)
        resized.save(target_dir / f"{basename}-{size}.png")


def export_root_png(master: Image.Image, path: Path, size: int) -> None:
    resized = master.resize((size, size), Image.Resampling.LANCZOS)
    resized.save(path)


def export_ico(master: Image.Image, path: Path, sizes: list[int]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    master.save(path, format="ICO", sizes=[(s, s) for s in sizes])


def export_icns(master: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    master.save(path, format="ICNS")


def main() -> None:
    app_master = render_app_master()
    file_master = render_file_master()

    export_pngs(app_master, APP_DIR, "icon", APP_SIZES)
    export_pngs(file_master, FILE_DIR, "file-icon", FILE_SIZES)

    export_root_png(app_master, BUILD_DIR / "icon.png", 512)
    export_ico(app_master, BUILD_DIR / "icon.ico", [256, 128, 64, 48, 32, 16])
    export_icns(app_master, BUILD_DIR / "icon.icns")

    export_root_png(file_master, BUILD_DIR / "file-icon.png", 256)
    export_ico(file_master, BUILD_DIR / "file-icon.ico", [256, 128, 64, 48, 32, 16])
    export_icns(file_master, BUILD_DIR / "file-icon.icns")


if __name__ == "__main__":
    main()
