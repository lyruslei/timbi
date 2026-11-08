import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

// Black stage with a slow-drifting dot grid and two soft lime glows.
export const Background: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: "#050505" }}>
      <AbsoluteFill
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.075) 1.6px, transparent 1.6px)",
          backgroundSize: "44px 44px",
          translate: interpolate(
            frame,
            [0, durationInFrames],
            ["0px 0px", "0px -176px"],
          ),
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 1300,
          height: 1300,
          left: -420,
          top: -520,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(180,248,42,0.20) 0%, rgba(180,248,42,0) 62%)",
          translate: interpolate(
            frame,
            [0, durationInFrames],
            ["0px 0px", "520px 260px"],
          ),
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 1200,
          height: 1200,
          right: -380,
          bottom: -560,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(94,140,18,0.30) 0%, rgba(94,140,18,0) 60%)",
          translate: interpolate(
            frame,
            [0, durationInFrames],
            ["0px 0px", "-460px -200px"],
          ),
        }}
      />
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(0,0,0,0) 50%, rgba(0,0,0,0.8) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};
