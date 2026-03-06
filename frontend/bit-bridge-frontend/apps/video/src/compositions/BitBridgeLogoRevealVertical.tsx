import {useEffect, useMemo, useState} from "react";
import type {FC} from "react";
import {
  AbsoluteFill,
  Audio,
  Img,
  OffthreadVideo,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export const BitBridgeLogoRevealVertical: FC = () => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const [musicTrack, setMusicTrack] = useState<string | null>(null);
  const [hasWhooshFx, setHasWhooshFx] = useState(false);

  useEffect(() => {
    const testAudioFile = (
      fileName: string,
      onSuccess: () => void,
      onError: () => void,
    ) => {
      const probe = document.createElement("audio");
      probe.src = staticFile(fileName);
      probe.preload = "metadata";
      probe.oncanplay = onSuccess;
      probe.onerror = onError;
    };

    testAudioFile(
      "Remotion-ads-files/mixkit-the-king-857.wav",
      () => setMusicTrack("Remotion-ads-files/mixkit-the-king-857.wav"),
      () => {},
    );
    testAudioFile(
      "logo-bg-music.mp3",
      () => setMusicTrack((current) => current ?? "logo-bg-music.mp3"),
      () => {},
    );
    testAudioFile(
      "bg-music.mp3",
      () => setMusicTrack((current) => current ?? "bg-music.mp3"),
      () => {},
    );
    testAudioFile(
      "Remotion-ads-files/mixkit-fast-rocket-whoosh-1714.wav",
      () => setHasWhooshFx(true),
      () => setHasWhooshFx(false),
    );
  }, []);

  const logoScale = spring({
    frame,
    fps,
    from: 0.7,
    to: 1,
    durationInFrames: 34,
  });

  const logoOpacity = interpolate(frame, [0, 10, 28], [0, 0.8, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const logoLift = interpolate(frame, [0, 24, 44], [70, -10, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const logoRotate = interpolate(frame, [0, 20, 42], [-8, 2, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const logoBlur = interpolate(frame, [0, 12, 24], [10, 2, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const sweepX = interpolate(frame, [8, 42], [-380, 380], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const pulse = 0.88 + Math.sin((frame / fps) * 3.2) * 0.1;
  const ringRotate = interpolate(frame, [0, durationInFrames], [0, 190], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const bgMusicVolume = useMemo(() => {
    return (f: number) => {
      const fadeIn = interpolate(f, [0, 20], [0, 0.2], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
      const fadeOut = interpolate(f, [durationInFrames - 28, durationInFrames], [0.2, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
      return Math.min(fadeIn, fadeOut);
    };
  }, [durationInFrames]);

  return (
    <AbsoluteFill style={{fontFamily: "Sora, Montserrat, Avenir Next, sans-serif"}}>
      <OffthreadVideo
        src={staticFile("Remotion-ads-files/220941_medium.mp4")}
        muted
        loop
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          filter: "brightness(0.42) saturate(1.25)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 50% 50%, rgba(16,185,129,0.24), rgba(2,6,23,0.86) 65%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(148,163,184,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.08) 1px, transparent 1px)",
          backgroundSize: "140px 140px",
          opacity: 0.25,
        }}
      />

      {musicTrack ? <Audio src={staticFile(musicTrack)} volume={bgMusicVolume} /> : null}
      {hasWhooshFx ? (
        <Audio src={staticFile("Remotion-ads-files/mixkit-fast-rocket-whoosh-1714.wav")} volume={0.28} />
      ) : null}

      <AbsoluteFill style={{justifyContent: "center", alignItems: "center"}}>
        <div
          style={{
            position: "absolute",
            width: 700,
            height: 700,
            borderRadius: "50%",
            border: "1px solid rgba(110,231,183,0.4)",
            transform: `rotate(${ringRotate}deg) scale(${pulse})`,
            boxShadow: "inset 0 0 55px rgba(16,185,129,0.2)",
          }}
        />
        <div
          style={{
            position: "absolute",
            width: 560,
            height: 560,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(52,211,153,0.28) 0%, rgba(2,6,23,0) 70%)",
            opacity: interpolate(frame, [0, 16, 36], [0.2, 0.9, 0.55], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        />
        <Img
          src={staticFile("logo.png")}
          style={{
            width: 460,
            transform: `translateY(${logoLift}px) rotate(${logoRotate}deg) scale(${logoScale})`,
            opacity: logoOpacity,
            filter: `blur(${logoBlur}px) drop-shadow(0 24px 60px rgba(0,0,0,0.55))`,
          }}
        />
        <div
          style={{
            position: "absolute",
            width: 470,
            height: 250,
            background:
              "linear-gradient(100deg, rgba(255,255,255,0) 0%, rgba(236,253,245,0.35) 45%, rgba(255,255,255,0) 100%)",
            transform: `translateX(${sweepX}px) rotate(-9deg)`,
            mixBlendMode: "screen",
            opacity: interpolate(frame, [8, 22, 42], [0, 0.55, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: 250,
            display: "grid",
            justifyItems: "center",
            gap: 10,
          }}
        >
          <div
            style={{
              padding: "12px 24px",
              borderRadius: 999,
              border: "1px solid rgba(110,231,183,0.5)",
              background: "linear-gradient(90deg, rgba(2,6,23,0.7), rgba(6,78,59,0.45))",
              backdropFilter: "blur(2px)",
              boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
              color: "#a7f3d0",
              fontSize: 18,
              letterSpacing: 2.6,
              textTransform: "uppercase",
              fontWeight: 600,
            }}
          >
            Trusted Digital Infrastructure
          </div>
          <div
            style={{
              fontSize: 46,
              lineHeight: 1,
              letterSpacing: -0.8,
              color: "#f0fdf4",
              fontWeight: 700,
              textShadow: "0 10px 30px rgba(6,95,70,0.35)",
            }}
          >
            Bit Bridge Global
          </div>
          <div
            style={{
              width: 320,
              height: 3,
              borderRadius: 8,
              background: "linear-gradient(90deg, rgba(16,185,129,0), rgba(110,231,183,0.9), rgba(16,185,129,0))",
            }}
          />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
