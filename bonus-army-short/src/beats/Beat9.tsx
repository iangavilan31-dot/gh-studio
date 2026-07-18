import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { FullBleed } from "../components/Shots";
import { FilmTexture } from "../layers/FilmTexture";
import { ev } from "../timing";
import { H, MARGIN, RED, W } from "../theme";
import { appear } from "../motion";
import { FONT_BODY } from "../theme";

// B9 THE FIRE: gas clouds rolling -> the burning camp at night, full-bleed,
// minimal graphics; heaviest film damage; HAND-TINT red-orange on the flames
// (the single colour accent of the film).
export const Beat9: React.FC = () => {
  const frame = useCurrentFrame();
  const fGas = ev("b9.gas");
  const fBurn = ev("b9.burned");
  const showBurn = frame >= fBurn - 2;

  if (!showBurn) {
    const haze = interpolate(frame - fGas, [0, 30], [0, 0.6], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    return (
      <AbsoluteFill style={{ background: "#000" }}>
        <FullBleed src="assets/final/bonus_march.png" from={fGas} duration={40} zoomFrom={1.06} zoomTo={1.12} objectPosition="center 45%" />
        <AbsoluteFill style={{ background: "radial-gradient(70% 60% at 45% 55%, rgba(220,220,210,0.5), transparent 70%)", opacity: haze, filter: "blur(20px)", transform: `translateX(${(frame - fGas) * 2}px)` }} />
        <div style={{ position: "absolute", left: MARGIN, top: H * 0.08, fontFamily: FONT_BODY, fontWeight: 800, fontSize: W * 0.02, letterSpacing: "0.2em", color: RED, opacity: appear(frame, fGas, 3), textShadow: "0 2px 8px #000" }}>TEAR GAS</div>
        <FilmTexture intensity={0.95} scratches flicker seed={9} />
      </AbsoluteFill>
    );
  }
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <FullBleed src="assets/final/bonus_burning.png" from={fBurn} duration={110} dir={1} zoomFrom={1.04} zoomTo={1.08} objectPosition="center 45%" fit="cover" />
      {/* hand-tint: faint red-orange breathing on the flames */}
      <AbsoluteFill
        style={{
          mixBlendMode: "overlay",
          background: "radial-gradient(45% 55% at 30% 62%, rgba(255,90,30,0.55), transparent 60%)",
          opacity: 0.35 + 0.12 * Math.sin((frame - fBurn) / 7),
        }}
      />
      <div style={{ position: "absolute", left: MARGIN, bottom: H * 0.1, fontFamily: FONT_BODY, fontWeight: 800, fontSize: W * 0.018, letterSpacing: "0.18em", color: "#f3d9c0", opacity: appear(frame, fBurn + 8, 6), textShadow: "0 2px 10px #000" }}>ANACOSTIA · JULY 28, 1932</div>
      <FilmTexture intensity={1} scratches flicker halation seed={9} />
    </AbsoluteFill>
  );
};
