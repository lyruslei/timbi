import {
  AbsoluteFill,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { fontFamily, GRAY, LIME } from "../fonts";
import { Rise, useSpringAt } from "../components/motion";
import { Wordmark } from "../components/Wordmark";

// 0:26.3–0:31.5  "timbi. Tracking your food made easy."
// The tech stack is not narrated any more; it sits quietly in the footer.
export const OUTRO = {
  logo: 19,
  words: [39, 47, 53, 61, 69],
  footer: 88,
};

const StackLogo: React.FC<{ logo: string; name: string }> = ({ logo, name }) => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
    <Img src={staticFile(logo)} style={{ height: 28, width: 28, objectFit: "contain" }} />
    <span style={{ color: "#fff", fontWeight: 700 }}>{name}</span>
  </span>
);

export const OutroScene: React.FC<{ credit: string }> = ({ credit }) => {
  const frame = useCurrentFrame();
  const icon = useSpringAt(OUTRO.logo, { damping: 12, stiffness: 170 });
  const words = ["Tracking", "your", "food", "made", "easy."];

  return (
    <AbsoluteFill
      style={{
        fontFamily,
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "column",
        opacity: frame >= OUTRO.logo ? 1 : 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 40 }}>
        <Img
          src={staticFile("logos/timbi-icon.svg")}
          style={{
            width: 230,
            height: 230,
            borderRadius: 54,
            boxShadow: "0 0 0 2px #1f1f1f, 0 0 160px rgba(180,248,42,0.35)",
            scale: String(icon),
            rotate: `${(1 - icon) * -25}deg`,
          }}
        />
        <div
          style={{
            opacity: Math.min(1, icon * 1.3),
            translate: `${(1 - icon) * 80}px 0px`,
            paddingBottom: 18,
          }}
        >
          <Wordmark size={230} />
        </div>
      </div>
      <div
        style={{
          display: "flex",
          gap: 22,
          marginTop: 54,
          fontSize: 76,
          fontWeight: 900,
          letterSpacing: "-0.04em",
        }}
      >
        {words.map((w, i) => (
          <Rise
            key={w}
            at={OUTRO.words[i]}
            distance={90}
            style={{ color: i === 4 ? LIME : "#fff" }}
          >
            {w}
          </Rise>
        ))}
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 64,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 16,
          opacity: interpolate(frame, [OUTRO.footer, OUTRO.footer + 14], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          translate: `0px ${interpolate(frame, [OUTRO.footer, OUTRO.footer + 14], [16, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })}px`,
        }}
      >
        {credit ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 6,
              marginBottom: 26,
            }}
          >
            <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: 6, color: LIME }}>
              MADE BY
            </div>
            <div
              style={{
                fontSize: 42,
                fontWeight: 800,
                color: "#fff",
                letterSpacing: "-0.02em",
              }}
            >
              {credit}
            </div>
          </div>
        ) : null}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 30,
            fontSize: 26,
            color: GRAY,
            fontWeight: 600,
          }}
        >
          <span>Built with</span>
          <StackLogo logo="logos/claude.svg" name="Claude" />
          <StackLogo logo="logos/supabase.svg" name="Supabase" />
          <StackLogo logo="logos/vercel.svg" name="Vercel" />
          <span style={{ color: "#3a3a3c" }}>·</span>
          <span>Voiceover: ElevenLabs</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
