#!/usr/bin/env python3
"""Unify fetched assets to one B&W look; rembg-cutout the portraits.
Outputs public/assets/treated/{name}.png. Portraits get an alpha cutout so the
component can add the red offset outline; scenes stay full-frame grayscale.
"""
import os, glob, sys
from PIL import Image, ImageOps, ImageFilter
import numpy as np

SRC = "public/assets/src"
OUT = "public/assets/treated"
os.makedirs(OUT, exist_ok=True)

PORTRAITS = {"macarthur", "patton", "eisenhower", "hoover", "fdr"}

def bw_unify(img: Image.Image) -> Image.Image:
    """Grayscale + consistent contrast (histogram to one look) + faint warmth."""
    g = ImageOps.grayscale(img)
    g = ImageOps.autocontrast(g, cutoff=1)
    a = np.asarray(g).astype(np.float32) / 255.0
    # gentle S-curve for editorial punch, then lift blacks slightly (newsprint)
    a = np.clip(0.5 + 1.18 * (a - 0.5), 0, 1)
    a = 0.06 + 0.92 * a
    a = np.power(a, 0.96)
    return Image.fromarray((a * 255).astype("uint8"), "L")

def main():
    try:
        from rembg import remove, new_session
        session = new_session("u2net")
    except Exception as e:
        print("rembg unavailable:", e); session = None

    for f in sorted(glob.glob(f"{SRC}/*")):
        name = os.path.splitext(os.path.basename(f))[0]
        img = Image.open(f).convert("RGB")
        if name in PORTRAITS and session is not None:
            cut = remove(img, session=session)  # RGBA with alpha
            gray = bw_unify(cut.convert("RGB"))
            out = Image.merge("LA", (gray, cut.split()[3])).convert("RGBA")
            # tidy the matte edge a touch
            alpha = out.split()[3].filter(ImageFilter.MaxFilter(3)).filter(
                ImageFilter.GaussianBlur(0.6))
            out.putalpha(alpha)
            out.save(f"{OUT}/{name}.png")
            print(f"cutout  {name:14} {out.size}")
        else:
            g = bw_unify(img).convert("RGB")
            g.save(f"{OUT}/{name}.png")
            print(f"scene   {name:14} {g.size}")
    print("DONE")

if __name__ == "__main__":
    main()
