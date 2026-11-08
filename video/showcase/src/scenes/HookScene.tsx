import {
  AbsoluteFill,
  Easing,
  interpolate,
  random,
  useCurrentFrame,
} from "remotion";
import { CARD, fontFamily, GRAY, LIME } from "../fonts";
import { Slam } from "../components/motion";

// 0:00–0:08.2  "Calorie apps make you search, scroll, and weigh every bite.
//               So most of us just... quit."
// Frames are local to this scene (it starts at frame 0 of the video, and the
// voiceover starts 12 frames in).
export const T = {
  intro: 4,
  search: 50,
  scroll: 67,
  weigh: 92,
  most: 148,
  quit: 227,
  end: 247,
};

const ROWS: [string, string, string][] = [
  ["Chicken breast, raw", "120 kcal", "100 g"],
  ["Chicken breast, grilled", "165 kcal", "100 g"],
  ["Chicken breast (restaurant)", "284 kcal", "1 piece"],
  ["Chicken breast w/ skin, roasted", "197 kcal", "100 g"],
  ["Chicken breast, fried in batter", "260 kcal", "100 g"],
  ["Chicken breast tenders", "263 kcal", "4 pcs"],
  ["Chicken breast fillet, frozen", "110 kcal", "112 g"],
  ["Chicken breast, rotisserie", "148 kcal", "3 oz"],
  ["Chicken breast, boneless, baked", "151 kcal", "1 cup"],
  ["Chicken breast, canned", "185 kcal", "1 can"],
  ["Chicken breast, sous vide", "139 kcal", "100 g"],
  ["Chicken breast nuggets", "296 kcal", "6 pcs"],
];

const SearchCard: React.FC = () => {
  const frame = useCurrentFrame();
  const query = "chicken breast";
  const typed = query.slice(
    0,
    Math.round(
      interpolate(frame, [10, 46], [0, query.length], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      }),
    ),
  );
  // Rows race upward while "scroll." is on screen.
  const scrollY = interpolate(frame, [T.scroll, T.weigh + 6], [0, -560], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.45, 0, 0.2, 1),
  });
  const scrollBlur = interpolate(
    frame,
    [T.scroll, T.scroll + 10, T.weigh - 4, T.weigh + 6],
    [0, 3.5, 3.5, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  // Serving-size digits flicker, then settle.
  const settled = frame > T.weigh + 34;
  const grams = settled
    ? 112
    : Math.floor(40 + random(`g-${Math.floor(frame / 2)}`) * 260);

  return (
    <div
      style={{
        width: 640,
        height: 780,
        borderRadius: 36,
        background: CARD,
        border: "1px solid #2c2c2e",
        boxShadow: "0 40px 100px rgba(0,0,0,0.6)",
        overflow: "hidden",
        position: "relative",
        fontFamily,
      }}
    >
      <div
        style={{
          margin: 28,
          height: 72,
          borderRadius: 999,
          background: "#2C2C2E",
          display: "flex",
          alignItems: "center",
          padding: "0 30px",
          gap: 18,
          color: "#fff",
          fontSize: 30,
          fontWeight: 500,
        }}
      >
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
          <circle cx="11" cy="11" r="7" stroke={GRAY} strokeWidth="2.4" />
          <path d="m20 20-4-4" stroke={GRAY} strokeWidth="2.4" strokeLinecap="round" />
        </svg>
        <span>
          {typed}
          <span style={{ opacity: Math.floor(frame / 8) % 2 ? 1 : 0, color: LIME }}>|</span>
        </span>
      </div>
      {/* results live in their own clipped window under the search bar,
          so they never slide over the query while scrolling */}
      <div
        style={{
          position: "absolute",
          top: 128,
          left: 0,
          right: 0,
          bottom: 0,
          overflow: "hidden",
          borderTop: "1px solid #2c2c2e",
        }}
      >
      <div
        style={{
          padding: "0 28px",
          translate: `0px ${scrollY}px`,
          filter: `blur(${scrollBlur}px)`,
        }}
      >
        {ROWS.map(([name, kcal, unit], i) => (
          <div
            key={name}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "20px 4px",
              borderBottom: "1px solid #2c2c2e",
              opacity: interpolate(frame, [24 + i * 3, 32 + i * 3], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
            }}
          >
            <div>
              <div style={{ color: "#fff", fontSize: 27, fontWeight: 600 }}>{name}</div>
              <div style={{ color: GRAY, fontSize: 22, marginTop: 4 }}>{unit}</div>
            </div>
            <div style={{ color: GRAY, fontSize: 26, fontWeight: 600 }}>{kcal}</div>
          </div>
        ))}
      </div>
      </div>
      {/* serving-size scale sheet */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          padding: "34px 36px 40px",
          background: "#2C2C2E",
          borderTopLeftRadius: 36,
          borderTopRightRadius: 36,
          translate: `0px ${interpolate(frame, [T.weigh, T.weigh + 12], [340, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          })}px`,
        }}
      >
        <div style={{ color: GRAY, fontSize: 24, fontWeight: 600, letterSpacing: 2 }}>
          SERVING SIZE
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 14,
            marginTop: 10,
            color: settled ? LIME : "#fff",
            fontSize: 110,
            fontWeight: 900,
            fontVariantNumeric: "tabular-nums",
            letterSpacing: "-0.04em",
          }}
        >
          {grams}
          <span style={{ fontSize: 48, color: GRAY, fontWeight: 700 }}>g</span>
        </div>
        <div style={{ color: GRAY, fontSize: 24, marginTop: 4 }}>
          Did you weigh it? Raw or cooked?
        </div>
      </div>
    </div>
  );
};

export const HookScene: React.FC = () => {
  const frame = useCurrentFrame();

  // Everything dims back when "So most of us just..." comes in,
  // then falls off screen on "quit."
  const dim = interpolate(frame, [T.most, T.most + 10], [1, 0.22], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const fall = interpolate(frame, [T.quit, T.quit + 22], [0, 1300], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.in(Easing.cubic),
  });
  const shake =
    frame >= T.quit && frame < T.quit + 8
      ? (random(`s-${frame}`) - 0.5) * 18
      : 0;

  const wordStyle: React.CSSProperties = {
    fontFamily,
    fontWeight: 900,
    fontSize: 124,
    whiteSpace: "nowrap",
    letterSpacing: "-0.05em",
    lineHeight: 1.02,
    transformOrigin: "left center",
  };
  const wordColor = (start: number, next: number) =>
    frame >= next ? "rgba(255,255,255,0.32)" : frame >= start ? LIME : "#fff";

  return (
    <AbsoluteFill style={{ translate: `${shake}px 0px` }}>
      <AbsoluteFill
        style={{
          opacity: dim,
          filter: `blur(${(1 - dim) * 6}px)`,
          translate: `0px ${fall}px`,
          rotate: `${fall * 0.006}deg`,
        }}
      >
        <div style={{ position: "absolute", left: 140, top: 190 }}>
          <Slam
            at={T.intro}
            from={1.15}
            style={{
              fontFamily,
              fontWeight: 700,
              fontSize: 54,
              color: GRAY,
              marginBottom: 26,
              transformOrigin: "left center",
            }}
          >
            Calorie apps make you
          </Slam>
          <Slam at={T.search} style={{ ...wordStyle, color: wordColor(T.search, T.scroll) }}>
            search.
          </Slam>
          <Slam at={T.scroll} style={{ ...wordStyle, color: wordColor(T.scroll, T.weigh) }}>
            scroll.
          </Slam>
          <Slam at={T.weigh} style={{ ...wordStyle, color: wordColor(T.weigh, 10_000) }}>
            weigh every bite.
          </Slam>
        </div>
        <div
          style={{
            position: "absolute",
            right: 100,
            top: 150,
            rotate: "3deg",
            translate: `0px ${interpolate(frame, [0, 26], [80, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            })}px`,
            opacity: interpolate(frame, [0, 14], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          <SearchCard />
        </div>
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          flexDirection: "column",
          fontFamily,
          opacity: interpolate(frame, [T.end - 12, T.end - 1], [1, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        <Slam
          at={T.most}
          from={1.12}
          style={{ fontSize: 92, fontWeight: 800, color: "#fff", letterSpacing: "-0.03em" }}
        >
          So most of us just…
        </Slam>
        <Slam
          at={T.quit}
          from={2.2}
          style={{
            fontSize: 300,
            fontWeight: 900,
            color: "#fff",
            letterSpacing: "-0.06em",
            lineHeight: 1,
            marginTop: 10,
          }}
        >
          quit.
        </Slam>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
