import {useEffect, useState} from "react";
import type {FC, ReactNode} from "react";
import {
  AbsoluteFill,
  Audio,
  Img,
  OffthreadVideo,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {CaptionLine} from "../components/CaptionLine";
import {TransferLogoReveal} from "../components/TransferLogoReveal";
import {TransferStepCard} from "../components/TransferStepCard";

type SceneProps = {
  durationInFrames: number;
  children: ReactNode;
};

const TransferScene: FC<SceneProps> = ({durationInFrames, children}) => {
  const frame = useCurrentFrame();
  const fadeIn = interpolate(frame, [0, 16], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const fadeOut = interpolate(frame, [durationInFrames - 16, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        opacity: Math.min(fadeIn, fadeOut),
        justifyContent: "center",
        alignItems: "center",
        padding: "120px 88px",
        color: "#f8fafc",
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

const getSceneDurations = (totalFrames: number) => {
  const weights = [0.2, 0.2, 0.2, 0.2, 0.2];
  const base = weights.map((weight) => Math.max(1, Math.floor(totalFrames * weight)));
  const sum = base.reduce((acc, value) => acc + value, 0);
  base[base.length - 1] += totalFrames - sum;
  return base;
};

export const BitBridgeTransferAdVertical: FC = () => {
  const frame = useCurrentFrame();
  const {durationInFrames, fps} = useVideoConfig();
  const sceneDurations = getSceneDurations(durationInFrames);
  const [hasVoiceover, setHasVoiceover] = useState(false);
  const [hasBgMusic, setHasBgMusic] = useState(false);
  const [hasWhooshFx, setHasWhooshFx] = useState(false);
  const [hasConfirmFx, setHasConfirmFx] = useState(false);
  const [hasBgVideoPrimary, setHasBgVideoPrimary] = useState(false);
  const [hasBgVideoSecondary, setHasBgVideoSecondary] = useState(false);

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
    const testVideoFile = (
      fileName: string,
      onSuccess: () => void,
      onError: () => void,
    ) => {
      const probe = document.createElement("video");
      probe.src = staticFile(fileName);
      probe.preload = "metadata";
      probe.onloadeddata = onSuccess;
      probe.onerror = onError;
    };

    testAudioFile("transfer-voiceover.wav", () => setHasVoiceover(true), () => setHasVoiceover(false));
    testAudioFile("bg-music.mp3", () => setHasBgMusic(true), () => setHasBgMusic(false));
    testAudioFile(
      "Remotion-ads-files/mixkit-fast-rocket-whoosh-1714.wav",
      () => setHasWhooshFx(true),
      () => setHasWhooshFx(false),
    );
    testAudioFile(
      "Remotion-ads-files/mixkit-high-tech-bleep-2521.wav",
      () => setHasConfirmFx(true),
      () => setHasConfirmFx(false),
    );
    testVideoFile(
      "Remotion-ads-files/5197677-uhd_2160_3840_25fps.mp4",
      () => setHasBgVideoPrimary(true),
      () => setHasBgVideoPrimary(false),
    );
    testVideoFile(
      "Remotion-ads-files/220941_medium.mp4",
      () => setHasBgVideoSecondary(true),
      () => setHasBgVideoSecondary(false),
    );
  }, []);

  const sceneStarts = [
    0,
    sceneDurations[0],
    sceneDurations[0] + sceneDurations[1],
    sceneDurations[0] + sceneDurations[1] + sceneDurations[2],
    sceneDurations[0] + sceneDurations[1] + sceneDurations[2] + sceneDurations[3],
  ];

  const pulse = 0.85 + Math.sin((frame / fps) * 2.2) * 0.08;
  const ctaScale = spring({
    fps,
    frame: Math.max(0, frame - sceneStarts[4]),
    from: 0.9,
    to: 1,
    durationInFrames: 22,
  });
  const brandLogoOpacity = interpolate(frame, [sceneStarts[0] + 8, sceneStarts[0] + 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{fontFamily: "Sora, Montserrat, Avenir Next, sans-serif"}}>
      {hasBgVideoPrimary ? (
        <OffthreadVideo
          src={staticFile("Remotion-ads-files/5197677-uhd_2160_3840_25fps.mp4")}
          muted
          loop
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            filter: "brightness(0.44) saturate(1.15)",
          }}
        />
      ) : (
        <AbsoluteFill
          style={{
            background:
              "radial-gradient(circle at 20% 10%, #064e3b 0%, #020617 50%, #01030b 100%)",
          }}
        />
      )}
      {hasBgVideoSecondary ? (
        <OffthreadVideo
          src={staticFile("Remotion-ads-files/220941_medium.mp4")}
          muted
          loop
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: 0.13,
            mixBlendMode: "screen",
          }}
        />
      ) : null}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 20% 10%, rgba(16,185,129,0.18), transparent 35%), radial-gradient(circle at 80% 90%, rgba(20,184,166,0.2), transparent 40%), linear-gradient(180deg, rgba(2,6,23,0.38), rgba(2,6,23,0.78))",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(148,163,184,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.08) 1px, transparent 1px)",
          backgroundSize: "150px 150px",
          opacity: 0.3,
        }}
      />

      {hasVoiceover ? (
        <Audio
          src={staticFile("transfer-voiceover.wav")}
          volume={(f) =>
            interpolate(f, [0, 12], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })
          }
        />
      ) : null}
      {hasBgMusic ? <Audio src={staticFile("bg-music.mp3")} volume={0.16} /> : null}
      {hasWhooshFx
        ? sceneStarts.slice(1).map((startFrame) => (
            <Sequence key={`whoosh-fx-${startFrame}`} from={startFrame} durationInFrames={16}>
              <Audio src={staticFile("Remotion-ads-files/mixkit-fast-rocket-whoosh-1714.wav")} volume={0.24} />
            </Sequence>
          ))
        : null}
      {hasConfirmFx ? (
        <Sequence from={sceneStarts[4] + 26} durationInFrames={12}>
          <Audio src={staticFile("Remotion-ads-files/mixkit-high-tech-bleep-2521.wav")} volume={0.3} />
        </Sequence>
      ) : null}
      <div
        style={{
          position: "absolute",
          top: 42,
          right: 42,
          zIndex: 50,
          padding: "10px 12px",
          borderRadius: 16,
          background: "rgba(2,6,23,0.45)",
          border: "1px solid rgba(148,163,184,0.35)",
          backdropFilter: "blur(2px)",
          opacity: brandLogoOpacity,
        }}
      >
        <Img
          src={staticFile("logo.png")}
          style={{
            width: 118,
            height: "auto",
            opacity: 0.95,
          }}
        />
      </div>

      <Sequence from={sceneStarts[0]} durationInFrames={sceneDurations[0]}>
        <TransferScene durationInFrames={sceneDurations[0]}>
          <TransferLogoReveal />
          <div style={{position: "absolute", bottom: 180, width: 820, display: "grid", gap: 12}}>
            <CaptionLine text="Global Transfers. Local Confidence." />
            <CaptionLine text="Send Smarter, Settle Faster." color="#6ee7b7" />
          </div>
        </TransferScene>
      </Sequence>

      <Sequence from={sceneStarts[1]} durationInFrames={sceneDurations[1]}>
        <TransferScene durationInFrames={sceneDurations[1]}>
          <TransferStepCard
            icon="send.svg"
            title="Initiate in Seconds"
            detail="Start transfers quickly with a clear fee and total before confirmation."
            accent="#6ee7b7"
          />
        </TransferScene>
      </Sequence>

      <Sequence from={sceneStarts[2]} durationInFrames={sceneDurations[2]}>
        <TransferScene durationInFrames={sceneDurations[2]}>
          <TransferStepCard
            icon="user-check.svg"
            title="Verify and Route Securely"
            detail="Recipient checks and secure transfer rails protect every transaction."
            accent="#2dd4bf"
          />
        </TransferScene>
      </Sequence>

      <Sequence from={sceneStarts[3]} durationInFrames={sceneDurations[3]}>
        <TransferScene durationInFrames={sceneDurations[3]}>
          <TransferStepCard
            icon="check.svg"
            title="Track to Completion"
            detail="Live status updates keep you informed from send to delivered."
            accent="#34d399"
          />
        </TransferScene>
      </Sequence>

      <Sequence from={sceneStarts[4]} durationInFrames={sceneDurations[4]}>
        <TransferScene durationInFrames={sceneDurations[4]}>
          <div style={{display: "grid", gap: 26, width: "100%", placeItems: "center"}}>
            <Img
              src={staticFile("Remotion-ads-files/shield.svg")}
              style={{width: 120, height: 120, opacity: pulse}}
            />
            <CaptionLine text="Reliable Cross-Border Flow, Built for Scale" />
            <CaptionLine text="bitbridgeglobal.com" color="#6ee7b7" />
            <div
              style={{
                marginTop: 14,
                padding: "18px 38px",
                borderRadius: 999,
                border: "1px solid rgba(52,211,153,0.7)",
                background: "linear-gradient(90deg, rgba(6,78,59,0.8), rgba(13,148,136,0.55))",
                fontSize: 34,
                letterSpacing: 0.8,
                textTransform: "uppercase",
                transform: `scale(${ctaScale})`,
              }}
            >
              Start Transfer Flow
            </div>
          </div>
        </TransferScene>
      </Sequence>
    </AbsoluteFill>
  );
};
