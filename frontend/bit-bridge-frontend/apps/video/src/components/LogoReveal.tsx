import {AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig} from "remotion";
import type {FC} from "react";

export const LogoReveal: FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const scale = spring({
    frame,
    fps,
    from: 0.75,
    to: 1,
    durationInFrames: 26,
  });

  const glow = interpolate(frame, [0, 20, 40], [0.35, 0.8, 0.5], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const ringSpin = interpolate(frame, [0, 90], [0, 75], {
    extrapolateLeft: "clamp",
    extrapolateRight: "extend",
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          position: "absolute",
          width: 620,
          height: 620,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(56,189,248,0.22) 0%, rgba(2,6,23,0) 68%)",
          filter: "blur(10px)",
          opacity: glow,
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 540,
          height: 540,
          borderRadius: "50%",
          border: "1px solid rgba(103,232,249,0.32)",
          transform: `rotate(${ringSpin}deg)`,
          boxShadow: "inset 0 0 40px rgba(34,211,238,0.16)",
        }}
      />
      <Img
        src={staticFile("logo.png")}
        style={{
          width: 440,
          transform: `scale(${scale})`,
          filter: "drop-shadow(0 20px 40px rgba(0,0,0,0.45))",
        }}
      />
    </AbsoluteFill>
  );
};
