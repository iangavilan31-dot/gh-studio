import React from "react";
import { Audio, Sequence, staticFile, useVideoConfig } from "remotion";
import { ev, FPS, TIMING } from "../timing";
import { SFX_HITS } from "./sfxMap";

const sfx = (name: string) => staticFile(`audio/sfx/${name}.wav`);
const music = (name: string) => staticFile(`audio/music/${name}.wav`);

// VO + a tense music bed that ducks under narration and CUTS DEAD on "Army"
// (b7.armyCut), leaving room tone for 2 frames before the drone re-enters at b8.
export const Soundtrack: React.FC = () => {
  const { durationInFrames } = useVideoConfig();
  const armyCut = ev("b7.armyCut");
  const b8 = ev("b8.start");
  const total = durationInFrames;

  const evFrame = (name: string): number | null => {
    const ms = TIMING.events[name];
    return ms === undefined ? null : Math.round((ms / 1000) * FPS);
  };

  return (
    <>
      {/* room-tone bed under everything */}
      <Audio src={sfx("room-tone")} volume={0.18} loop />

      {/* VO — the anchor */}
      <Audio src={staticFile("audio/vo.wav")} volume={1} />

      {/* Music bed 1: tense piano + drone up to the dead cut, ducked -6dB */}
      <Sequence from={0} durationInFrames={armyCut}>
        <Audio src={music("tense")} volume={0.34} loop />
        <Audio src={music("drone")} volume={0.28} loop />
      </Sequence>
      {/* riser into the Army reveal */}
      <Sequence from={Math.max(0, armyCut - 45)} durationInFrames={45}>
        <Audio src={music("riser")} volume={0.4} />
      </Sequence>

      {/* --- 2 frames of near-silence (room tone only) at the cut --- */}

      {/* Music bed 2: drone re-enters at b8, colder, under the assault */}
      <Sequence from={b8} durationInFrames={Math.max(1, total - b8)}>
        <Audio src={music("drone")} volume={0.32} loop />
      </Sequence>

      {/* Event SFX */}
      {SFX_HITS.map((h, i) => {
        const base = evFrame(h.at);
        if (base === null) return null;
        const from = Math.max(0, base + (h.offset ?? 0));
        if (from >= total) return null;
        return (
          <Sequence key={i} from={from} durationInFrames={Math.min(90, total - from)}>
            <Audio src={sfx(h.file)} volume={h.vol ?? 0.8} />
          </Sequence>
        );
      })}
    </>
  );
};
