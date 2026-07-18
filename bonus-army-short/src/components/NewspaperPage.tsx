import React from "react";
import { useCurrentFrame } from "remotion";
import { FONT_HEAD, FONT_SERIF_BODY, INK } from "../theme";
import { HiWord } from "./Type";

// A recreated period front page (reality patch: headline recreations allowed
// when the scan is paywalled; words are real+verified, only the typesetting is
// rebuilt, then treated). Headline sharp; body greeked + blurred (real scans
// keep body text illegible for copyright + focus). Aged newsprint + ink spread.
const NEWSPRINT = "#E7E1D2";
const NEWSPRINT_DEEP = "#D9D1BD";

export type Deck = { text: string; size: number; hi?: [number, number]; anchor?: string };

const greek = (n: number, seed: number): string => {
  const words = [
    "washington", "veterans", "bonus", "army", "camp", "troops", "capitol",
    "the", "of", "a", "were", "marchers", "government", "service", "congress",
    "president", "hoover", "cavalry", "eviction", "anacostia", "gas", "fire",
    "senate", "vote", "certificate", "nineteen", "thirty", "two", "district",
  ];
  let s = seed;
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    out.push(words[s % words.length]);
  }
  const j = out.join(" ");
  return j.charAt(0).toUpperCase() + j.slice(1) + ".";
};

export const NewspaperPage: React.FC<{
  masthead: string;
  date: string;
  decks: Deck[]; // stacked headline decks (top = biggest)
  reveal?: (word: string, idx: number) => number; // per-word highlight 0..1
  width: number;
  columns?: number;
  seed?: number;
  style?: React.CSSProperties;
}> = ({ masthead, date, decks, reveal, width, columns = 5, seed = 7, style }) => {
  useCurrentFrame();
  const pageH = width * 1.34;
  let wordIdx = 0;
  return (
    <div
      style={{
        width,
        height: pageH,
        background: `linear-gradient(160deg, ${NEWSPRINT} 0%, ${NEWSPRINT_DEEP} 130%)`,
        boxShadow: "0 30px 70px rgba(20,16,12,0.45)",
        padding: width * 0.045,
        boxSizing: "border-box",
        position: "relative",
        // ink-spread / aged scan feel
        filter: "contrast(1.02) saturate(0.9)",
        ...style,
      }}
    >
      {/* masthead */}
      <div
        style={{
          textAlign: "center",
          fontFamily: FONT_HEAD,
          fontStyle: "italic",
          fontWeight: 900,
          fontSize: width * 0.075,
          color: INK,
          fontVariant: "small-caps",
          borderBottom: `3px double ${INK}`,
          paddingBottom: 8,
          letterSpacing: "0.01em",
        }}
      >
        {masthead}
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontFamily: FONT_SERIF_BODY,
          fontSize: width * 0.016,
          color: INK,
          opacity: 0.7,
          padding: "5px 2px 12px",
          borderBottom: `1px solid ${INK}55`,
          marginBottom: width * 0.02,
        }}
      >
        <span>WASHINGTON, D.C.</span>
        <span>{date}</span>
        <span>PRICE THREE CENTS</span>
      </div>

      {/* headline decks — sharp */}
      <div style={{ textAlign: "center", marginBottom: width * 0.025 }}>
        {decks.map((d, di) => (
          <div
            key={di}
            data-anchor={d.anchor}
            style={{
              fontFamily: FONT_HEAD,
              fontWeight: di === 0 ? 900 : 800,
              fontSize: d.size,
              lineHeight: 1.02,
              color: INK,
              letterSpacing: "-0.005em",
              textTransform: di === 0 ? "uppercase" : "none",
            }}
          >
            {d.text.split(" ").map((w, i) => {
              const r = reveal ? reveal(w, wordIdx++) : 0;
              const isAnchor = d.anchor && w.replace(/[^A-Za-z.]/g, "") === d.anchor;
              return (
                <React.Fragment key={i}>
                  <span data-word={isAnchor ? d.anchor : undefined}>
                    {r > 0 ? <HiWord reveal={r} seed={40 + i}>{w}</HiWord> : w}
                  </span>{" "}
                </React.Fragment>
              );
            })}
          </div>
        ))}
      </div>

      {/* body columns — greeked + blurred (illegible by design) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${columns}, 1fr)`,
          gap: width * 0.02,
          columnRule: `1px solid ${INK}44`,
          filter: "blur(0.7px)",
          opacity: 0.72,
          flex: 1,
        }}
      >
        {Array.from({ length: columns }).map((_, c) => (
          <div
            key={c}
            style={{
              fontFamily: FONT_SERIF_BODY,
              fontSize: width * 0.0125,
              lineHeight: 1.34,
              color: INK,
              textAlign: "justify",
              borderRight: c < columns - 1 ? `1px solid ${INK}22` : undefined,
              paddingRight: width * 0.012,
            }}
          >
            {greek(48 + ((c * 7 + seed) % 20), seed + c * 31)}
          </div>
        ))}
      </div>
    </div>
  );
};
