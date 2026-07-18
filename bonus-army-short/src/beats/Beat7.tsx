import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Spotlight, FullBleed } from "../components/Shots";
import { FilmTexture } from "../layers/FilmTexture";
import { ev } from "../timing";

// B7 THE TURN: spotlight reveal on Hoover, red box; on "Army" the music cuts
// dead -> 2 frames black -> flash -> full-bleed newsreel of troops, splice jump.
export const Beat7: React.FC = () => {
  const frame = useCurrentFrame();
  const fStart = ev("b7.start");
  const fHoover = ev("b7.hoover");
  const fArmy = ev("b7.armyCut");
  const rel = frame - fArmy;

  // 2 frames of black at the dead cut
  if (rel >= 0 && rel < 2) return <AbsoluteFill style={{ background: "#050403" }} />;

  if (rel >= 2) {
    // splice jump: frame nudges 4px for 2 frames as the newsreel starts
    const jump = rel >= 2 && rel < 4 ? 4 : 0;
    return (
      <AbsoluteFill style={{ background: "#000", transform: `translateY(${jump}px)` }}>
        <FullBleed src="assets/final/bonus_march.png" from={fArmy + 2} duration={70} dir={1} zoomFrom={1.1} zoomTo={1.16} objectPosition="center 40%" />
        <FilmTexture intensity={0.85} scratches flicker halation flashFrames={[fArmy + 2]} seed={7} />
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Spotlight
        src="assets/final/hoover.png"
        from={fHoover}
        duration={60}
        focus="50% 26%"
        spot={{ x: 50, y: 32 }}
        boxAt={fHoover + 8}
      />
      <FilmTexture intensity={0.5} scratches seed={7} />
    </AbsoluteFill>
  );
};
