import { fontFamily, LIME } from "../fonts";

// "timbi" wordmark like the app: heavy, tight, lowercase, lime dots on the i's.
// Uses dotless ı so the lime dot can be drawn separately.
const Letter: React.FC<{ ch: string; dot?: boolean; size: number }> = ({
  ch,
  dot,
  size,
}) => (
  <span style={{ position: "relative", display: "inline-block" }}>
    {ch}
    {dot ? (
      <span
        style={{
          position: "absolute",
          left: "50%",
          top: size * 0.06,
          width: size * 0.2,
          height: size * 0.2,
          marginLeft: -size * 0.1,
          borderRadius: "50%",
          background: LIME,
        }}
      />
    ) : null}
  </span>
);

export const Wordmark: React.FC<{ size: number; color?: string }> = ({
  size,
  color = "#fff",
}) => (
  <div
    style={{
      fontFamily,
      fontSize: size,
      fontWeight: 900,
      letterSpacing: "-0.055em",
      lineHeight: 1,
      color,
      whiteSpace: "nowrap",
    }}
  >
    <Letter ch="t" size={size} />
    <Letter ch="ı" dot size={size} />
    <Letter ch="m" size={size} />
    <Letter ch="b" size={size} />
    <Letter ch="ı" dot size={size} />
  </div>
);
