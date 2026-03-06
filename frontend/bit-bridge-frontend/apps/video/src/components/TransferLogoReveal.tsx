import type {FC} from "react";
import {
  AbsoluteFill,
  Img,
  OffthreadVideo,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export const TransferLogoReveal: FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const scale = spring({
    frame,
    fps,
    from: 0.82,
    to: 1,
    durationInFrames: 28,
  });

  const clipPulse = interpolate(frame, [0, 20, 40], [0.8, 1, 0.9], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const overlayOpacity = interpolate(frame, [0, 14, 32], [0, 0.75, 0.45], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{justifyContent: "center", alignItems: "center"}}>
      <div
        style={{
          position: "absolute",
          width: 620,
          height: 620,
          borderRadius: "50%",
          overflow: "hidden",
          transform: `scale(${clipPulse})`,
          boxShadow: "0 24px 70px rgba(0,0,0,0.52)",
          border: "1px solid rgba(110,231,183,0.35)",
        }}
      >
        <OffthreadVideo
          src={staticFile("Remotion-ads-files/220941_medium.mp4")}
          muted
          loop
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            filter: "brightness(0.55) saturate(1.2)",
          }}
        />
      </div>
      <div
        style={{
          position: "absolute",
          width: 620,
          height: 620,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(16,185,129,0.2) 0%, rgba(2,6,23,0) 68%)",
          opacity: overlayOpacity,
        }}
      />
      <Img
        src={staticFile("logo.png")}
        style={{
          width: 430,
          transform: `scale(${scale})`,
          filter: "drop-shadow(0 16px 42px rgba(0,0,0,0.55))",
        }}
      />
    </AbsoluteFill>
  );
};
