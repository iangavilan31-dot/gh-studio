import React from "react";
import { Audio, Sequence, staticFile, useVideoConfig } from "remotion";
import { ev, FPS, TIMING } from "../timing";
import manifest from "../../public/audio/sfx-manifest.json";

const sfx = (name: string) => staticFile(`audio/sfx/${name}.wav`);
const music = (name: string) => staticFile(`audio/music/${name}.wav`);

type EvHit = { at: string; offset?: number; layers: Array<[string, number]> };

// Drone-based bed (cuts DEAD clean on "Army"), room tone + vinyl crackle under
// everything, and every event's layered/aged SFX read from sfx-manifest.json.
export const Soundtrack: React.FC = () => {
  const { durationInFrames: total } = useVideoConfig();
  const armyCut = ev("b7.armyCut");
  const b8 = ev("b8.start");
  const evFrame = (name: string): number | null => {
    const ms = TIMING.events[name];
    return ms === undefined ? null : Math.round((ms / 1000) * FPS);
  };

  // global SFX trim so stacked events never turn to noise; the -14 LUFS
  // loudnorm in finish.sh sets the final level.
  const G = 0.5;
  return (
    <>
      {/* bed: soft room tone the whole run, never silence (no rattly crackle) */}
      <Audio src={sfx("room-tone")} volume={0.12} loop />

      {/* VO — the anchor */}
      <Audio src={staticFile("audio/vo.wav")} volume={1} />

      {/* single drone bed, ducked under VO; cuts DEAD on "Army" */}
      <Sequence from={0} durationInFrames={armyCut}>
        <Audio src={music("drone")} volume={0.26} loop />
      </Sequence>
      <Sequence from={Math.max(0, armyCut - 38)} durationInFrames={38}>
        <Audio src={music("riser")} volume={0.26} />
      </Sequence>
      {/* --- dead cut: room tone only across the turn --- */}
      <Sequence from={b8} durationInFrames={Math.max(1, total - b8)}>
        <Audio src={music("drone")} volume={0.3} loop />
      </Sequence>

      {/* event SFX from the manifest (trimmed, max 2 layers each) */}
      {(manifest.events as EvHit[]).map((h, i) => {
        const base = evFrame(h.at);
        if (base === null) return null;
        const from = Math.max(0, base + (h.offset ?? 0));
        if (from >= total) return null;
        return (
          <Sequence key={i} from={from} durationInFrames={Math.min(110, total - from)}>
            {h.layers.slice(0, 2).map(([file, gain], j) => (
              <Audio key={j} src={sfx(file)} volume={Math.min(0.7, gain * G)} />
            ))}
          </Sequence>
        );
      })}

      {/* B8 hoof build: 3 overlapping hooves distant->close (not a wall) */}
      {[0, 16, 34].map((off, i) => {
        const from = ev("b8.sabers") + off;
        if (from >= total) return null;
        return (
          <Sequence key={`hoof${i}`} from={from} durationInFrames={Math.min(55, total - from)}>
            <Audio src={sfx("hooves")} volume={0.22 + i * 0.1} />
          </Sequence>
        );
      })}
    </>
  );
};
