import React, { useState } from "react";
import "./App.css";

function App() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const convert = async () => {
    try {
      setBusy(true);
      setErr(null);
      // Call our (future) Netlify function
      const r = await fetch("/.netlify/functions/diacritice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: input })
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const { text } = await r.json();
      setOutput(text ?? "");
    } catch (e) {
      setErr(e.message || "Error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ maxWidth: 900, margin: "2rem auto", fontFamily: "system-ui" }}>
      <h1>Romanian Diacritics Converter</h1>
      <p>Paste Romanian text without diacritics and click Convert.</p>
      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
        <textarea
          rows={14}
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Paste text here…"
        />
        <textarea
          rows={14}
          readOnly
          value={busy ? "Processing…" : output}
          placeholder="Result with diacritics appears here"
        />
      </div>
      <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
        <button onClick={convert} disabled={!input || busy}>Convert</button>
        <button onClick={() => navigator.clipboard.writeText(output)} disabled={!output}>
          Copy result
        </button>
        <button onClick={() => { setInput(""); setOutput(""); setErr(null); }} disabled={busy}>
          Clear
        </button>
      </div>
      {err && <p style={{ color: "crimson" }}>{err}</p>}
      <details style={{ marginTop: 14 }}>
        <summary><strong>Notes</strong></summary>
        <ul>
          <li>Only **text** is sent to the serverless function (no files).</li>
          <li>For the moment we only allow writing text, no file upload. If the need be to upload files, let me know, and give 5 lei</li>
        </ul>
      </details>
    </div>
  );
}

export default App;
