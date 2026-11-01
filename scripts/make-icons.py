"""Draws the app icons (the card-box logo from src/lib/assets/favicon.svg) as PNGs.

Run from the project root: python3 scripts/make-icons.py  (needs Pillow)
The logo fills about 60 % of the icon, inside the safe zone of maskable icons.
"""

from PIL import Image, ImageDraw

BACKGROUND = "#F3F8F4"
# (x, y, width, height, corner radius, colour) in the 28-unit grid of favicon.svg
SHAPES = [
    (6, 3, 18, 13, 2, "#94D2AB"),
    (3, 8, 18, 13, 2, "#1C7A4A"),
    (3, 11, 18, 1.5, 0, "#6DBE8E"),
    (3, 21, 22, 4, 1.5, "#135C37"),
]
LOGO_BOX = (3, 3, 25, 25)  # extent of the shapes


def draw(size: int, path: str) -> None:
    scale_up = 4  # draw large, then shrink for smooth edges
    big = size * scale_up
    img = Image.new("RGB", (big, big), BACKGROUND)
    d = ImageDraw.Draw(img)

    logo = big * 0.6
    unit = logo / (LOGO_BOX[2] - LOGO_BOX[0])
    offset = (big - logo) / 2 - LOGO_BOX[0] * unit
    for x, y, w, h, r, colour in SHAPES:
        box = [offset + x * unit, offset + y * unit, offset + (x + w) * unit, offset + (y + h) * unit]
        d.rounded_rectangle(box, radius=r * unit, fill=colour)

    img.resize((size, size), Image.LANCZOS).save(path)


for size, name in [(192, "icon-192.png"), (512, "icon-512.png"), (180, "apple-touch-icon.png")]:
    draw(size, f"static/{name}")
    print(f"static/{name}")
