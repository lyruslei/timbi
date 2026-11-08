import { Video } from "@remotion/media";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  Sequence,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { CARD, fontFamily, GRAY, LIME } from "../fonts";
import { Rise, Slam, useSpringAt } from "../components/motion";
import { Phone, SCREEN_H, SCREEN_W } from "../components/Phone";

// 0:09.3–0:27.1 — the phone demo. Frames are local to this scene.
// Clip timings (trimBefore, playbackRate) are matched to the voiceover:
//   chat send lands on "That's it", the ring jump lands on "calorie ring",
//   the shutter lands on "Snap".
export const BEAT = {
  launch: 0,
  chat: 39,
  thatsIt: 102,
  logging: 135,
  ring: 216,
  photo: 294,
  snap: 330,
  photoResult: 354,
  goals: 411,
  streak: 439,
  history: 486,
  exit: 504,
  end: 522,
};

const Clip: React.FC<{
  name: string;
  src: string;
  from: number;
  durationInFrames: number;
  trimBefore: number;
  playbackRate?: number;
}> = ({ name, src, from, durationInFrames, trimBefore, playbackRate = 1 }) => (
  <Sequence name={name} from={from} durationInFrames={durationInFrames}>
    <Video
      src={staticFile(src)}
      trimBefore={trimBefore}
      playbackRate={playbackRate}
      muted
      objectFit="cover"
      style={{ width: SCREEN_W, height: SCREEN_H }}
    />
  </Sequence>
);

const Kicker: React.FC<{ at: number; children: React.ReactNode }> = ({
  at,
  children,
}) => (
  <Rise
    at={at}
    distance={40}
    style={{
      fontFamily,
      fontSize: 26,
      fontWeight: 800,
      letterSpacing: 5,
      color: LIME,
      marginBottom: 18,
    }}
  >
    {children}
  </Rise>
);

const headline: React.CSSProperties = {
  fontFamily,
  fontSize: 104,
  fontWeight: 900,
  letterSpacing: "-0.045em",
  lineHeight: 1.0,
  color: "#fff",
};

// A copy block that is visible from `from` to `to`, fading out at the end.
const Block: React.FC<{ from: number; to: number; children: React.ReactNode }> = ({
  from,
  to,
  children,
}) => {
  const frame = useCurrentFrame();
  if (frame < from || frame > to) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: 820,
        opacity: interpolate(frame, [to - 8, to], [1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
        translate: `0px ${interpolate(frame, [to - 8, to], [0, -30], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })}px`,
      }}
    >
      {children}
    </div>
  );
};

const ChatBubble: React.FC = () => {
  const frame = useCurrentFrame();
  const text = "2 eggs and 1 cup of rice";
  const typed = text.slice(
    0,
    Math.round(
      interpolate(frame, [BEAT.chat + 4, 122], [0, text.length], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      }),
    ),
  );
  const sent = useSpringAt(128, { damping: 12, stiffness: 220 });
  const appear = useSpringAt(BEAT.chat);
  return (
    <div
      style={{
        marginTop: 46,
        display: "flex",
        alignItems: "center",
        gap: 22,
        opacity: appear,
        translate: `0px ${(1 - appear) * 40}px`,
      }}
    >
      <div
        style={{
          fontFamily,
          fontSize: 46,
          fontWeight: 700,
          color: frame >= 128 ? "#000" : "#fff",
          background: frame >= 128 ? LIME : "#2C2C2E",
          padding: "26px 38px",
          borderRadius: 40,
          borderBottomRightRadius: frame >= 128 ? 10 : 40,
          scale: String(1 + Math.sin(Math.min(1, sent) * Math.PI) * 0.06),
          minWidth: 120,
          whiteSpace: "nowrap",
        }}
      >
        {typed}
        {frame < 128 ? (
          <span style={{ color: LIME, opacity: Math.floor(frame / 8) % 2 ? 1 : 0 }}>|</span>
        ) : null}
      </div>
    </div>
  );
};

const MacroRow: React.FC<{
  label: string;
  value: number;
  unit: string;
  at: number;
  max: number;
}> = ({ label, value, unit, at, max }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [at, at + 40], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const show = useSpringAt(at - 6);
  return (
    <div
      style={{
        opacity: show,
        translate: `${(1 - show) * 40}px 0px`,
        padding: "16px 0",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          fontFamily,
        }}
      >
        <span style={{ fontSize: 34, fontWeight: 700, color: "#fff" }}>{label}</span>
        <span
          style={{
            fontSize: 44,
            fontWeight: 900,
            color: LIME,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          +{Math.round(value * p)}
          <span style={{ fontSize: 26, color: GRAY, fontWeight: 700 }}> {unit}</span>
        </span>
      </div>
      <div
        style={{
          height: 10,
          borderRadius: 999,
          background: "#2C2C2E",
          marginTop: 12,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${(value / max) * 100 * p}%`,
            height: "100%",
            borderRadius: 999,
            background: LIME,
          }}
        />
      </div>
    </div>
  );
};

const CheckItem: React.FC<{
  at: number;
  next: number;
  children: React.ReactNode;
}> = ({ at, next, children }) => {
  const frame = useCurrentFrame();
  const show = useSpringAt(at - 4);
  const active = frame >= at && frame < next;
  const done = frame >= next;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 30,
        padding: "22px 0",
        opacity: frame < at - 4 ? 0.18 : 0.18 + 0.82 * Math.min(1, show),
        translate: `${(1 - Math.min(1, show)) * 30}px 0px`,
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 20,
          background: active ? LIME : done ? "#2C2C2E" : "transparent",
          border: active || done ? "none" : "3px solid #3a3a3c",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          scale: String(active ? 1 + (1 - Math.min(1, show)) * 0.4 : 1),
        }}
      >
        {active || done ? (
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
            <path
              d="M5 12.5l4.2 4.2L19 7"
              stroke={active ? "#000" : LIME}
              strokeWidth="3.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : null}
      </div>
      <div
        style={{
          fontFamily,
          fontSize: active ? 66 : 54,
          whiteSpace: "nowrap",
          fontWeight: 900,
          letterSpacing: "-0.04em",
          color: active ? "#fff" : done ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.3)",
        }}
      >
        {children}
      </div>
    </div>
  );
};

export const PhoneStage: React.FC = () => {
  const frame = useCurrentFrame();
  const enter = useSpringAt(0, { damping: 16, stiffness: 120 });
  const exit = interpolate(frame, [BEAT.exit, BEAT.end], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.in(Easing.cubic),
  });
  const flash = interpolate(frame, [BEAT.snap, BEAT.snap + 2, BEAT.snap + 12], [0, 0.95, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill>
      {/* ---------- phone ---------- */}
      <div
        style={{
          position: "absolute",
          left: 396,
          top: 72,
          perspective: 2200,
          translate: `${(1 - enter) * -700 + exit * -900}px ${Math.sin(frame / 26) * 7}px`,
          opacity: 1 - exit,
        }}
      >
        <div
          style={{
            transform: `rotateY(${(1 - enter) * 40 + 12 - Math.min(1, frame / 500) * 6}deg) rotateZ(${(1 - enter) * -8}deg)`,
          }}
        >
          {/* zoom on the calorie ring */}
          <div
            style={{
              transformOrigin: "50% 21%",
              scale: String(
                interpolate(
                  frame,
                  [BEAT.ring, BEAT.ring + 16, BEAT.photo - 14, BEAT.photo],
                  [1, 1.72, 1.72, 1],
                  {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                    easing: Easing.bezier(0.65, 0, 0.35, 1),
                  },
                ),
              ),
            }}
          >
            {/* zoom on the streak in the header */}
            <div
              style={{
                transformOrigin: "16% 5%",
                scale: String(
                  interpolate(
                    frame,
                    [BEAT.streak, BEAT.streak + 10, BEAT.history - 6, BEAT.history],
                    [1, 1.6, 1.6, 1],
                    {
                      extrapolateLeft: "clamp",
                      extrapolateRight: "clamp",
                      easing: Easing.bezier(0.65, 0, 0.35, 1),
                    },
                  ),
                ),
              }}
            >
              <Phone>
                {/* new launch take: tap the icon on the home screen, app opens (login skipped) */}
                <Clip name="Launch" src="clips/intro-new.mp4" from={BEAT.launch} durationInFrames={32} trimBefore={9} playbackRate={1.2} />
                {/* skip the black splash + login: jump to the dashboard the chat clip continues from */}
                <Clip name="Launch dashboard" src="clips/intro-new.mp4" from={32} durationInFrames={7} trimBefore={264} />
                <Clip name="Chat typing" src="clips/chat-eggs.mp4" from={BEAT.chat} durationInFrames={96} trimBefore={90} playbackRate={2} />
                <Clip name="Chat logging" src="clips/chat-eggs.mp4" from={BEAT.logging} durationInFrames={159} trimBefore={282} />
                <Clip name="Photo camera" src="clips/photo.mp4" from={BEAT.photo} durationInFrames={60} trimBefore={129} />
                <Clip name="Photo result" src="clips/photo.mp4" from={BEAT.photoResult} durationInFrames={57} trimBefore={318} playbackRate={2} />
                <Clip name="Goals" src="clips/goals.mp4" from={BEAT.goals} durationInFrames={28} trimBefore={132} playbackRate={3} />
                <Clip name="Streak" src="clips/bread-yesterday.mp4" from={BEAT.streak} durationInFrames={47} trimBefore={291} />
                <Clip name="Yesterday" src="clips/bread-yesterday.mp4" from={BEAT.history} durationInFrames={36} trimBefore={510} playbackRate={3} />
                <AbsoluteFill style={{ background: "#fff", opacity: flash }} />
              </Phone>
            </div>
          </div>
        </div>
      </div>

      {/* ---------- copy column ---------- */}
      <div
        style={{
          position: "absolute",
          left: 1040,
          top: 250,
          width: 820,
          height: 700,
          opacity: 1 - exit,
          translate: `${exit * 200}px 0px`,
        }}
      >
        <Block from={8} to={BEAT.logging - 2}>
          <Kicker at={8}>LOG A MEAL</Kicker>
          <Rise at={10} style={headline}>Just type</Rise>
          <Rise at={16} style={headline}>what you ate.</Rise>
          <ChatBubble />
          <Slam
            at={BEAT.thatsIt}
            from={1.3}
            style={{
              fontFamily,
              fontSize: 40,
              fontWeight: 800,
              color: GRAY,
              marginTop: 30,
              transformOrigin: "left center",
            }}
          >
            That's it.
          </Slam>
        </Block>

        <Block from={BEAT.logging} to={BEAT.ring - 2}>
          <Kicker at={BEAT.logging}>AI DOES THE MATH</Kicker>
          <Rise at={BEAT.logging + 2} style={headline}>Calories &amp;</Rise>
          <Rise at={BEAT.logging + 8} style={headline}>macros, done.</Rise>
          <div
            style={{
              marginTop: 40,
              padding: "18px 40px 24px",
              borderRadius: 32,
              background: CARD,
              border: "1px solid #2c2c2e",
              width: 640,
            }}
          >
            <MacroRow label="Calories" value={358} unit="kcal" at={150} max={400} />
            <MacroRow label="Protein" value={17} unit="g" at={160} max={60} />
            <MacroRow label="Carbs" value={46} unit="g" at={170} max={60} />
            <MacroRow label="Fat" value={11} unit="g" at={180} max={60} />
          </div>
        </Block>

        <Block from={BEAT.ring} to={BEAT.photo - 2}>
          <Kicker at={BEAT.ring}>LIVE CHARTS</Kicker>
          <Rise at={BEAT.ring + 2} style={headline}>Your ring</Rise>
          <Rise at={BEAT.ring + 8} style={headline}>updates instantly.</Rise>
          <div
            style={{
              marginTop: 50,
              display: "flex",
              alignItems: "baseline",
              gap: 26,
              fontFamily,
              fontWeight: 900,
              letterSpacing: "-0.04em",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            <span style={{ fontSize: 120, color: "rgba(255,255,255,0.35)" }}>122</span>
            <span style={{ fontSize: 80, color: GRAY }}>→</span>
            <span style={{ fontSize: 150, color: LIME }}>
              {Math.round(
                interpolate(frame, [246, 262], [122, 480], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                  easing: Easing.bezier(0.16, 1, 0.3, 1),
                }),
              )}
            </span>
            <span style={{ fontSize: 44, color: GRAY }}>kcal</span>
          </div>
        </Block>

        <Block from={BEAT.photo} to={BEAT.goals - 2}>
          <Kicker at={BEAT.photo}>PHOTO LOGGING</Kicker>
          <Rise at={BEAT.photo + 2} style={headline}>Can't describe it?</Rise>
          <Slam
            at={BEAT.snap - 2}
            from={1.6}
            style={{ ...headline, color: LIME, transformOrigin: "left center" }}
          >
            Snap it.
          </Slam>
          <Rise
            at={BEAT.photoResult + 6}
            distance={50}
            style={{ fontFamily, fontSize: 44, fontWeight: 700, color: GRAY, marginTop: 24 }}
          >
            Your plate, or the nutrition label.
          </Rise>
          <div
            style={{
              marginTop: 40,
              display: "flex",
              gap: 18,
              opacity: useSpringAt(380),
              translate: `0px ${(1 - useSpringAt(380)) * 30}px`,
            }}
          >
            {["210 kcal", "21 g protein", "read from the wrapper"].map((t, i) => (
              <div
                key={t}
                style={{
                  fontFamily,
                  fontSize: 30,
                  fontWeight: 800,
                  padding: "16px 26px",
                  borderRadius: 999,
                  background: i === 2 ? "transparent" : LIME,
                  color: i === 2 ? GRAY : "#000",
                  border: i === 2 ? "2px solid #3a3a3c" : "none",
                }}
              >
                {t}
              </div>
            ))}
          </div>
        </Block>

        <Block from={BEAT.goals} to={BEAT.end}>
          <Kicker at={BEAT.goals}>STAY ON TRACK</Kicker>
          <CheckItem at={BEAT.goals} next={BEAT.streak}>Set your goals</CheckItem>
          <CheckItem at={BEAT.streak} next={BEAT.history}>Keep your streak 🔥</CheckItem>
          <CheckItem at={BEAT.history} next={10_000}>Look back on any day</CheckItem>
        </Block>
      </div>
    </AbsoluteFill>
  );
};
