import React from "react";
import { useCurrentFrame } from "remotion";
import { NewspaperScene, Shot } from "../NewspaperScene";
import { Headline, HiWord } from "../components/Type";
import { Label } from "../components/Graphics";
import { beatWords, ev, wordReveal } from "../timing";
import { FONT_BODY, FONT_MONO, H, INK, MARGIN, RED, W } from "../theme";
import { appear } from "../motion";

// "So they camped across the river from the Capitol. Peacefully. For months."
// Hosts the one slow glide (Anacostia): camera drifts from Capitol to the camp.
export const Beat5: React.FC = () => {
  const frame = useCurrentFrame();
  const words = beatWords("b5");
  const peace = words.find((w) => w.text.replace(/[^a-z]/gi, "") === "Peacefully");
  const fMonths = ev("b5.months");

  const shots: Shot[] = [
    { at: ev("b5.start"), type: "cut", scale: 1.18, x: 260, y: -120 },
    { at: ev("b5.camped") + 12, type: "glide", scale: 1.18, x: -260, y: -120, dur: 78 },
  ];

  return (
    <NewspaperScene shots={shots}>
      {/* ---- the map band (wide; the glide crosses it) ---- */}
      <div style={{ position: "absolute", left: 0, top: H * 0.42, width: W, height: 360 }}>
        {/* river */}
        <svg width={W} height={360} style={{ position: "absolute", inset: 0 }}>
          <path
            d={`M ${W * 0.42} -20 C ${W * 0.5} 120, ${W * 0.36} 220, ${W * 0.52} 380`}
            fill="none"
            stroke={INK}
            strokeWidth={10}
            strokeOpacity={0.5}
          />
          <text x={W * 0.44} y={200} fontFamily={FONT_MONO} fontSize={22} fill={INK} opacity={0.55}>
            ANACOSTIA R.
          </text>
        </svg>
        {/* Capitol marker */}
        <div style={{ position: "absolute", left: W * 0.12, top: 120, textAlign: "center" }}>
          <svg width={70} height={54} style={{ display: "block", margin: "0 auto 6px" }}>
            <polygon points="35,4 66,22 4,22" fill={INK} />
            <rect x="10" y="22" width="50" height="4" fill={INK} />
            {[14, 26, 38, 50].map((cx) => (
              <rect key={cx} x={cx} y="28" width="6" height="20" fill={INK} />
            ))}
            <rect x="6" y="48" width="58" height="5" fill={INK} />
          </svg>
          <div style={{ fontFamily: FONT_BODY, fontWeight: 800, fontSize: 30, letterSpacing: "0.14em" }}>
            U.S. CAPITOL
          </div>
        </div>
        {/* Camp marker */}
        <div style={{ position: "absolute", left: W * 0.66, top: 120, textAlign: "center" }}>
          <div style={{ width: 26, height: 26, borderRadius: 13, background: RED, margin: "18px auto" }} />
          <div style={{ fontFamily: FONT_BODY, fontWeight: 800, fontSize: 30, letterSpacing: "0.1em", color: RED }}>
            B.E.F. CAMP
          </div>
          <div style={{ fontFamily: FONT_MONO, fontSize: 22, color: INK, opacity: 0.6 }}>
            ANACOSTIA FLATS
          </div>
        </div>
      </div>

      {/* copy overlays (fixed to the frame, not the glide, so kept readable) */}
      <div style={{ position: "absolute", left: MARGIN, top: H * 0.16, width: W - MARGIN * 2 }}>
        <Label at={ev("b5.start")} bar>
          Across the river
        </Label>
        <Headline size={92} style={{ marginTop: 24 }}>
          They camped in sight of the Capitol.
        </Headline>
      </div>
      <div style={{ position: "absolute", left: MARGIN, top: H * 0.72, opacity: appear(frame, ev("b5.peacefully"), 3) }}>
        <Headline size={120} italic>
          <HiWord reveal={peace ? wordReveal(frame, peace.start, 2, 6) : 0} seed={13}>
            Peacefully.
          </HiWord>
        </Headline>
        <Headline size={72} style={{ marginTop: 10, opacity: appear(frame, fMonths, 3) }}>
          For <span style={{ color: RED }}>months.</span>
        </Headline>
      </div>
    </NewspaperScene>
  );
};
