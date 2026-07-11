from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parents[1]
BUILD_DIR = ROOT / "build"
APP_DIR = BUILD_DIR / "app-icons"
FILE_DIR = BUILD_DIR / "file-icons"
SOURCE_DIR = BUILD_DIR / "source-crops"

APP_SOURCE = SOURCE_DIR / "app-final-1-source.png"
FILE_SOURCE = SOURCE_DIR / "file-final-3-source.png"
INSTALLER_SOURCE = SOURCE_DIR / "installer-sidebar-source.png"

MASTER_SIZE = 1024
APP_SIZES = [1024, 512, 256, 128, 64, 32, 16]
FILE_SIZES = [1024, 512, 256, 128, 64, 32, 16]
SIDEBAR_SIZE = (164, 314)

def load_source(path: Path) -> Image.Image:
    if not path.exists():
        raise FileNotFoundError(f"Icon source is missing: {path}")
    return Image.open(path).convert("RGBA")


def remove_edge_background(source: Image.Image, *, tolerance: int = 18) -> Image.Image:
    """Remove only the off-white background connected to the image edge."""
    img = source.copy()
    pixels = img.load()
    width, height = img.size
    background = pixels[0, 0][:3]
    stack: list[tuple[int, int]] = []
    seen: set[tuple[int, int]] = set()

    for x in range(width):
        stack.append((x, 0))
        stack.append((x, height - 1))
    for y in range(height):
        stack.append((0, y))
        stack.append((width - 1, y))

    def is_background(x: int, y: int) -> bool:
        r, g, b, a = pixels[x, y]
        if a == 0:
            return True
        return (
            abs(r - background[0])
            + abs(g - background[1])
            + abs(b - background[2])
        ) <= tolerance

    while stack:
        x, y = stack.pop()
        if (x, y) in seen or x < 0 or y < 0 or x >= width or y >= height:
            continue
        seen.add((x, y))
        if not is_background(x, y):
            continue
        r, g, b, _a = pixels[x, y]
        pixels[x, y] = (r, g, b, 0)
        stack.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))

    return img


def square_master(source: Image.Image, *, scale: float = 1.0) -> Image.Image:
    canvas = Image.new("RGBA", (MASTER_SIZE, MASTER_SIZE), (255, 255, 255, 0))
    target_size = max(1, round(MASTER_SIZE * scale))
    resized = ImageOps.contain(source, (target_size, target_size), Image.Resampling.LANCZOS)
    bbox = resized.getchannel("A").getbbox()
    if bbox is None:
        return canvas
    left, top, right, bottom = bbox
    content_center_x = (left + right) / 2
    content_center_y = (top + bottom) / 2
    x = round((MASTER_SIZE / 2) - content_center_x)
    y = round((MASTER_SIZE / 2) - content_center_y)
    canvas.alpha_composite(resized, (x, y))
    return canvas


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
    master.save(path, format="ICO", sizes=[(size, size) for size in sizes])


def export_icns(master: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    master.save(path, format="ICNS")


def export_sidebar(path: Path, source: Image.Image) -> None:
    # NSIS expects a 164x314 BMP without alpha for MUI sidebar images.
    path.parent.mkdir(parents=True, exist_ok=True)
    ImageOps.fit(
        source.convert("RGB"),
        SIDEBAR_SIZE,
        method=Image.Resampling.LANCZOS,
        centering=(0.5, 0.5),
    ).save(path, format="BMP")


def main() -> None:
    app_source = remove_edge_background(load_source(APP_SOURCE))
    file_source = remove_edge_background(load_source(FILE_SOURCE))
    installer_source = load_source(INSTALLER_SOURCE)

    app_master = square_master(app_source, scale=0.88)
    # File icons need a little more clear space so 16px/32px Explorer views do
    # not clip antialiasing at the page edge.
    file_master = square_master(file_source, scale=0.94)

    export_pngs(app_master, APP_DIR, "icon", APP_SIZES)
    export_pngs(file_master, FILE_DIR, "file-icon", FILE_SIZES)

    export_root_png(app_master, BUILD_DIR / "icon.png", 512)
    export_ico(app_master, BUILD_DIR / "icon.ico", [256, 128, 64, 48, 32, 16])
    export_icns(app_master, BUILD_DIR / "icon.icns")

    export_root_png(file_master, BUILD_DIR / "file-icon.png", 256)
    export_ico(file_master, BUILD_DIR / "file-icon.ico", [256, 128, 64, 48, 32, 16])
    export_icns(file_master, BUILD_DIR / "file-icon.icns")

    export_sidebar(BUILD_DIR / "installer-sidebar.bmp", installer_source)
    export_sidebar(BUILD_DIR / "uninstaller-sidebar.bmp", installer_source)


if __name__ == "__main__":
    main()
