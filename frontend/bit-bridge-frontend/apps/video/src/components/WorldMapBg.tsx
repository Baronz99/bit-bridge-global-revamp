import {AbsoluteFill, interpolate, useCurrentFrame} from "remotion";
import type {FC} from "react";

export const WorldMapBg: FC = () => {
  const frame = useCurrentFrame();
  const drift = interpolate(frame, [0, 300], [0, -140], {
    extrapolateLeft: "clamp",
    extrapolateRight: "extend",
  });

  const pulse = interpolate(frame % 60, [0, 30, 60], [0.25, 0.7, 0.25], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(circle at 50% 10%, #1e293b 0%, #020617 60%, #01020a 100%)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: "-10%",
          transform: `translateY(${drift}px)`,
          opacity: 0.36,
          backgroundImage:
            "radial-gradient(circle at 20% 30%, rgba(34,211,238,0.5) 0, rgba(34,211,238,0.06) 8%, transparent 13%), radial-gradient(circle at 50% 50%, rgba(34,211,238,0.5) 0, rgba(34,211,238,0.05) 8%, transparent 14%), radial-gradient(circle at 78% 40%, rgba(34,211,238,0.45) 0, rgba(34,211,238,0.04) 8%, transparent 14%), radial-gradient(circle at 35% 72%, rgba(34,211,238,0.4) 0, rgba(34,211,238,0.03) 9%, transparent 14%), radial-gradient(circle at 70% 76%, rgba(34,211,238,0.35) 0, rgba(34,211,238,0.02) 9%, transparent 14%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(90deg, transparent 0%, rgba(56,189,248,0.16) 50%, transparent 100%)",
          opacity: pulse,
          mixBlendMode: "screen",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(148,163,184,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.05) 1px, transparent 1px)",
          backgroundSize: "120px 120px",
          opacity: 0.35,
        }}
      />
    </AbsoluteFill>
  );
};
