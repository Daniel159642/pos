#!/usr/bin/env python3
"""Create app icon from Delancey logo: white square, logo centered (no transparency)."""
from pathlib import Path

from PIL import Image

SRC = Path("/Users/daniellopez/Downloads/Delancey logo copy.png")
OUT_DIR = Path(__file__).resolve().parent.parent
FRONTEND_PUBLIC = OUT_DIR / "frontend" / "public"
TAURI_ICONS = OUT_DIR / "src-tauri" / "icons"

# Logo uses this fraction of the icon size (rest is white padding)
LOGO_SCALE = 0.72


def make_icon(size: int, logo_img: Image.Image) -> Image.Image:
    """Solid white square with logo centered. No transparency so no dark corners."""
    out = Image.new("RGB", (size, size), (255, 255, 255))
    logo_size = int(size * LOGO_SCALE)
    logo = logo_img.resize((logo_size, logo_size), Image.Resampling.LANCZOS)
    x = (size - logo_size) // 2
    y = (size - logo_size) // 2
    if logo.mode == "RGBA":
        white_tile = Image.new("RGB", (logo_size, logo_size), (255, 255, 255))
        white_tile.paste(logo, mask=logo.split()[3])
        out.paste(white_tile, (x, y))
    else:
        out.paste(logo, (x, y))
    return out


def main():
    if not SRC.exists():
        print(f"Source image not found: {SRC}")
        return
    logo_img = Image.open(SRC).convert("RGBA")

    FRONTEND_PUBLIC.mkdir(parents=True, exist_ok=True)
    TAURI_ICONS.mkdir(parents=True, exist_ok=True)

    # Favicon
    favicon = make_icon(32, logo_img)
    favicon.save(FRONTEND_PUBLIC / "favicon.png")
    make_icon(64, logo_img).save(FRONTEND_PUBLIC / "favicon-64.png")

    # Tauri: 1024x1024 solid white + logo (OS will apply rounded corners)
    icon = make_icon(1024, logo_img)
    icon.save(TAURI_ICONS / "icon.png")
    print(f"Saved favicon to {FRONTEND_PUBLIC / 'favicon.png'}")
    print(f"Saved Tauri icon to {TAURI_ICONS / 'icon.png'}")


if __name__ == "__main__":
    main()
