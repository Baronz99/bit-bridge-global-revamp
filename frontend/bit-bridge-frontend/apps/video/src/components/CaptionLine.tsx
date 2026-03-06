import {interpolate, spring, useCurrentFrame, useVideoConfig} from "remotion";
import type {FC} from "react";

type CaptionLineProps = {
  text: string;
  color?: string;
  align?: "left" | "center";
};

export const CaptionLine: FC<CaptionLineProps> = ({
  text,
  color = "#f8fafc",
  align = "center",
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const rise = spring({
    frame,
    fps,
    from: 30,
    to: 0,
    damping: 200,
  });

  const opacity = interpolate(frame, [0, 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <p
      style={{
        margin: 0,
        fontSize: 52,
        fontWeight: 650,
        lineHeight: 1.15,
        letterSpacing: 0.35,
        color,
        textAlign: align,
        transform: `translateY(${rise}px)`,
        opacity,
        textShadow: "0 10px 35px rgba(15,23,42,0.45)",
      }}
    >
      {text}
    </p>
  );
};
