# VO / audio pipeline

Everything timing-related in the video is data-driven from `public/timing.json`,
which is generated from the *actual synthesized narration*. No hand-typed frame
numbers anywhere in the comps.

```
script.json          the 12-beat script: chunks, display/spoken words, event anchors,
                     per-beat pacing (lengthScale) and pause structure (gaps)
vo_local.py          OFFLINE scratch VO (Mimic3 VITS onnx + gruut). Draft quality.
vo_chatterbox.py     FINAL VO (Chatterbox by Resemble AI, MIT). Needs HF access once.
assemble.py          chunks -> public/audio/vo.wav + timing.json + captions.json
sfx.py               seeded procedural SFX + music kit (network-free stand-ins)
../scripts/whisper-captions.mjs   refine word times via @remotion/install-whisper-cpp
```

## Regenerate everything (offline, as in the build container)

```bash
# venv with: onnxruntime soundfile scipy gruut gruut-lang-en phonemes2ids pyloudnorm
python pipeline/vo_local.py --voice-dir <voices>/hifi-tts_low --speaker 1
python pipeline/assemble.py
python pipeline/sfx.py
```

Voice files come from `MycroftAI/mimic3-voices` (en_US/hifi-tts_low; speaker 1
= dataset speaker 6097, median f0 ≈ 91 Hz). `onnxruntime.set_seed` keeps runs
reproducible.

## Upgrade to the final voice (open network required)

1. `pip install chatterbox-tts` and (optionally) record ~10s of a deep,
   measured documentary read as `ref.wav` for zero-shot cloning.
2. `python pipeline/vo_chatterbox.py --ref ref.wav`
3. `python pipeline/assemble.py`  (same command; it is engine-agnostic)
4. `node scripts/whisper-captions.mjs`  (word-accurate timestamps)
5. Fix any stray word in Remotion Studio's caption editor.
6. Post chain (already inside assemble.py): -14 LUFS, 80 Hz high-pass,
   0.2 s room reverb at 6% wet.

## Timing contract

- Every visual event reads `timing.json > events` ("b3.date1945", "b7.armyCut" …).
- Chunk starts are EXACT (each chunk is its own TTS call, silence-trimmed).
- Word times inside a chunk are phoneme-weight estimates until the whisper
  pass replaces them; the two named word-critical moments (b11 headline
  word-tracking, b1 "generals") should be verified after any VO change.
- Section-D beat windows are targets, not truths: the real beat boundaries in
  timing.json come from the audio and currently total 61.7 s (scratch voice;
  aim for ≤ 58 s after the Chatterbox pass by tightening gaps in script.json).

## SFX swap-in

`sfx.py` filenames are the contract (`paper-slam.wav`, `stamp.wav`, `hooves.wav`
…). Replace any of them with CC0 recordings (Pixabay/Freesound) at the same
path and the mix picks them up unchanged.
