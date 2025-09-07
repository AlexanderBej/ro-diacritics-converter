// netlify/functions/diacritice.js
const DEFAULT_MODEL = "iliemihai/mt5-base-romanian-diacritics";
const HF_MODEL = process.env.HF_MODEL || DEFAULT_MODEL;
const HF_URL = `https://api-inference.huggingface.co/models/${HF_MODEL}`;

function splitIntoChunks(text, max = 1500) {
  const parts = text.split(/(?<=[\.\!\?\n])/);
  const out = [];
  let buf = "";
  for (const p of parts) {
    if ((buf + p).length > max && buf) { out.push(buf); buf = ""; }
    buf += p;
  }
  if (buf) out.push(buf);
  return out;
}

// --- Lightweight Romanian heuristic fallback ---
// Intentionally conservative to avoid wrong replacements in legal text.
function rulesBasedRestore(text) {
  const pairs = [
    [/\bSi\b/g, "Și"], [/\bsi\b/g, "și"],
    [/\bIntre\b/g, "Între"], [/\bintre\b/g, "între"],
    [/(\s|^)In(\s)/g, "$1În$2"], [/\bin\b/g, "în"], // standalone "in" -> "în"
    [/\bdupa\b/gi, "după"], [/\bpana\b/gi, "până"],
    [/\bramane\b/g, "rămâne"], [/\braman\b/g, "rămân"],
    [/\bRamane\b/g, "Rămâne"], [/\bRaman\b/g, "Rămân"],
    [/\bsapte\b/g, "șapte"], [/\bSapte\b/g, "Șapte"],
    [/\bcate\b/g, "câte"], [/\bCate\b/g, "Câte"],
    [/\bforta\b/gi, "forța"], [/\bmajora\b/gi, "majoră"],
    [/\bintarzier/gi, "întârzier"],
    [/\bordonante\b/g, "ordonanțe"], [/\bhotarari\b/g, "hotărâri"],
    [/\bOrdonante\b/g, "Ordonanțe"], [/\bHotarari\b/g, "Hotărâri"],
    [/\bconfidential/gi, "confidențial"], [/\bcomert/gi, "comerț"],
    [/\breclamatii\b/gi, "reclamații"], [/\bplati\b/gi, "plăți"],
  ];
  for (const [re, rep] of pairs) text = text.replace(re, rep);
  // families
  text = text.replace(/\bcondit(i[ea]|\w*)/g, (_, tail) => "condiț" + tail);
  text = text.replace(/\bCondit(i[ea]|\w*)/g, (_, tail) => "Condiț" + tail);
  text = text.replace(/\bconferinta\b/g, "conferință")
             .replace(/\bconferinte\b/g, "conferințe")
             .replace(/\bConferinte\b/g, "Conferințe");
  return text;
}

exports.handler = async (event) => {
  if (event.httpMethod === "GET") {
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true, model: HF_MODEL, usage: "POST { text: '...' }" })
    };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  let text;
  try {
    ({ text } = JSON.parse(event.body || "{}"));
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON" }) };
  }
  if (!text || typeof text !== "string") {
    return { statusCode: 400, body: JSON.stringify({ error: "Provide 'text' string" }) };
  }
  if (text.length > 30000) {
    return { statusCode: 413, body: JSON.stringify({ error: "Text too large. Please split it." }) };
  }

  const token = process.env.HF_TOKEN;

  // Try HF first if we have a token
  if (token) {
    try {
      const chunks = splitIntoChunks(text);
      const outputs = [];
      for (const chunk of chunks) {
        const r = await fetch(HF_URL, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          body: JSON.stringify({ inputs: chunk, options: { wait_for_model: true, use_cache: false } })
        });
        const body = await r.text();
        if (!r.ok) {
          // Log exact HF error to function logs, fall back
          console.error("HF error", r.status, body);
          throw new Error(`HF ${r.status}`);
        }
        let data;
        try { data = JSON.parse(body); } catch { data = body; }
        const out = Array.isArray(data) && data[0]?.generated_text
          ? data[0].generated_text
          : typeof data === "string" ? data : "";
        outputs.push(out);
      }
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: outputs.join(""), engine: "huggingface" })
      };
    } catch (e) {
      // fall through to heuristic
    }
  }

  // Fallback (works without HF)
  const recovered = rulesBasedRestore(text);
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: recovered, engine: "heuristic" })
  };
};
