import React from "react";
import { useCurrentFrame } from "remotion";
import { NewspaperScene, Shot } from "../NewspaperScene";
import { Headline } from "../components/Type";
import { Label } from "../components/Graphics";
import { VoteTally } from "../components/VoteTally";
import { ev } from "../timing";
import { H, MARGIN, RED, W } from "../theme";

// "Congress voted on their bonus. The Senate said no. 62 to 18."
export const Beat6: React.FC = () => {
  const frame = useCurrentFrame();
  const fSenate = ev("b6.senate");
  const fCard = ev("b6.voteCard");
  const showTally = frame >= fSenate - 3;

  const shots: Shot[] = [
    { at: ev("b6.start"), type: "cut", scale: 1.04 },
    { at: fSenate, type: "cut", scale: 1.0, y: 0 },
    { at: fCard, type: "punch", scale: 1.08, y: 20, dur: 5 },
  ];

  return (
    <NewspaperScene shots={shots}>
      {!showTally ? (
        <div style={{ position: "absolute", left: MARGIN, top: H * 0.24, width: W - MARGIN * 2 }}>
          <Label at={ev("b6.start")} bar>
            June 17, 1932
          </Label>
          <Headline size={128} style={{ marginTop: 26 }}>
            Congress voted on their bonus.
          </Headline>
        </div>
      ) : (
        <div style={{ position: "absolute", left: MARGIN, top: H * 0.16, width: W - MARGIN * 2 }}>
          <Headline size={104}>
            The Senate said <span style={{ color: RED }}>no.</span>
          </Headline>
          <VoteTally at={fCard} stampAt={fCard + 14} style={{ marginTop: H * 0.14 }} />
        </div>
      )}
    </NewspaperScene>
  );
};
