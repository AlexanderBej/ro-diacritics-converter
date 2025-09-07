/* eslint-disable no-useless-escape */
const HF_MODEL = "iliemihai/mt5-base-romanian-diacritics";
const HF_URL = `https://api-inference.huggingface.co/models/${HF_MODEL}`;

// simple chunking to avoid long inputs
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

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const token = process.env.HF_TOKEN;
  if (!token) {
    return { statusCode: 500, body: "Missing HF_TOKEN env var" };
  }

  try {
    const { text } = JSON.parse(event.body || "{}");
    if (!text || typeof text !== "string") {
      return { statusCode: 400, body: JSON.stringify({ error: "Provide 'text' string" }) };
    }

    const chunks = splitIntoChunks(text);
    const results = [];

    for (const chunk of chunks) {
      const r = await fetch(HF_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ inputs: chunk })
      });
      if (!r.ok) {
        const msg = await r.text();
        throw new Error(`HF ${r.status}: ${msg}`);
      }
      const data = await r.json();
      results.push(Array.isArray(data) && data[0]?.generated_text ? data[0].generated_text : "");
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: results.join("") })
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message || "Server error" }) };
  }
};
