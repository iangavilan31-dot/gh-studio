import React from "react";
import { AbsoluteFill, interpolate, staticFile, useCurrentFrame } from "remotion";
import { microLife } from "../motion";
import { W } from "../theme";

// 2.5D parallax photo — "The Kid Stays In The Picture" depth from a still.
//   mode "layers": fg cutout (rembg) over inpainted bg plate; layers drift
//     opposite with scale + rotation divergence + depth haze (clean subjects).
//   mode "strip": robust cheat for crowds/wides — one image as a blurred bg
//     plate plus a bottom foreground strip that drifts 1.5x (no cutout edge).
// Lateral drift reads best in widescreen.
export const ParallaxPhoto: React.FC<{
  mode?: "layers" | "strip";
  src?: string; // strip mode / bg for layers if fg/bg not split
  fgSrc?: string;
  bgSrc?: string;
  from: number; // absolute start frame
  duration: number;
  dir?: 1 | -1; // drift direction
  bgDrift?: number;
  fgDrift?: number;
  objectPosition?: string;
  stripTop?: number; // strip mode: fraction from top where the fg strip begins
  seed?: number;
  scaleTo?: number;
}> = ({
  mode = "layers",
  src,
  fgSrc,
  bgSrc,
  from,
  duration,
  dir = 1,
  bgDrift = 26,
  fgDrift = 64,
  objectPosition = "center",
  stripTop = 0.66,
  seed = 2,
  scaleTo = 1.05,
}) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame - from, [0, duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const ml = microLife(frame, seed);
  const bgX = (p - 0.5) * bgDrift * dir + ml.x * 0.5;
  const fgX = -(p - 0.5) * fgDrift * dir + ml.x;
  const sc = 1 + (scaleTo - 1) * p;

  const img = (
    url: string,
    style: React.CSSProperties
  ): React.ReactNode => (
    <img
      src={staticFile(url)}
      style={{
        position: "absolute",
        width: "112%",
        height: "112%",
        left: "-6%",
        top: "-6%",
        objectFit: "cover",
        objectPosition,
        ...style,
      }}
    />
  );

  if (mode === "strip") {
    const s = src as string;
    return (
      <AbsoluteFill style={{ overflow: "hidden", background: "#0b0a09" }}>
        {/* bg plate: blurred, desaturated, slow drift */}
        {img(s, {
          transform: `translateX(${bgX}px) scale(${1.06 * sc})`,
          filter: "blur(3px) brightness(0.86)",
        })}
        {/* fg strip: bottom band, sharper, drifts 1.5x */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            clipPath: `inset(${stripTop * 100}% 0 0 0)`,
            WebkitClipPath: `inset(${stripTop * 100}% 0 0 0)`,
          }}
        >
          {img(s, {
            transform: `translateX(${fgX * 1.0}px) scale(${sc})`,
            filter: "contrast(1.03)",
          })}
        </div>
      </AbsoluteFill>
    );
  }

  // layers mode
  const bg = bgSrc ?? src!;
  const fg = fgSrc ?? src!;
  return (
    <AbsoluteFill style={{ overflow: "hidden", background: "#0b0a09" }}>
      {img(bg, {
        transform: `translateX(${bgX}px) scale(${1.03 * sc}) rotate(${ml.rot * 0.2}deg)`,
        filter: "blur(1px) brightness(0.92) saturate(0.95)",
      })}
      {img(fg, {
        transform: `translateX(${fgX}px) scale(${sc}) rotate(${-ml.rot * 0.3 + 0.3 * (p - 0.5)}deg)`,
      })}
    </AbsoluteFill>
  );
};

export const PARALLAX_W = W;
