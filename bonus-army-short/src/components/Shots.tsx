import React from "react";
import { AbsoluteFill, interpolate, staticFile, useCurrentFrame } from "remotion";
import { appear, easeOutExpo, microLife, slamIn, stepped } from "../motion";
import { FONT_BODY, FONT_HEAD, INK, MARGIN, PAPER, RED, W, H } from "../theme";
import { Rough } from "./Rough";
import { Stamp } from "./Stamp";

const sf = (s: string) => staticFile(s);

// Full-bleed treated photo (newsreel-style): slow push/drift + micro-life.
export const FullBleed: React.FC<{
  src: string;
  from: number;
  duration: number;
  dir?: 1 | -1;
  zoomFrom?: number;
  zoomTo?: number;
  objectPosition?: string;
}> = ({ src, from, duration, dir = 1, zoomFrom = 1.04, zoomTo = 1.09, objectPosition = "center" }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame - from, [0, duration], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const ml = microLife(frame, 6);
  const z = zoomFrom + (zoomTo - zoomFrom) * p;
  return (
    <AbsoluteFill style={{ overflow: "hidden", background: "#000" }}>
      <img
        src={sf(src)}
        style={{
          position: "absolute", width: "112%", height: "112%", left: "-6%", top: "-6%",
          objectFit: "cover", objectPosition,
          transform: `translateX(${(p - 0.5) * 22 * dir + ml.x}px) scale(${z})`,
          filter: "contrast(1.03)",
        }}
      />
    </AbsoluteFill>
  );
};

// Extreme close crop cutaway (detail insert) — reuses an existing photo.
export const DetailInsert: React.FC<{
  src: string; from: number; duration: number; focus?: string; zoom?: number;
}> = ({ src, from, duration, focus = "50% 40%", zoom = 2.4 }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame - from, [0, duration], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const ml = microLife(frame, 9);
  return (
    <AbsoluteFill style={{ overflow: "hidden", background: "#000" }}>
      <img
        src={sf(src)}
        style={{
          position: "absolute", width: "100%", height: "100%",
          objectFit: "cover", objectPosition: focus,
          transform: `scale(${zoom + p * 0.06}) translate(${ml.x}px, ${ml.y}px)`,
          filter: "contrast(1.05) brightness(0.98)",
        }}
      />
      <AbsoluteFill style={{ background: "radial-gradient(60% 60% at 50% 45%, transparent 40%, rgba(10,8,6,0.55))" }} />
    </AbsoluteFill>
  );
};

// 2-3 photos sliding in side-by-side (list phrases), red stamps ON the images.
export const MultiPanel: React.FC<{
  panels: Array<{ src: string; label?: string; focus?: string }>;
  from: number; stagger?: number;
}> = ({ panels, from, stagger = 8 }) => {
  const frame = useCurrentFrame();
  const n = panels.length;
  return (
    <AbsoluteFill style={{ display: "flex", flexDirection: "row", background: "#0b0a09" }}>
      {panels.map((p, i) => {
        const at = from + i * stagger;
        const s = slamIn(frame, at, 6);
        return (
          <div key={i} style={{ flex: 1, position: "relative", overflow: "hidden", borderLeft: i ? "3px solid #0b0a09" : undefined }}>
            <img
              src={sf(p.src)}
              style={{
                position: "absolute", width: "116%", height: "116%", left: "-8%", top: "-8%",
                objectFit: "cover", objectPosition: p.focus ?? "center",
                transform: `translateX(${(1 - s) * (i % 2 ? 60 : -60)}px) scale(${1.02 + (1 - s) * 0.05})`,
                opacity: Math.min(1, s * 1.5), filter: "contrast(1.04)",
              }}
            />
            {p.label && (
              <div style={{ position: "absolute", left: "50%", top: "72%", transform: "translateX(-50%)", opacity: appear(frame, at + 3, 3) }}>
                <Stamp at={at + 3} rotate={i % 2 ? 4 : -5} size={W * 0.026}>{p.label}</Stamp>
              </div>
            )}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// Darkened photo, soft spotlight slides onto a face, red rough box scribbles.
export const Spotlight: React.FC<{
  src: string; from: number; duration: number; focus?: string; spot?: { x: number; y: number }; boxAt?: number; label?: string;
}> = ({ src, from, duration, focus = "center", spot = { x: 42, y: 42 }, boxAt, label }) => {
  const frame = useCurrentFrame();
  const rel = frame - from;
  const rev = easeOutExpo(Math.max(0, Math.min(1, rel / 20)));
  const ml = microLife(frame, 5);
  const sx = 20 + (spot.x - 20) * rev;
  return (
    <AbsoluteFill style={{ overflow: "hidden", background: "#000" }}>
      <img src={sf(src)} style={{ position: "absolute", width: "108%", height: "108%", left: "-4%", top: "-4%", objectFit: "cover", objectPosition: focus, transform: `scale(${1.05}) translate(${ml.x}px,${ml.y}px)`, filter: "contrast(1.05)" }} />
      {/* darken everything except the spotlight */}
      <AbsoluteFill style={{ background: `radial-gradient(26% 34% at ${sx}% ${spot.y}%, rgba(0,0,0,0) 0%, rgba(6,5,4,${0.42 + 0.35 * rev}) 62%)` }} />
      {boxAt !== undefined && (
        <Rough shape="circle" at={boxAt} x={W * (spot.x / 100) - W * 0.13} y={H * (spot.y / 100) - H * 0.18} w={W * 0.26} h={H * 0.34} color={RED} strokeWidth={7} drawFrames={10} />
      )}
      {label && (
        <div style={{ position: "absolute", left: `${spot.x}%`, top: `${spot.y + 22}%`, transform: "translateX(-50%)", opacity: appear(frame, (boxAt ?? from) + 6, 4) }}>
          <Stamp at={(boxAt ?? from) + 6} rotate={-4} size={W * 0.02}>{label}</Stamp>
        </div>
      )}
    </AbsoluteFill>
  );
};

// 1932 DC map: red route lines draw in, location pins slam.
export const MapShot: React.FC<{
  src: string; from: number; duration: number;
  routes: Array<{ d: string; at: number }>;
  pins: Array<{ x: number; y: number; label: string; at: number }>;
}> = ({ src, from, duration, routes, pins }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame - from, [0, duration], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const ml = microLife(frame, 3);
  return (
    <AbsoluteFill style={{ overflow: "hidden", background: "#0b0a09" }}>
      <img src={sf(src)} style={{ position: "absolute", width: "116%", height: "116%", left: "-8%", top: "-8%", objectFit: "cover", objectPosition: "center", transform: `translateX(${(p - 0.5) * 30 + ml.x}px) scale(${1.06})`, filter: "sepia(0.15) contrast(1.02) brightness(1.02)" }} />
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        {routes.map((r, i) => {
          const t = Math.max(0, Math.min(1, (frame - r.at) / 16));
          return <path key={i} d={r.d} fill="none" stroke={RED} strokeWidth={7} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - t} opacity={0.92} />;
        })}
      </svg>
      {pins.map((pin, i) => {
        const s = slamIn(frame, pin.at, 5);
        return (
          <div key={i} style={{ position: "absolute", left: `${pin.x}%`, top: `${pin.y}%`, transform: `translate(-50%,-100%) scale(${Math.min(1, s * 1.3)})`, opacity: Math.min(1, s * 1.6), textAlign: "center" }}>
            <div style={{ width: 20, height: 20, borderRadius: "50%", background: RED, margin: "0 auto 4px", boxShadow: "0 3px 6px rgba(0,0,0,0.4)" }} />
            <div style={{ fontFamily: FONT_BODY, fontWeight: 800, fontSize: W * 0.012, letterSpacing: "0.1em", color: INK, background: PAPER, padding: "2px 8px" }}>{pin.label}</div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// Giant number/word on treated paper — the BigCard (max 2 uses total).
export const BigCard: React.FC<{
  value: React.ReactNode; sub?: string; from: number; hold?: number;
}> = ({ value, sub, from, hold = 20 }) => {
  const frame = useCurrentFrame();
  const s = slamIn(frame, from, 5);
  const und = stepped(frame);
  const uT = Math.max(0, Math.min(1, (und - (from + 4)) / 8));
  return (
    <AbsoluteFill style={{ background: PAPER, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
      <div style={{ position: "relative", transform: `scale(${0.9 + s * 0.12})`, opacity: Math.min(1, s * 1.5), textAlign: "center" }}>
        <div style={{ fontFamily: FONT_HEAD, fontWeight: 900, fontSize: W * 0.2, lineHeight: 0.9, color: INK, letterSpacing: "-0.02em" }}>{value}</div>
        <svg width={W * 0.5} height={60} style={{ position: "absolute", left: "50%", bottom: -30, transform: "translateX(-50%)", overflow: "visible" }}>
          <path d={`M 10 30 C ${W * 0.12} 14, ${W * 0.24} 44, ${W * 0.36} 26 S ${W * 0.46} 24, ${W * 0.49} 32`} fill="none" stroke={RED} strokeWidth={9} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - uT} />
        </svg>
        {sub && <div style={{ fontFamily: FONT_BODY, fontWeight: 800, fontSize: W * 0.02, letterSpacing: "0.16em", textTransform: "uppercase", color: INK, marginTop: 54, opacity: appear(frame, from + 6, 5) }}>{sub}</div>}
      </div>
    </AbsoluteFill>
  );
};

// Rip-reveal: the incoming shot is revealed through a torn-edge wipe.
export const RipReveal: React.FC<{
  at: number; duration?: number; children: React.ReactNode;
}> = ({ at, duration = 12, children }) => {
  const frame = useCurrentFrame();
  const t = Math.max(0, Math.min(1, (frame - at) / duration));
  if (frame < at) return null;
  // torn diagonal wipe via clip-path polygon whose seam sweeps across
  const x = t * 130 - 15;
  const seed = stepped(frame);
  const jag = (base: number) => base + (((seed + Math.floor(base)) % 5) - 2) * 1.2;
  const clip = `polygon(0 0, ${jag(x)}% 0, ${jag(x - 8)}% 25%, ${jag(x + 6)}% 50%, ${jag(x - 6)}% 75%, ${jag(x + 4)}% 100%, 0 100%)`;
  return (
    <AbsoluteFill style={{ clipPath: clip, WebkitClipPath: clip }}>
      {children}
    </AbsoluteFill>
  );
};

// A bordered photo slamming onto a paper scene, angled, casting shadow.
export const PhotoOnPaper: React.FC<{
  src: string; at: number; x: number; y: number; w: number; h: number; rotate?: number; focus?: string;
}> = ({ src, at, x, y, w, h, rotate = -2, focus = "center" }) => {
  const frame = useCurrentFrame();
  const s = slamIn(frame, at, 6);
  const ml = microLife(frame, 7);
  return (
    <div style={{ position: "absolute", left: x + ml.x, top: y + (1 - s) * 60 + ml.y, width: w, height: h, transform: `rotate(${rotate + ml.rot * 0.4}deg)`, opacity: Math.min(1, s * 1.5), background: "#f7f2e6", padding: 12, boxShadow: `0 ${10 + (1 - s) * 22}px ${18 + (1 - s) * 20}px rgba(20,16,12,0.4)` }}>
      <img src={sf(src)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: focus, display: "block", filter: "contrast(1.03)" }} />
    </div>
  );
};

export const SCREEN = { W, H, MARGIN };
