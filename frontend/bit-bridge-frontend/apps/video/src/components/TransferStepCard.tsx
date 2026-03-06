import type {FC} from "react";
import {
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

type TransferStepCardProps = {
  icon: string;
  title: string;
  detail: string;
  accent?: string;
};

export const TransferStepCard: FC<TransferStepCardProps> = ({
  icon,
  title,
  detail,
  accent = "#34d399",
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const lift = spring({
    frame,
    fps,
    from: 48,
    to: 0,
    damping: 130,
    mass: 0.7,
  });

  const opacity = interpolate(frame, [0, 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        width: 900,
        borderRadius: 30,
        border: "1px solid rgba(148,163,184,0.3)",
        background:
          "linear-gradient(160deg, rgba(2,6,23,0.86), rgba(10,20,40,0.82) 42%, rgba(6,78,59,0.35) 100%)",
        boxShadow: "0 24px 80px rgba(0,0,0,0.48)",
        padding: "40px 42px",
        transform: `translateY(${lift}px)`,
        opacity,
        display: "grid",
        gridTemplateColumns: "84px 1fr",
        columnGap: 24,
      }}
    >
      <div
        style={{
          width: 84,
          height: 84,
          borderRadius: 22,
          border: `1px solid ${accent}`,
          background: "rgba(2,6,23,0.66)",
          display: "grid",
          placeItems: "center",
        }}
      >
        <Img
          src={staticFile(`Remotion-ads-files/${icon}`)}
          style={{
            width: 42,
            height: 42,
            opacity: 0.98,
            filter:
              "invert(96%) sepia(12%) saturate(534%) hue-rotate(90deg) brightness(106%) contrast(101%) drop-shadow(0 0 8px rgba(110,231,183,0.45))",
          }}
        />
      </div>
      <div>
        <div
          style={{
            color: "#e2e8f0",
            fontSize: 48,
            fontWeight: 650,
            letterSpacing: -0.4,
            marginBottom: 10,
          }}
        >
          {title}
        </div>
        <div
          style={{
            color: "#cbd5e1",
            fontSize: 31,
            lineHeight: 1.3,
          }}
        >
          {detail}
        </div>
      </div>
    </div>
  );
};
