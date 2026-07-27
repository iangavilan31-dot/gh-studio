// Word-level caption timestamps via the official Remotion whisper.cpp pipeline
// (same as remotion-dev/template-tiktok). Run AFTER the final VO exists:
//
//   node scripts/whisper-captions.mjs
//
// Needs network access to huggingface.co on first run (model download).
// Refines public/captions.json + the word-level times inside public/timing.json.
// Chunk/event anchors in timing.json are exact by construction (chunk
// boundaries = separate TTS calls) and are NOT moved by this script unless
// --move-events is passed.
//
// After running, open Remotion Studio (`npm start`) and use the caption
// editor to click-fix any mistimed word.
import path from "node:path";
import fs from "node:fs";
import { execSync } from "node:child_process";
import {
  downloadWhisperModel,
  installWhisperCpp,
  transcribe,
  toCaptions,
} from "@remotion/install-whisper-cpp";

const root = path.join(process.cwd());
const whisperDir = path.join(root, ".whisper");
const voWav = path.join(root, "public", "audio", "vo.wav");
const vo16k = path.join(root, "pipeline", "build", "vo16k.wav");

if (!fs.existsSync(voWav)) {
  console.error("public/audio/vo.wav not found - run the VO pipeline first.");
  process.exit(1);
}

await installWhisperCpp({ to: whisperDir, version: "1.5.5" });
await downloadWhisperModel({ model: "medium.en", folder: whisperDir });

// whisper.cpp wants 16 kHz wav
fs.mkdirSync(path.dirname(vo16k), { recursive: true });
execSync(
  `npx remotion ffmpeg -y -i "${voWav}" -ar 16000 -ac 1 "${vo16k}"`,
  { stdio: "inherit" }
);

const whisperCppOutput = await transcribe({
  model: "medium.en",
  whisperPath: whisperDir,
  whisperCppVersion: "1.5.5",
  inputPath: vo16k,
  tokenLevelTimestamps: true,
});

const { captions } = toCaptions({ whisperCppOutput });
fs.writeFileSync(
  path.join(root, "public", "captions.json"),
  JSON.stringify(captions, null, 1)
);
console.log(`captions.json refined: ${captions.length} tokens`);

// Merge word times into timing.json (greedy sequential alignment on
// normalized text; chunk boundaries stay authoritative).
const timingPath = path.join(root, "public", "timing.json");
const timing = JSON.parse(fs.readFileSync(timingPath, "utf8"));
const norm = (s) => s.toLowerCase().replace(/[^\w']/g, "");
let ci = 0;
let matched = 0;
for (const beat of timing.beats) {
  for (const chunk of beat.chunks) {
    for (const word of chunk.words) {
      for (let j = ci; j < Math.min(ci + 6, captions.length); j++) {
        if (norm(captions[j].text) === norm(word.text)) {
          word.startMs = captions[j].startMs;
          word.endMs = captions[j].endMs;
          ci = j + 1;
          matched++;
          break;
        }
      }
    }
  }
}
fs.writeFileSync(timingPath, JSON.stringify(timing, null, 1));
console.log(
  `timing.json: ${matched} word times refined from whisper (events untouched)`
);
