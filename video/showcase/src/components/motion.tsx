import { spring, useCurrentFrame, useVideoConfig } from "remotion";

// 0 → 1 spring that starts at frame `at` (in the caller's local frames).
export const useSpringAt = (
  at: number,
  config: { damping?: number; stiffness?: number; mass?: number } = {},
) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({
    frame: frame - at,
    fps,
    config: { damping: 15, stiffness: 170, mass: 0.9, ...config },
  });
};

// A word or line that slams in: scales down from big, un-blurs, fades in.
export const Slam: React.FC<{
  at: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
  from?: number;
}> = ({ at, children, style, from = 1.7 }) => {
  const p = useSpringAt(at, { damping: 13, stiffness: 210 });
  const frame = useCurrentFrame();
  if (frame < at) return null;
  return (
    <div
      style={{
        ...style,
        opacity: Math.min(1, p * 1.6),
        scale: String(from + (1 - from) * p),
        filter: `blur(${(1 - Math.min(1, p)) * 14}px)`,
      }}
    >
      {children}
    </div>
  );
};

// A line that rises up from below a clipping mask.
export const Rise: React.FC<{
  at: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
  distance?: number;
}> = ({ at, children, style, distance = 110 }) => {
  const p = useSpringAt(at, { damping: 18, stiffness: 150 });
  return (
    <div style={{ overflow: "hidden", paddingBottom: "0.12em" }}>
      <div
        style={{
          ...style,
          translate: `0px ${(1 - p) * distance}px`,
          opacity: Math.min(1, p * 1.4),
        }}
      >
        {children}
      </div>
    </div>
  );
};
