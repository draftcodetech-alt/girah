"use client";

export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "0 16px",
          background: "#FAF8F1",
          color: "#29302B",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <p style={{ color: "#526B5A", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", fontSize: 13 }}>
          Something went wrong
        </p>
        <h1 style={{ fontSize: 40, fontWeight: 500, margin: "12px 0 0" }}>Application error</h1>
        <p style={{ color: "#6F786F", maxWidth: 440, lineHeight: 1.6 }}>
          Girah could not load this page. Please try again
          {error.digest ? ` (reference ${error.digest})` : "."}
        </p>
        <button
          onClick={() => retry()}
          style={{
            marginTop: 24,
            height: 48,
            padding: "0 24px",
            border: 0,
            borderRadius: 6,
            background: "#526B5A",
            color: "#FAF8F1",
            fontSize: 15,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Try Again
        </button>
      </body>
    </html>
  );
}
