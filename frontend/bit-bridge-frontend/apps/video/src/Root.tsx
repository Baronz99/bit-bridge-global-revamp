import {Composition, staticFile} from "remotion";
import {getAudioDurationInSeconds} from "@remotion/media-utils";
import type {FC} from "react";
import {BitBridgeAdVertical} from "./compositions/BitBridgeAdVertical";
import {BitBridgeLogoRevealVertical} from "./compositions/BitBridgeLogoRevealVertical";
import {BitBridgeTransferAdVertical} from "./compositions/BitBridgeTransferAdVertical";

const FPS = 30;
const FALLBACK_SECONDS = 30;

export const RemotionRoot: FC = () => {
  const getDurationFromAudio = async (fileName: string) => {
    const timeoutMs = 8000;
    const timeoutDuration = new Promise<number>((resolve) => {
      setTimeout(() => resolve(FALLBACK_SECONDS), timeoutMs);
    });

    try {
      const durationInSeconds = await Promise.race([
        getAudioDurationInSeconds(staticFile(fileName)),
        timeoutDuration,
      ]);

      return Math.max(1, Math.ceil(durationInSeconds * FPS));
    } catch (error) {
      console.warn(
        `Could not read "public/${fileName}". Falling back to 30 seconds.`,
        error,
      );
      return FALLBACK_SECONDS * FPS;
    }
  };

  return (
    <>
      <Composition
        id="BitBridgeAdVertical"
        component={BitBridgeAdVertical}
        fps={FPS}
        width={1080}
        height={1920}
        durationInFrames={FALLBACK_SECONDS * FPS}
        calculateMetadata={async () => {
          return {
            durationInFrames: await getDurationFromAudio("voiceover.wav"),
          };
        }}
      />
      <Composition
        id="BitBridgeTransferAdVertical"
        component={BitBridgeTransferAdVertical}
        fps={FPS}
        width={1080}
        height={1920}
        durationInFrames={FALLBACK_SECONDS * FPS}
        calculateMetadata={async () => {
          return {
            durationInFrames: await getDurationFromAudio("transfer-voiceover.wav"),
          };
        }}
      />
      <Composition
        id="BitBridgeLogoRevealVertical"
        component={BitBridgeLogoRevealVertical}
        fps={FPS}
        width={1080}
        height={1920}
        durationInFrames={6 * FPS}
      />
    </>
  );
};
