import { loadFont } from "@remotion/google-fonts/Inter";

// Inter at heavy weights is the closest Google font to the app's
// SF Pro Display 900 wordmark.
export const { fontFamily } = loadFont("normal", {
  weights: ["500", "600", "700", "800", "900"],
  subsets: ["latin"],
});

// Brand colors, copied from frontend/style.css in the timbi app.
export const LIME = "#B4F82A";
export const LIME_PALE = "#E4FBB8";
export const LIME_DARK = "#5E8C12";
export const CARD = "#1C1C1E";
export const GRAY = "#8E8E93";
