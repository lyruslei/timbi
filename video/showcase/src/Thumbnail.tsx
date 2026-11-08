import { AbsoluteFill, Img, staticFile } from "remotion";
import { Background } from "./components/Background";
import { Phone, SCREEN_H, SCREEN_W } from "./components/Phone";
import { Wordmark } from "./components/Wordmark";
import { CARD, fontFamily, GRAY, LIME } from "./fonts";

// Video thumbnail (1920 × 1080). Reads at small sizes: one big promise on
// the left, the real app on the right.
export const Thumbnail: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#050505", fontFamily }}>
      <Background />

      {/* extra glow behind the phone */}
      <div
        style={{
          position: "absolute",
          width: 1100,
          height: 1100,
          right: -160,
          top: -40,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(180,248,42,0.28) 0%, rgba(180,248,42,0) 60%)",
        }}
      />

      {/* ---------- left: brand + headline ---------- */}
      <div style={{ position: "absolute", left: 120, top: 130, width: 1000 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 26 }}>
          <Img
            src={staticFile("logos/timbi-icon.svg")}
            style={{
              width: 112,
              height: 112,
              borderRadius: 27,
              boxShadow: "0 0 0 2px #1f1f1f, 0 0 60px rgba(180,248,42,0.35)",
            }}
          />
          <div style={{ paddingBottom: 10 }}>
            <Wordmark size={112} />
          </div>
        </div>

        <div
          style={{
            marginTop: 70,
            fontSize: 172,
            fontWeight: 900,
            letterSpacing: "-0.055em",
            lineHeight: 0.95,
            color: "#fff",
          }}
        >
          Track food
          <br />
          by just
          <br />
          <span style={{ color: LIME }}>texting.</span>
        </div>

        <div
          style={{
            marginTop: 56,
            display: "inline-flex",
            alignItems: "center",
            gap: 18,
            padding: "20px 34px",
            borderRadius: 999,
            background: CARD,
            border: "1px solid #2c2c2e",
            fontSize: 38,
            fontWeight: 700,
            color: GRAY,
          }}
        >
          <span
            style={{
              width: 16,
              height: 16,
              borderRadius: "50%",
              background: LIME,
              boxShadow: "0 0 16px rgba(180,248,42,0.9)",
            }}
          />
          AI calorie &amp; macro tracker
        </div>
      </div>

      {/* ---------- right: the real app ---------- */}
      <div
        style={{
          position: "absolute",
          left: 1170,
          top: 70,
          perspective: 2400,
          scale: "1.18",
          transformOrigin: "top left",
        }}
      >
        <div style={{ transform: "rotateY(-16deg) rotateZ(4deg)" }}>
          <Phone>
            <Img
              src={staticFile("thumb/screen.png")}
              style={{ width: SCREEN_W, height: SCREEN_H, objectFit: "cover" }}
            />
            {/* hide the screen-recording pill in the status bar */}
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: 140,
                height: 40,
                background: "#000",
              }}
            />
          </Phone>
        </div>
      </div>

      {/* floating chat bubble, overlapping the phone's edge */}
      <div
        style={{
          position: "absolute",
          left: 935,
          top: 800,
          rotate: "-4deg",
          padding: "24px 38px",
          borderRadius: 44,
          borderBottomRightRadius: 12,
          background: LIME,
          color: "#000",
          fontSize: 46,
          fontWeight: 800,
          letterSpacing: "-0.02em",
          boxShadow: "0 30px 70px rgba(0,0,0,0.6)",
          whiteSpace: "nowrap",
        }}
      >
        2 eggs and 1 cup of rice
      </div>

      {/* floating result card */}
      <div
        style={{
          position: "absolute",
          left: 1000,
          top: 270,
          rotate: "3deg",
          padding: "24px 36px",
          borderRadius: 30,
          background: "rgba(28,28,30,0.92)",
          border: "1px solid #3a3a3c",
          boxShadow: "0 30px 70px rgba(0,0,0,0.6)",
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        <div
          style={{
            fontSize: 66,
            fontWeight: 900,
            color: LIME,
            letterSpacing: "-0.04em",
            lineHeight: 1,
          }}
        >
          +358 kcal
        </div>
        <div style={{ fontSize: 28, fontWeight: 700, color: GRAY }}>
          logged in seconds
        </div>
      </div>
    </AbsoluteFill>
  );
};
