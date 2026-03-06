import {interpolate, spring, useCurrentFrame, useVideoConfig} from "remotion";
import type {FC} from "react";

type FeatureCardProps = {
  title: string;
  body: string;
  accent?: string;
};

export const FeatureCard: FC<FeatureCardProps> = ({
  title,
  body,
  accent = "#22d3ee",
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const lift = spring({
    frame,
    fps,
    from: 42,
    to: 0,
    damping: 120,
    mass: 0.6,
  });

  const opacity = interpolate(frame, [0, 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        width: 900,
        padding: "54px 52px",
        borderRadius: 34,
        border: "1px solid rgba(148,163,184,0.32)",
        background:
          "linear-gradient(150deg, rgba(15,23,42,0.92), rgba(2,6,23,0.86) 45%, rgba(8,47,73,0.38) 100%)",
        boxShadow: "0 32px 90px rgba(0,0,0,0.5)",
        transform: `translateY(${lift}px)`,
        opacity,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: -180,
          left: -180,
          width: 360,
          height: 360,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(34,211,238,0.18), rgba(2,6,23,0))",
          filter: "blur(6px)",
          transform: `rotate(${frame * 0.9}deg)`,
        }}
      />
      <div
        style={{
          height: 8,
          width: 140,
          borderRadius: 12,
          backgroundColor: accent,
          marginBottom: 24,
        }}
      />
      <h2
        style={{
          fontSize: 68,
          lineHeight: 1.05,
          margin: 0,
          marginBottom: 20,
          letterSpacing: -0.6,
        }}
      >
        {title}
      </h2>
      <p
        style={{
          margin: 0,
          fontSize: 40,
          lineHeight: 1.3,
          color: "rgba(226,232,240,0.94)",
        }}
      >
        {body}
      </p>
    </div>
  );
};
