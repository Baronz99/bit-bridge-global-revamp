import {useEffect, useState} from "react";
import type {FC, ReactNode} from "react";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {CaptionLine} from "../components/CaptionLine";
import {FeatureCard} from "../components/FeatureCard";
import {LogoReveal} from "../components/LogoReveal";
import {WorldMapBg} from "../components/WorldMapBg";

type SceneProps = {
  index: number;
  durationInFrames: number;
  children: ReactNode;
};

const Scene: FC<SceneProps> = ({index, durationInFrames, children}) => {
  const frame = useCurrentFrame();
  const {width} = useVideoConfig();
  const transitionFrames = 14;

  const fadeIn = interpolate(frame, [0, transitionFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const fadeOut = interpolate(
    frame,
    [durationInFrames - transitionFrames, durationInFrames],
    [1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );

  const yDrift = interpolate(frame, [0, durationInFrames], [26, -12], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const scale = interpolate(frame, [0, durationInFrames], [1.04, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const sweepX = interpolate(
    frame + index * 9,
    [0, durationInFrames],
    [-width * 0.6, width * 1.25],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        padding: "120px 84px",
        color: "#f8fafc",
        opacity: Math.min(fadeIn, fadeOut),
        transform: `translateY(${yDrift}px) scale(${scale})`,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(135deg, rgba(34,211,238,0) 0%, rgba(34,211,238,0.08) 45%, rgba(34,211,238,0) 70%)",
          transform: `translateX(${sweepX}px)`,
          filter: "blur(6px)",
          mixBlendMode: "screen",
        }}
      />
      <div style={{position: "relative", width: "100%"}}>{children}</div>
    </AbsoluteFill>
  );
};

const getSceneDurations = (totalFrames: number) => {
  const weights = [0.18, 0.2, 0.2, 0.2, 0.22];
  const base = weights.map((weight) => Math.max(1, Math.floor(totalFrames * weight)));
  const sum = base.reduce((acc, value) => acc + value, 0);
  base[base.length - 1] += totalFrames - sum;
  return base;
};

const BANNED_VIDEO_SERVICES = ["gift card", "gift cards", "giftcard", "giftcards"];

const removeBannedServices = (services: string[]) => {
  return services.filter((service) => {
    const normalized = service.toLowerCase().trim();
    return !BANNED_VIDEO_SERVICES.some((blocked) => normalized.includes(blocked));
  });
};

export const BitBridgeAdVertical: FC = () => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const sceneDurations = getSceneDurations(durationInFrames);
  const [hasBgMusic, setHasBgMusic] = useState(false);
  const [hasWhoosh, setHasWhoosh] = useState(false);
  const serviceList = removeBannedServices([
    "Airtime",
    "Data",
    "Cable",
    "Electricity",
    "Secure digital payments",
  ]);

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

    testAudioFile("bg-music.mp3", () => setHasBgMusic(true), () => setHasBgMusic(false));
    testAudioFile("whoosh.wav", () => setHasWhoosh(true), () => setHasWhoosh(false));
  }, []);

  const sceneStarts = [
    0,
    sceneDurations[0],
    sceneDurations[0] + sceneDurations[1],
    sceneDurations[0] + sceneDurations[1] + sceneDurations[2],
    sceneDurations[0] + sceneDurations[1] + sceneDurations[2] + sceneDurations[3],
  ];

  const backgroundMusicVolume = (currentFrame: number) => {
    const fadeIn = interpolate(currentFrame, [0, 28], [0, 0.2], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const fadeOut = interpolate(
      currentFrame,
      [durationInFrames - 40, durationInFrames],
      [0.2, 0],
      {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      },
    );

    const transitionDuck = sceneStarts.slice(1).reduce((duck, marker) => {
      const distance = Math.abs(currentFrame - marker);
      const dip = interpolate(distance, [0, 20], [0.6, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
      return Math.min(duck, dip);
    }, 1);

    return Math.min(fadeIn, fadeOut) * transitionDuck;
  };

  return (
    <AbsoluteFill style={{fontFamily: "Sora, Montserrat, Avenir Next, sans-serif"}}>
      <WorldMapBg />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 50% -10%, rgba(103,232,249,0.15) 0%, transparent 45%), radial-gradient(circle at 50% 110%, rgba(15,23,42,0.85) 0%, rgba(2,6,23,0) 38%)",
          opacity: interpolate(frame, [0, durationInFrames], [0.86, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      />

      <Audio src={staticFile("voiceover.wav")} />
      {hasBgMusic ? (
        <Audio src={staticFile("bg-music.mp3")} volume={backgroundMusicVolume} />
      ) : null}
      {hasWhoosh
        ? sceneStarts.slice(1).map((startFrame) => {
            return (
              <Sequence key={`whoosh-${startFrame}`} from={startFrame} durationInFrames={20}>
                <Audio src={staticFile("whoosh.wav")} volume={0.24} />
              </Sequence>
            );
          })
        : null}

      <Sequence from={sceneStarts[0]} durationInFrames={sceneDurations[0]}>
        <Scene index={0} durationInFrames={sceneDurations[0]}>
          <LogoReveal />
          <div
            style={{
              position: "absolute",
              bottom: 216,
              width: 800,
              display: "grid",
              gap: 14,
              justifyItems: "center",
            }}
          >
            <CaptionLine text="BitBridge Global" />
            <CaptionLine text="Digital Value, Borderless Access" color="#67e8f9" />
            <div
              style={{
                marginTop: 8,
                padding: "10px 20px",
                borderRadius: 999,
                border: "1px solid rgba(148,163,184,0.45)",
                background: "rgba(15,23,42,0.55)",
                color: "#e2e8f0",
                fontSize: 24,
                letterSpacing: 1.2,
                textTransform: "uppercase",
              }}
            >
              Trusted Digital Infrastructure
            </div>
          </div>
        </Scene>
      </Sequence>

      <Sequence from={sceneStarts[1]} durationInFrames={sceneDurations[1]}>
        <Scene index={1} durationInFrames={sceneDurations[1]}>
          <FeatureCard
            title="One Platform, Multiple Services"
            body={`${serviceList.join(", ")}.`}
            accent="#22d3ee"
          />
          <div
            style={{
              display: "flex",
              gap: 14,
              flexWrap: "wrap",
              width: 900,
              marginTop: 26,
            }}
          >
            {serviceList.map((service) => (
              <div
                key={service}
                style={{
                  padding: "12px 20px",
                  borderRadius: 999,
                  border: "1px solid rgba(103,232,249,0.45)",
                  background: "rgba(8,47,73,0.45)",
                  color: "#a5f3fc",
                  fontSize: 24,
                  letterSpacing: 0.5,
                }}
              >
                {service}
              </div>
            ))}
          </div>
        </Scene>
      </Sequence>

      <Sequence from={sceneStarts[2]} durationInFrames={sceneDurations[2]}>
        <Scene index={2} durationInFrames={sceneDurations[2]}>
          <div style={{display: "grid", gap: 20, width: "100%"}}>
            <CaptionLine text="Built for Speed and Trust" align="left" />
            <CaptionLine
              text="Fast transactions, clean UI, and enterprise-grade reliability."
              color="#cbd5e1"
              align="left"
            />
            <div
              style={{
                marginTop: 8,
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 14,
              }}
            >
              {[
                {metric: "99.9%", label: "Uptime Target"},
                {metric: "< 60s", label: "Checkout Flow"},
                {metric: "24/7", label: "Always On"},
              ].map((item) => (
                <div
                  key={item.label}
                  style={{
                    borderRadius: 24,
                    border: "1px solid rgba(148,163,184,0.35)",
                    background: "rgba(15,23,42,0.6)",
                    padding: "22px 18px",
                  }}
                >
                  <div style={{fontSize: 44, color: "#67e8f9", fontWeight: 700}}>
                    {item.metric}
                  </div>
                  <div
                    style={{
                      fontSize: 22,
                      color: "#cbd5e1",
                      textTransform: "uppercase",
                      letterSpacing: 0.8,
                    }}
                  >
                    {item.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Scene>
      </Sequence>

      <Sequence from={sceneStarts[3]} durationInFrames={sceneDurations[3]}>
        <Scene index={3} durationInFrames={sceneDurations[3]}>
          <div style={{display: "grid", gap: 24, width: "100%"}}>
            <FeatureCard
              title="Global Reach"
              body="Powering customer utility and digital purchases across regions."
              accent="#38bdf8"
            />
            <div
              style={{
                color: "#94a3b8",
                fontSize: 26,
                letterSpacing: 0.3,
              }}
            >
              Expansion-ready rails for emerging and established markets.
            </div>
          </div>
        </Scene>
      </Sequence>

      <Sequence from={sceneStarts[4]} durationInFrames={sceneDurations[4]}>
        <Scene index={4} durationInFrames={sceneDurations[4]}>
          <div style={{display: "grid", gap: 26, width: "100%", placeItems: "center"}}>
            <CaptionLine text="Upgrade Your Digital Commerce Flow" />
            <CaptionLine text="bitbridgeglobal.com" color="#67e8f9" />
            <div
              style={{
                marginTop: 22,
                padding: "18px 36px",
                borderRadius: 999,
                border: "1px solid rgba(103,232,249,0.65)",
                background: "linear-gradient(90deg, rgba(8,47,73,0.75), rgba(8,145,178,0.45))",
                fontSize: 34,
                letterSpacing: 0.8,
                textTransform: "uppercase",
              }}
            >
              Start Today
            </div>
          </div>
        </Scene>
      </Sequence>
    </AbsoluteFill>
  );
};
