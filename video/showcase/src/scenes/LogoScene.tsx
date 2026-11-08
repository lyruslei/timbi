import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { LIME } from "../fonts";
import { useSpringAt } from "../components/motion";
import { Wordmark } from "../components/Wordmark";

// 0:08.1–0:09.6  "This is timbi."
// The app icon builds itself: lime disc pops in, three bites get taken out,
// the inner ring draws, then the wordmark slides out beside it.
export const LogoScene: React.FC = () => {
  const frame = useCurrentFrame();
  const disc = useSpringAt(0, { damping: 11, stiffness: 190 });
  const bite1 = useSpringAt(4, { damping: 12, stiffness: 260 });
  const bite2 = useSpringAt(7, { damping: 12, stiffness: 260 });
  const bite3 = useSpringAt(10, { damping: 12, stiffness: 260 });
  const ring = interpolate(frame, [3, 16], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.65, 0, 0.35, 1),
  });
  const slide = useSpringAt(13, { damping: 16, stiffness: 150 });
  const circumference = 2 * Math.PI * 104;

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        opacity: interpolate(frame, [0, 4, 37, 46], [0, 1, 1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
        scale: String(
          interpolate(frame, [35, 46], [1, 0.86], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.in(Easing.cubic),
          }),
        ),
      }}
    >
      <div style={{ display: "flex", alignItems: "center" }}>
        <svg
          width={360}
          height={360}
          viewBox="80 90 352 352"
          style={{ scale: String(disc), position: "relative", zIndex: 1 }}
        >
          <defs>
            <mask id="bite">
              <rect x="0" y="0" width="512" height="512" fill="#fff" />
              <circle cx="372" cy="150" r={52 * bite1} fill="#000" />
              <circle cx="398" cy="214" r={46 * bite2} fill="#000" />
              <circle cx="322" cy="112" r={40 * bite3} fill="#000" />
            </mask>
          </defs>
          <g mask="url(#bite)">
            <circle cx="256" cy="268" r="150" fill={LIME} />
            <circle
              cx="256"
              cy="268"
              r="104"
              fill="none"
              stroke="#050505"
              strokeWidth="14"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - ring)}
              transform="rotate(-90 256 268)"
            />
          </g>
        </svg>
        <div
          style={{
            overflow: "hidden",
            width: 620 * slide,
            marginLeft: 26 * slide,
          }}
        >
          <div
            style={{
              translate: `${(1 - slide) * -200}px 0px`,
              opacity: slide,
              paddingBottom: 20,
            }}
          >
            <Wordmark size={250} />
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
