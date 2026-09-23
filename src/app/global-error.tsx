"use client";

/** Last-resort boundary for errors in the root layout. Renders its own document, so styles are inline. */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100dvh", display: "grid", placeItems: "center", background: "#faf7f0", color: "#0b0b0f", fontFamily: "system-ui, sans-serif" }}>
        <title>Something went wrong · SmashPoint</title>
        <main style={{ maxWidth: 440, padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 32, margin: "0 0 8px" }}>We fumbled that rally.</h1>
          <p style={{ margin: "0 0 20px", color: "#595966" }}>
            Something went wrong on our side{error.digest ? ` (ref ${error.digest})` : ""}. Please try again.
          </p>
          <button
            onClick={() => retry()}
            style={{ font: "inherit", fontWeight: 700, padding: "10px 20px", borderRadius: 12, border: "3px solid #0b0b0f", background: "#1f47ff", color: "#fff", boxShadow: "4px 4px 0 #0b0b0f", cursor: "pointer" }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
