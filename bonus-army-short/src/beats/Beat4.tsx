import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { ParallaxPhoto } from "../components/ParallaxPhoto";
import { DetailInsert } from "../components/Shots";
import { Label } from "../components/Graphics";
import { FilmTexture } from "../layers/FilmTexture";
import { ev } from "../timing";
import { H, MARGIN, W } from "../theme";

// B4: 2.5D parallax breadline (bg drifts left, men pull forward) -> hard cut
// detail insert of one gaunt face, spotlight vignette. Heavy projector flicker.
export const Beat4: React.FC = () => {
  const frame = useCurrentFrame();
  const fStart = ev("b4.start");
  const fStarv = ev("b4.starving");
  const showFace = frame >= fStarv - 2;
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {!showFace ? (
        <ParallaxPhoto
          mode="layers"
          bgSrc="assets/final/breadline_bg.png"
          fgSrc="assets/final/breadline_fg.png"
          from={fStart}
          duration={90}
          dir={-1}
          bgDrift={22}
          fgDrift={54}
          objectPosition="center 30%"
        />
      ) : (
        <DetailInsert src="assets/final/breadline.png" from={fStarv} duration={44} focus="40% 46%" zoom={1.8} bright={1.3} />
      )}
      <div style={{ position: "absolute", left: MARGIN, top: H * 0.08 }}>
        <Label at={fStart + 6} bar mono>THE GREAT DEPRESSION &middot; 1932</Label>
      </div>
      <FilmTexture intensity={0.75} scratches flicker seed={4} />
    </AbsoluteFill>
  );
};
