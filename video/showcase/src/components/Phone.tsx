import { AbsoluteFill } from "remotion";

// iPhone-style frame. The screen is 420 × 909, the same aspect as the
// 780 × 1688 recordings, so clips fill it exactly.
export const SCREEN_W = 420;
export const SCREEN_H = 909;
const BEZEL = 14;

export const Phone: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <div
    style={{
      width: SCREEN_W + BEZEL * 2,
      height: SCREEN_H + BEZEL * 2,
      borderRadius: 66,
      background: "linear-gradient(160deg, #3a3a3c 0%, #121214 40%, #2c2c2e 100%)",
      padding: BEZEL,
      boxShadow:
        "0 0 0 2px #1a1a1a, 0 50px 120px rgba(0,0,0,0.75), 0 0 140px rgba(180,248,42,0.16)",
      position: "relative",
    }}
  >
    <div
      style={{
        width: SCREEN_W,
        height: SCREEN_H,
        borderRadius: 52,
        overflow: "hidden",
        position: "relative",
        background: "#000",
      }}
    >
      {children}
      {/* subtle glass sheen */}
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(115deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0) 35%)",
          pointerEvents: "none",
        }}
      />
    </div>
  </div>
);
