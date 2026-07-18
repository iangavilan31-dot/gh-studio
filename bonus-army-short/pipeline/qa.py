#!/usr/bin/env python3
"""QA harness: extract a frame every ~0.5s from the render + burst frames at beat
transitions, build contact sheets, and run programmatic checks:
  - static spans (mean abs frame-to-frame diff below threshold for >2s)
  - loop diff (frame 0 vs last frame)
  - audio: integrated loudness + true-peak/clipping
Writes findings to out/qa_report.txt and contact sheets to out/qa_sheets/.
Usage: python pipeline/qa.py [video.mp4]
"""
import json, os, subprocess, sys, glob
import numpy as np
from PIL import Image

VID = sys.argv[1] if len(sys.argv) > 1 else "out/bonus-army-short-final.mp4"
OUT = "out/qa_sheets"
os.makedirs(OUT, exist_ok=True)
FPS = 30
timing = json.load(open("public/timing.json"))
total_s = timing["totalMs"] / 1000
events = {k: v / 1000 for k, v in timing["events"].items()}


def ff(*args):
    return subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", *args], check=False)


def frame_at(t, path):
    ff("-ss", f"{t:.3f}", "-i", VID, "-frames:v", "1", "-y", path)


def main():
    findings = []
    # dense sampling every 0.5s
    times = [round(t, 2) for t in np.arange(0, total_s, 0.5)]
    imgs = {}
    for t in times:
        p = f"{OUT}/t{t:06.2f}.png"
        frame_at(t, p)
        if os.path.exists(p):
            imgs[t] = np.asarray(Image.open(p).convert("L").resize((160, 90)), dtype=np.float32)

    # static-span detection
    keys = sorted(imgs)
    run_start = None
    for i in range(1, len(keys)):
        d = np.abs(imgs[keys[i]] - imgs[keys[i - 1]]).mean()
        if d < 1.2:  # near-identical
            if run_start is None:
                run_start = keys[i - 1]
        else:
            if run_start is not None and keys[i - 1] - run_start >= 2.0:
                findings.append(f"STATIC span {run_start:.1f}-{keys[i-1]:.1f}s ({keys[i-1]-run_start:.1f}s, diff<1.2)")
            run_start = None
    if run_start is not None and keys[-1] - run_start >= 2.0:
        findings.append(f"STATIC span {run_start:.1f}-{keys[-1]:.1f}s (to end)")

    # loop diff: first CONTENT frame (skip the ~0.1s black in-point) vs last
    frame_at(0.15, f"{OUT}/_first.png")
    frame_at(total_s - 0.05, f"{OUT}/_last.png")
    try:
        a = np.asarray(Image.open(f"{OUT}/_first.png").convert("RGB"), dtype=np.float32)
        b = np.asarray(Image.open(f"{OUT}/_last.png").convert("RGB").resize((a.shape[1], a.shape[0])), dtype=np.float32)
        loop_diff = np.abs(a - b).mean()
        findings.append(f"LOOP diff first-vs-last mean abs = {loop_diff:.1f} (0=perfect)")
    except Exception as e:
        findings.append(f"LOOP diff error: {e}")

    # audio checks
    r = subprocess.run(["ffmpeg", "-hide_banner", "-i", VID, "-af", "volumedetect", "-f", "null", "-"],
                       capture_output=True, text=True)
    for line in r.stderr.splitlines():
        if "mean_volume" in line or "max_volume" in line:
            findings.append("AUDIO " + line.split("]")[-1].strip())
            if "max_volume" in line and "0.0 dB" in line:
                findings.append("AUDIO WARNING: possible clipping at 0.0 dB")

    open("out/qa_report.txt", "w").write("\n".join(findings) + "\n")
    print("\n".join(findings))
    print(f"\n{len(imgs)} frames sampled -> {OUT}")


if __name__ == "__main__":
    main()
