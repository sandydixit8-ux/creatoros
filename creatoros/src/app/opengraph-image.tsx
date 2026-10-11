import { ImageResponse } from "next/og";

export const alt = "CreatorOS — Create. Grow. Sell. Automate. All in one place.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          backgroundImage:
            "linear-gradient(135deg, #6D28D9 0%, #7C3AED 50%, #db2777 100%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 30,
            letterSpacing: 6,
            opacity: 0.85,
          }}
        >
          CREATOROS
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: 28,
            fontSize: 78,
            fontWeight: 700,
            lineHeight: 1.1,
          }}
        >
          <span>Create. Grow. Sell.</span>
          <span>Automate.</span>
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 34,
            fontSize: 30,
            opacity: 0.92,
          }}
        >
          The all-in-one operating system for creators and businesses.
        </div>
      </div>
    ),
    { ...size }
  );
}