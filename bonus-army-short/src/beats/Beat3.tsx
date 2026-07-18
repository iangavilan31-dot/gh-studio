import React from "react";
import { useCurrentFrame } from "remotion";
import { NewspaperScene, Shot } from "../NewspaperScene";
import { Headline, HiWord } from "../components/Type";
import { Label } from "../components/Graphics";
import { DateCircle } from "../components/DateCircle";
import { beatWords, ev, wordReveal } from "../timing";
import { FONT_MONO, H, INK, MARGIN, PAPER, RED, W } from "../theme";
import { appear } from "../motion";

// "The government owed them a bonus for their service. Payable... in 1945."
export const Beat3: React.FC = () => {
  const frame = useCurrentFrame();
  const words = beatWords("b3");
  const owed = words.find((w) => w.text.replace(/[^a-z]/gi, "") === "owed");
  const fPayable = ev("b3.payable");
  const f1945 = ev("b3.date1945");
  const show1945 = frame >= fPayable - 3;

  const shots: Shot[] = [
    { at: ev("b3.start"), type: "cut", scale: 1.03 },
    { at: fPayable, type: "cut", scale: 1.08, y: -20 },
    { at: f1945, type: "punch", scale: 1.14, y: 40, dur: 5 },
  ];

  return (
    <NewspaperScene shots={shots}>
      {!show1945 ? (
        <div style={{ position: "absolute", left: MARGIN, top: H * 0.18, width: W - MARGIN * 2 }}>
          <Label at={ev("b3.start")} bar>
            A Promise
          </Label>
          <Headline size={110} style={{ marginTop: 30 }}>
            The government{" "}
            <HiWord reveal={owed ? wordReveal(frame, owed.start, 2, 6) : 0} seed={7}>
              owed
            </HiWord>{" "}
            them a bonus for their service.
          </Headline>
          {/* service-certificate flavour card */}
          <div
            style={{
              marginTop: 60,
              maxWidth: W * 0.72,
              border: `3px double ${INK}`,
              background: PAPER,
              padding: "26px 34px",
              transform: "rotate(-1deg)",
              boxShadow: "0 12px 22px rgba(20,16,12,0.18)",
              opacity: appear(frame, ev("b3.start") + 20, 6),
            }}
          >
            <div style={{ fontFamily: FONT_MONO, fontSize: 26, letterSpacing: "0.22em", color: RED }}>
              ADJUSTED SERVICE CERTIFICATE
            </div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 40, marginTop: 12, color: INK }}>
              PAYABLE ON DEMAND — <span style={{ color: RED }}>1945</span>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div style={{ position: "absolute", left: MARGIN, top: H * 0.16 }}>
            <Headline size={96} italic>
              Payable&hellip;
            </Headline>
          </div>
          <DateCircle
            year="1945"
            note="13 YEARS AWAY"
            at={f1945}
            circleAt={f1945 + 6}
            x={MARGIN + 30}
            y={H * 0.34}
          />
        </>
      )}
    </NewspaperScene>
  );
};
