import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { ParallaxPhoto } from "../components/ParallaxPhoto";
import { DetailInsert } from "../components/Shots";
import { Label } from "../components/Graphics";
import { FilmTexture } from "../layers/FilmTexture";
import { ev } from "../timing";
import { H, MARGIN, W } from "../theme";
import { appear } from "../motion";

// B5: THE glide — 2.5D parallax Anacostia camp wide drifting right->left across
// the widescreen frame; stepped labels; two short detail inserts on "Peacefully".
export const Beat5: React.FC = () => {
  const frame = useCurrentFrame();
  const fStart = ev("b5.start");
  const fPeace = ev("b5.peacefully");
  const fMonths = ev("b5.months");
  const insertA = fPeace + 2;
  const inInsertA = frame >= insertA && frame < insertA + 15;
  const inInsertB = frame >= insertA + 15 && frame < insertA + 30;

  if (inInsertA) {
    return (
      <AbsoluteFill style={{ background: "#000" }}>
        <DetailInsert src="assets/final/camp_life.png" from={insertA} duration={16} focus="50% 30%" zoom={2.6} />
        <FilmTexture intensity={0.5} scratches seed={5} leakWindows={[[insertA, insertA + 15, "rgba(255,180,90,1)"]]} />
      </AbsoluteFill>
    );
  }
  if (inInsertB) {
    return (
      <AbsoluteFill style={{ background: "#000" }}>
        <DetailInsert src="assets/final/anacostia_wide.png" from={insertA + 15} duration={16} focus="70% 60%" zoom={2.8} />
        <FilmTexture intensity={0.5} scratches seed={6} />
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill style={{ background: "#0b0a09" }}>
      <ParallaxPhoto mode="strip" src="assets/final/anacostia_wide.png" from={fStart} duration={130} dir={-1} bgDrift={40} fgDrift={70} stripTop={0.52} objectPosition="center 55%" scaleTo={1.06} />
      <div style={{ position: "absolute", left: MARGIN, top: H * 0.1 }}>
        <Label at={fStart + 6} bar mono>ANACOSTIA FLATS</Label>
        <div style={{ marginTop: 12 }}>
          <Label at={fStart + 14} mono size={W * 0.014}>MAY &ndash; JULY 1932</Label>
        </div>
      </div>
      {frame >= fMonths && (
        <div style={{ position: "absolute", right: MARGIN, bottom: H * 0.12, opacity: appear(frame, fMonths, 4) }}>
          <Label at={fMonths} bar>FOR MONTHS</Label>
        </div>
      )}
      <FilmTexture intensity={0.42} scratches seed={5} leakWindows={[[fStart, fStart + 60, "rgba(255,190,110,1)"]]} />
    </AbsoluteFill>
  );
};
