#!/usr/bin/env python3
"""Compare a rendered capture against the locked reference image.

Usage:
    python3 tools/compare_reference.py <reference> <capture> --out <prefix>

Exit codes:
    0  all 13 gates passed
    1  one or more gates failed
    2  bad input (missing file, unreadable image, black capture, etc.)
"""

import sys
import argparse
import json

try:
    import numpy as np
    from PIL import Image
except ImportError:
    print("FATAL: this script requires pillow and numpy. "
          "pip install pillow numpy (add --break-system-packages if needed).")
    sys.exit(2)

W, H = 640, 360
N_BANDS = 12
N_PROFILE = 10


def load_rgb01(path):
    img = Image.open(path).convert("RGB").resize((W, H), Image.LANCZOS)
    return np.asarray(img, dtype=np.float32) / 255.0


def luma_of(rgb01):
    r, g, b = rgb01[..., 0], rgb01[..., 1], rgb01[..., 2]
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def sat_of(rgb01):
    mx = rgb01.max(axis=-1)
    mn = rgb01.min(axis=-1)
    sat = np.zeros_like(mx)
    valid = mx >= 1e-6
    sat[valid] = (mx[valid] - mn[valid]) / mx[valid]
    return sat


def classify_warm_cool(rgb01, sat):
    r, b = rgb01[..., 0], rgb01[..., 2]
    warm = (r > b + 0.06) & (sat > 0.12)
    cool = (b > r + 0.06) & (sat > 0.12)
    neutral = ~(warm | cool)
    return warm, cool, neutral


def band_means(values):
    band_h = H // N_BANDS
    out = []
    for i in range(N_BANDS):
        row0 = i * band_h
        row1 = H if i == N_BANDS - 1 else (i + 1) * band_h
        out.append(float(values[row0:row1, :].mean()))
    return out


def center_profile_of(luma):
    x0 = int(round(0.42 * W))
    x1 = int(round(0.58 * W))
    strip_h = H // N_PROFILE
    out = []
    for i in range(N_PROFILE):
        row0 = i * strip_h
        row1 = H if i == N_PROFILE - 1 else (i + 1) * strip_h
        out.append(float(luma[row0:row1, x0:x1].mean()))
    return out


def compute_metrics(rgb01):
    luma = luma_of(rgb01)
    sat = sat_of(rgb01)
    warm, cool, neutral = classify_warm_cool(rgb01, sat)
    n = luma.size
    return {
        "luma": luma,
        "sat": sat,
        "mean_luma": float(luma.mean()),
        "std_luma": float(luma.std()),
        "p95_luma": float(np.percentile(luma, 95)),
        "p99_luma": float(np.percentile(luma, 99)),
        "pct_below_05": float((luma < 0.05).sum()) / n * 100.0,
        "pct_above_080": float((luma > 0.80).sum()) / n * 100.0,
        "mean_sat": float(sat.mean()),
        "pct_neutral": float(neutral.sum()) / n * 100.0,
        "pct_cool": float(cool.sum()) / n * 100.0,
        "pct_warm": float(warm.sum()) / n * 100.0,
        "band_luma": band_means(luma),
        "band_sat": band_means(sat),
        "center_profile": center_profile_of(luma),
    }


def band_strip_image(band_luma):
    band_h = H // N_BANDS
    strip = np.zeros((H, W), dtype=np.float32)
    for i, v in enumerate(band_luma):
        row0 = i * band_h
        row1 = H if i == N_BANDS - 1 else (i + 1) * band_h
        strip[row0:row1, :] = v
    strip255 = np.clip(strip * 255.0, 0, 255).astype(np.uint8)
    return Image.fromarray(strip255, mode="L").convert("RGB")


def build_side_by_side(ref_rgb01, cap_rgb01, ref_metrics, cap_metrics, out_png):
    ref_img = Image.fromarray((ref_rgb01 * 255.0).astype(np.uint8), mode="RGB")
    cap_img = Image.fromarray((cap_rgb01 * 255.0).astype(np.uint8), mode="RGB")
    ref_strip = band_strip_image(ref_metrics["band_luma"])
    cap_strip = band_strip_image(cap_metrics["band_luma"])

    combined = Image.new("RGB", (W * 4, H))
    combined.paste(ref_img, (0, 0))
    combined.paste(ref_strip, (W, 0))
    combined.paste(cap_strip, (W * 2, 0))
    combined.paste(cap_img, (W * 3, 0))
    combined.save(out_png)


GATE_DEFS = [
    ("1 mean luma", lambda m: m["mean_luma"], "0.271 +/- 0.035",
     lambda m: abs(m["mean_luma"] - 0.271) <= 0.035),
    ("2 luma std", lambda m: m["std_luma"], "0.116 +/- 0.030",
     lambda m: abs(m["std_luma"] - 0.116) <= 0.030),
    ("3 p95 luma", lambda m: m["p95_luma"], "<= 0.52",
     lambda m: m["p95_luma"] <= 0.52),
    ("4 p99 luma", lambda m: m["p99_luma"], "<= 0.62",
     lambda m: m["p99_luma"] <= 0.62),
    ("5 pixels below luma 0.05", lambda m: m["pct_below_05"], "<= 5.0 %",
     lambda m: m["pct_below_05"] <= 5.0),
    ("6 pixels above luma 0.80", lambda m: m["pct_above_080"], "<= 0.05 %",
     lambda m: m["pct_above_080"] <= 0.05),
    ("7 mean saturation", lambda m: m["mean_sat"], "0.164 +/- 0.040",
     lambda m: abs(m["mean_sat"] - 0.164) <= 0.040),
    ("8 neutral pixels", lambda m: m["pct_neutral"], ">= 75 %",
     lambda m: m["pct_neutral"] >= 75.0),
    ("9 cool pixels", lambda m: m["pct_cool"], "10% to 25%",
     lambda m: 10.0 <= m["pct_cool"] <= 25.0),
    ("10 warm pixels", lambda m: m["pct_warm"], "<= 1.2 %",
     lambda m: m["pct_warm"] <= 1.2),
    ("11 luminance inversion", lambda m: m["band_luma"][0] - m["band_luma"][11],
     ">= 0.18", lambda m: (m["band_luma"][0] - m["band_luma"][11]) >= 0.18),
    ("12 saturation gradient", lambda m: m["band_sat"][11] - m["band_sat"][0],
     ">= 0.04", lambda m: (m["band_sat"][11] - m["band_sat"][0]) >= 0.04),
    ("13 bright fog band", lambda m: (sum(m["center_profile"][5:7]) / 2.0 -
                                       sum(m["center_profile"][3:5]) / 2.0),
     "mean(cp[5:7]) > mean(cp[3:5])",
     lambda m: (sum(m["center_profile"][5:7]) / 2.0) >
     (sum(m["center_profile"][3:5]) / 2.0)),
]


def run_gates(metrics):
    rows = []
    all_pass = True
    for name, actual_fn, required, pass_fn in GATE_DEFS:
        actual = actual_fn(metrics)
        passed = bool(pass_fn(metrics))
        all_pass = all_pass and passed
        rows.append({
            "gate": name,
            "pass": passed,
            "actual": actual,
            "required": required,
        })
    return rows, all_pass


def print_table(rows):
    print("%-28s | %-6s | %10s | %s" % ("GATE", "RESULT", "ACTUAL", "REQUIRED"))
    print("-" * 70)
    for r in rows:
        status = "PASS" if r["pass"] else "FAIL"
        print("%-28s | %-6s | %10.4f | %s" % (r["gate"], status, r["actual"], r["required"]))


def print_bands(ref_metrics, cap_metrics):
    print()
    print("12-band luma (top=0 to bottom=11):")
    print("  reference: " + " ".join("%.3f" % v for v in ref_metrics["band_luma"]))
    print("  capture:   " + " ".join("%.3f" % v for v in cap_metrics["band_luma"]))
    deltas = [cap_metrics["band_luma"][i] - ref_metrics["band_luma"][i] for i in range(N_BANDS)]
    print("  delta:     " + " ".join("%+.3f" % v for v in deltas))
    worst = sorted(range(N_BANDS), key=lambda i: abs(deltas[i]), reverse=True)[:3]
    print()
    print("three worst bands:")
    for i in worst:
        print("  band %2d: ref %.3f  cap %.3f  delta %+.3f" %
              (i, ref_metrics["band_luma"][i], cap_metrics["band_luma"][i], deltas[i]))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("reference")
    parser.add_argument("capture")
    parser.add_argument("--out", required=True)
    args = parser.parse_args()

    try:
        ref_rgb01 = load_rgb01(args.reference)
    except Exception as e:
        print("FATAL: could not load reference image %s: %s" % (args.reference, e))
        sys.exit(2)

    try:
        cap_rgb01 = load_rgb01(args.capture)
    except Exception as e:
        print("FATAL: could not load capture image %s: %s" % (args.capture, e))
        sys.exit(2)

    cap_metrics = compute_metrics(cap_rgb01)

    if cap_metrics["mean_luma"] < 0.005:
        print("FATAL: capture is essentially black. Did you run with --headless, or "
              "quit before frame_post_draw?")
        sys.exit(2)

    ref_metrics = compute_metrics(ref_rgb01)

    rows, all_pass = run_gates(cap_metrics)
    passed_count = sum(1 for r in rows if r["pass"])

    print_table(rows)
    print()
    print("%d/%d gates passed" % (passed_count, len(rows)))
    print_bands(ref_metrics, cap_metrics)

    out_json = args.out + ".json"
    out_png = args.out + ".png"

    with open(out_json, "w") as f:
        json.dump({
            "reference": args.reference,
            "capture": args.capture,
            "gates": rows,
            "passed_count": passed_count,
            "gate_count": len(rows),
            "all_pass": all_pass,
            "reference_metrics": {k: v for k, v in ref_metrics.items()
                                   if k not in ("luma", "sat")},
            "capture_metrics": {k: v for k, v in cap_metrics.items()
                                 if k not in ("luma", "sat")},
        }, f, indent=2)

    build_side_by_side(ref_rgb01, cap_rgb01, ref_metrics, cap_metrics, out_png)

    print()
    print("wrote %s and %s" % (out_json, out_png))
    print()
    print("LOOK AT THE PNG. Do not write a review entry from the JSON alone.")

    sys.exit(0 if all_pass else 1)


if __name__ == "__main__":
    main()
