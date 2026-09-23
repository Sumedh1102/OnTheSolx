import { ImageResponse } from "next/og";

export const alt = "SmashPoint Badminton Academy — Palghar";
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
          justifyContent: "space-between",
          padding: 64,
          background: "#faf7f0",
          backgroundImage: "linear-gradient(to right, rgba(11,11,15,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(11,11,15,0.06) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          fontFamily: "sans-serif",
          color: "#0b0b0f",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ width: 72, height: 72, borderRadius: 18, background: "#1f47ff", border: "5px solid #0b0b0f", boxShadow: "6px 6px 0 #0b0b0f" }} />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 40, fontWeight: 800 }}>SmashPoint.</div>
            <div style={{ fontSize: 20, letterSpacing: 6, fontWeight: 700, color: "#595966" }}>BADMINTON ACADEMY</div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 96, fontWeight: 800, lineHeight: 0.95, letterSpacing: -3 }}>Where Palghar</div>
          <div style={{ display: "flex", alignItems: "center", fontSize: 96, fontWeight: 800, lineHeight: 1.05, letterSpacing: -3 }}>
            learns to
            <span style={{ marginLeft: 24, padding: "0 20px", background: "#1f47ff", color: "white", border: "6px solid #0b0b0f", borderRadius: 18, boxShadow: "8px 8px 0 #0b0b0f" }}>smash.</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 16, fontSize: 28, fontWeight: 700 }}>
          {["5 courts", "10+ coaches", "Book online · 4 AM – 7 PM"].map((t) => (
            <div key={t} style={{ padding: "10px 20px", border: "4px solid #0b0b0f", borderRadius: 14, background: "white" }}>
              {t}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
