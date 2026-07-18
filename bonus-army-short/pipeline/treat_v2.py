#!/usr/bin/env python3
"""One cached treatment chain per asset (reality patch #4): B&W match -> damage,
run exactly once so the look never drifts between beats. Also emits parallax
layers where needed:
  - parallax3 (clean subject): {name}_fg.png (rembg cutout) + {name}_bg.png
    (subject hole inpainted) for true 3-layer parallax.
  - strip / flat: just the treated {name}.png (the strip-cheat is done in the
    component from this single image, so no mangled cutout edge is possible).
Outputs to public/assets/final/.
"""
import os, glob, sys
from PIL import Image, ImageOps, ImageFilter
import numpy as np

SRC_DIRS = ["public/assets/src", "public/assets/src2"]
OUT = "public/assets/final"
os.makedirs(OUT, exist_ok=True)
os.environ.setdefault("U2NET_HOME", "/root/.u2net")

# name -> treatment type. Anything not listed defaults to "flat".
PLAN = {
    # clean-subject parallax (rembg + inpaint)
    "breadline": "parallax3",
    "fdr": "portrait",          # already-cut portraits: just B&W-match (kept alpha)
    "macarthur": "portrait",
    "patton": "portrait",
    "eisenhower": "portrait",
    "hoover": "portrait",
    # scene/crowd/wide: flat treated (component does the strip-cheat)
    "veterans_crowd": "flat",
    "anacostia_wide": "flat",
    "camp_life": "flat",
    "bonus_burning": "flat",
    "bonus_march": "flat",
    "cavalry": "flat",
    "troops_bayonet": "flat",
    "tear_gas": "flat",
    "tank_1932": "flat",
    "theater_1930s": "flat",
    "dc_map": "flat",
    "dc_map_1932": "flat",
    "infantry": "skip",  # was a coat-of-arms, unusable
}


def bw_match(img: Image.Image) -> Image.Image:
    g = ImageOps.grayscale(img)
    g = ImageOps.autocontrast(g, cutoff=1)
    a = np.asarray(g).astype(np.float32) / 255.0
    a = np.clip(0.5 + 1.16 * (a - 0.5), 0, 1)   # S-curve
    a = 0.05 + 0.9 * a                          # lift blacks (nothing pure black)
    a = np.power(a, 0.95)
    return Image.fromarray((a * 255).astype("uint8"), "L")


def main():
    srcs = {}
    for d in SRC_DIRS:
        for f in glob.glob(f"{d}/*"):
            name = os.path.splitext(os.path.basename(f))[0]
            srcs.setdefault(name, f)  # src (portraits) wins over src2 on name clash

    session = None
    for name, f in sorted(srcs.items()):
        plan = PLAN.get(name, "flat")
        if plan == "skip":
            print(f"skip    {name}")
            continue
        img = Image.open(f).convert("RGB")

        if plan == "portrait":
            # already-isolated cutout PNG (has alpha) -> B&W-match, keep alpha
            src_rgba = Image.open(f).convert("RGBA")
            gray = bw_match(src_rgba.convert("RGB"))
            out = Image.merge("LA", (gray, src_rgba.split()[3])).convert("RGBA")
            out.save(f"{OUT}/{name}.png")
            print(f"portrait {name:16} {out.size}")
            continue

        gray = bw_match(img).convert("RGB")
        gray.save(f"{OUT}/{name}.png")

        if plan == "parallax3":
            if session is None:
                from rembg import new_session
                session = new_session("u2net")
            from rembg import remove
            cut = remove(img, session=session)  # RGBA
            alpha = cut.split()[3]
            fg_gray = bw_match(cut.convert("RGB"))
            fg = Image.merge("LA", (fg_gray, alpha)).convert("RGBA")
            fg.save(f"{OUT}/{name}_fg.png")
            # inpaint the subject hole for the background plate
            import cv2
            arr = cv2.cvtColor(np.asarray(gray), cv2.COLOR_RGB2BGR)
            m = np.asarray(alpha)
            m = (m > 40).astype("uint8") * 255
            m = cv2.dilate(m, np.ones((15, 15), np.uint8), iterations=2)
            filled = cv2.inpaint(arr, m, 7, cv2.INPAINT_TELEA)
            bg = Image.fromarray(cv2.cvtColor(filled, cv2.COLOR_BGR2RGB))
            bg = bg.filter(ImageFilter.GaussianBlur(1.2))  # depth haze
            bg.save(f"{OUT}/{name}_bg.png")
            print(f"parallax3 {name:14} full{gray.size} fg{fg.size}")
        else:
            print(f"flat     {name:16} {gray.size}")
    print("DONE")


if __name__ == "__main__":
    sys.exit(main())
