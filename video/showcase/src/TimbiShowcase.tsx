import { Audio } from "@remotion/media";
import { AbsoluteFill, Sequence, staticFile } from "remotion";
import { Background } from "./components/Background";
import { HookScene, T } from "./scenes/HookScene";
import { LogoScene } from "./scenes/LogoScene";
import { BEAT, PhoneStage } from "./scenes/PhoneStage";
import { OUTRO, OutroScene } from "./scenes/OutroScene";

// Scene start frames on the main timeline (30 fps).
// The voiceover starts at frame 12; every scene is timed to its words.
const HOOK = 0;
const LOGO = 243;
const STAGE = 280;
const END = 790;

const Sfx: React.FC<{ at: number; file: string; volume: number }> = ({
  at,
  file,
  volume,
}) => (
  <Sequence name={`sfx ${file}`} from={at} layout="none">
    <Audio src={staticFile(`sfx/${file}.wav`)} volume={volume} />
  </Sequence>
);

export type ShowcaseProps = { credit: string };

export const TimbiShowcase: React.FC<ShowcaseProps> = ({ credit }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#050505" }}>
      <Background />

      <Sequence name="Hook" from={HOOK} durationInFrames={247}>
        <HookScene />
      </Sequence>
      <Sequence name="Logo" from={LOGO} durationInFrames={46}>
        <LogoScene />
      </Sequence>
      <Sequence name="Phone demo" from={STAGE} durationInFrames={522}>
        <PhoneStage />
      </Sequence>
      <Sequence name="Outro" from={END} durationInFrames={155}>
        <OutroScene credit={credit} />
      </Sequence>

      {/* ---------- audio ---------- */}
      <Sequence name="Voiceover" from={12} layout="none">
        <Audio src={staticFile("audio/voiceover.mp3")} volume={0.88} />
      </Sequence>

      {/* hook slams */}
      <Sfx at={T.search} file="whip" volume={0.35} />
      <Sfx at={T.scroll} file="whip" volume={0.35} />
      <Sfx at={T.weigh} file="whip" volume={0.35} />
      <Sfx at={T.quit} file="whoosh" volume={0.5} />
      {/* logo bites */}
      <Sfx at={LOGO + 4} file="mouse-click" volume={0.45} />
      <Sfx at={LOGO + 7} file="mouse-click" volume={0.45} />
      <Sfx at={LOGO + 10} file="mouse-click" volume={0.45} />
      {/* phone demo */}
      <Sfx at={STAGE - 4} file="whoosh" volume={0.4} />
      <Sfx at={STAGE + BEAT.chat + 89} file="switch" volume={0.5} />
      <Sfx at={STAGE + 246} file="ding" volume={0.22} />
      <Sfx at={STAGE + BEAT.photo - 4} file="whoosh" volume={0.25} />
      <Sfx at={STAGE + BEAT.snap - 1} file="shutter-modern" volume={0.6} />
      <Sfx at={STAGE + BEAT.goals} file="switch" volume={0.35} />
      <Sfx at={STAGE + BEAT.streak} file="switch" volume={0.35} />
      <Sfx at={STAGE + BEAT.history} file="switch" volume={0.35} />
      <Sfx at={STAGE + BEAT.exit} file="whoosh" volume={0.35} />
      {/* outro */}
      <Sfx at={END + OUTRO.logo - 4} file="whoosh" volume={0.4} />
      <Sfx at={END + OUTRO.words[4]} file="ding" volume={0.25} />
    </AbsoluteFill>
  );
};
