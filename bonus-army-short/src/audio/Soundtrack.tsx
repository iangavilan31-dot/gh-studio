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

  return (
    <>
      {/* bed: room tone + faint vinyl crackle for the whole run, never silence */}
      <Audio src={sfx("room-tone")} volume={0.16} loop />
      <Audio src={sfx("projector")} volume={0.05} loop />

      {/* VO — the anchor */}
      <Audio src={staticFile("audio/vo.wav")} volume={1} />

      {/* drone bed, ducked under VO; sparse tension layered on top */}
      <Sequence from={0} durationInFrames={armyCut}>
        <Audio src={music("drone")} volume={0.3} loop />
        <Audio src={music("tense")} volume={0.16} loop />
      </Sequence>
      <Sequence from={Math.max(0, armyCut - 40)} durationInFrames={40}>
        <Audio src={music("riser")} volume={0.34} />
      </Sequence>
      {/* --- dead cut: room tone only across the turn --- */}
      <Sequence from={b8} durationInFrames={Math.max(1, total - b8)}>
        <Audio src={music("drone")} volume={0.34} loop />
      </Sequence>

      {/* event SFX from the manifest */}
      {(manifest.events as EvHit[]).map((h, i) => {
        const base = evFrame(h.at);
        if (base === null) return null;
        const from = Math.max(0, base + (h.offset ?? 0));
        if (from >= total) return null;
        return (
          <Sequence key={i} from={from} durationInFrames={Math.min(120, total - from)}>
            {h.layers.map(([file, gain], j) => (
              <Audio key={j} src={sfx(file)} volume={gain} />
            ))}
          </Sequence>
        );
      })}

      {/* B8 hoof build: overlapping hooves from distant->close across the beat */}
      {[0, 10, 20, 34, 50].map((off, i) => {
        const from = ev("b8.sabers") + off;
        if (from >= total) return null;
        return (
          <Sequence key={`hoof${i}`} from={from} durationInFrames={Math.min(60, total - from)}>
            <Audio src={sfx("hooves")} volume={0.3 + i * 0.14} />
          </Sequence>
        );
      })}
    </>
  );
};
