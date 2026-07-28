#!/usr/bin/env python3
"""Synthetic-image unit checks for compare_reference.py's core math.

There is no reference.png yet (see docs/PROGRESS.md), so this stands in for the
reference-vs-reference self-test until it arrives. Run directly:
    python3 tools/test_compare_reference.py
"""

import sys
import numpy as np
from PIL import Image

sys.path.insert(0, __file__.rsplit("/", 1)[0])
import compare_reference as cr

FAILURES = []


def check(label, cond, detail=""):
    status = "PASS" if cond else "FAIL"
    print("[%s] %s %s" % (status, label, detail))
    if not cond:
        FAILURES.append(label)


def close(a, b, tol=1e-3):
    return abs(a - b) <= tol


# a) solid RGB(128,128,128) -> luma ~0.502 everywhere, saturation 0.0,
#    neutral 100%, warm 0%, cool 0%
gray = np.full((cr.H, cr.W, 3), 128, dtype=np.uint8)
gray01 = gray.astype(np.float32) / 255.0
m_gray = cr.compute_metrics(gray01)
check("a) gray mean_luma ~0.502", close(m_gray["mean_luma"], 0.502, 1e-3),
      "got %.4f" % m_gray["mean_luma"])
check("a) gray mean_sat 0.0", close(m_gray["mean_sat"], 0.0),
      "got %.4f" % m_gray["mean_sat"])
check("a) gray neutral 100%%", close(m_gray["pct_neutral"], 100.0),
      "got %.2f" % m_gray["pct_neutral"])
check("a) gray warm 0%%", close(m_gray["pct_warm"], 0.0),
      "got %.2f" % m_gray["pct_warm"])
check("a) gray cool 0%%", close(m_gray["pct_cool"], 0.0),
      "got %.2f" % m_gray["pct_cool"])

# b) solid RGB(200,60,60) -> warm 100%, cool 0%
red = np.zeros((cr.H, cr.W, 3), dtype=np.uint8)
red[..., 0] = 200
red[..., 1] = 60
red[..., 2] = 60
red01 = red.astype(np.float32) / 255.0
m_red = cr.compute_metrics(red01)
check("b) warm-red warm 100%%", close(m_red["pct_warm"], 100.0),
      "got %.2f" % m_red["pct_warm"])
check("b) warm-red cool 0%%", close(m_red["pct_cool"], 0.0),
      "got %.2f" % m_red["pct_cool"])

# c) 640x360, top half white and bottom half black ->
#    band_luma[0] = 1.0, band_luma[11] = 0.0, gate 11 evaluates to 1.0
half = np.zeros((cr.H, cr.W, 3), dtype=np.uint8)
half[: cr.H // 2, :, :] = 255
half01 = half.astype(np.float32) / 255.0
m_half = cr.compute_metrics(half01)
check("c) band_luma[0] == 1.0", close(m_half["band_luma"][0], 1.0),
      "got %.4f" % m_half["band_luma"][0])
check("c) band_luma[11] == 0.0", close(m_half["band_luma"][11], 0.0),
      "got %.4f" % m_half["band_luma"][11])
gate11_value = m_half["band_luma"][0] - m_half["band_luma"][11]
check("c) gate 11 value == 1.0", close(gate11_value, 1.0),
      "got %.4f" % gate11_value)

print()
if FAILURES:
    print("%d check(s) failed: %s" % (len(FAILURES), ", ".join(FAILURES)))
    sys.exit(1)
print("all synthetic checks passed")
sys.exit(0)
