import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: "50%",
          background: "#16213a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#D9A441",
          fontSize: 13,
          fontWeight: 700,
          fontFamily: "sans-serif",
        }}
      >
        SP
      </div>
    ),
    size
  );
}
