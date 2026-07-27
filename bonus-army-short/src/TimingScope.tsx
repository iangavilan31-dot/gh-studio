import React from "react";
import { AbsoluteFill, Audio, staticFile, useCurrentFrame } from "remotion";
import { FPS, TIMING } from "./timing";

// DIAGNOSTIC visualization only - deliberately unstyled (mono type, flat).
// Shows the timing backbone working: beats, active caption word, event
// anchors firing. This is NOT the video's design language (that work is
// gated on reference-analysis.md approval).

const allWords = TIMING.beats.flatMap((b) =>
  b.chunks.flatMap((c) => c.words.map((w) => ({ ...w, beat: b.id, chunk: c.id })))
);

const eventList = Object.entries(TIMING.events)
  .map(([name, ms]) => ({ name, ms }))
  .sort((a, b) => a.ms - b.ms);

export const TimingScope: React.FC = () => {
  const frame = useCurrentFrame();
  const ms = (frame / FPS) * 1000;

  const beat = TIMING.beats.find((b) => ms >= b.startMs && ms < b.endMs);
  const word = allWords.find((w) => ms >= w.startMs && ms < w.endMs);
  const recentEvents = eventList.filter((e) => ms >= e.ms && ms - e.ms < 900);
  const progress = ms / TIMING.totalMs;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#F3EEE3",
        fontFamily: "monospace",
        color: "#141210",
        padding: 60,
      }}
    >
      <Audio src={staticFile("audio/preview-mix.wav")} />
      <div style={{ fontSize: 34, opacity: 0.55 }}>
        TIMING SCOPE — diagnostic, not the look
      </div>
      <div style={{ fontSize: 40, marginTop: 30 }}>
        t = {(ms / 1000).toFixed(2)}s &nbsp; beat {beat?.id ?? "—"}
      </div>
      <div
        style={{
          marginTop: 140,
          height: 340,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ fontSize: 120, fontWeight: 700, textAlign: "center" }}>
          {word?.text ?? ""}
        </div>
      </div>
      <div style={{ marginTop: 60, minHeight: 260 }}>
        {recentEvents.map((e) => (
          <div
            key={e.name}
            style={{
              fontSize: 44,
              color: "#D9331F",
              opacity: Math.max(0, 1 - (ms - e.ms) / 900),
            }}
          >
            ⚑ {e.name}
          </div>
        ))}
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 80,
          left: 60,
          right: 60,
          height: 16,
          background: "#14121022",
        }}
      >
        <div
          style={{
            width: `${progress * 100}%`,
            height: "100%",
            background: "#D9331F",
          }}
        />
        {TIMING.beats.map((b) => (
          <div
            key={b.id}
            style={{
              position: "absolute",
              left: `${(b.startMs / TIMING.totalMs) * 100}%`,
              top: -10,
              width: 2,
              height: 36,
              background: "#141210",
            }}
          />
        ))}
      </div>
    </AbsoluteFill>
  );
};
