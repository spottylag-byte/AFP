import { ImageResponse } from "next/og";

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
          alignItems: "center",
          justifyContent: "center",
          background: "#16213A",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            width: 110,
            height: 110,
            borderRadius: "50%",
            border: "4px solid #D9A441",
            alignItems: "center",
            justifyContent: "center",
            color: "#D9A441",
            fontSize: 44,
            fontWeight: 700,
            marginBottom: 28,
          }}
        >
          SP
        </div>
        <div style={{ display: "flex", fontSize: 72, fontWeight: 700, color: "#F6F2E9" }}>
          Soccer Point
        </div>
        <div style={{ display: "flex", fontSize: 28, color: "#C7D0DE", marginTop: 16 }}>
          Verified grassroots football, across Africa
        </div>
      </div>
    ),
    size
  );
}
