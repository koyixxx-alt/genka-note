// 読み取り用のサーバー関数（Netlify Functions）
// ブラウザから受け取った画像とプロンプトを Claude に渡し、返ってきた文章をそのまま返す。
// API キーはサーバーの環境変数 ANTHROPIC_API_KEY に置き、ブラウザには渡さない。
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();
const TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8" } });

export default async (req) => {
  if (req.method !== "POST") return json({ error: "method" }, 405);
  // 合言葉（APP_PASSCODE）を設定しているときは、一致しないリクエストを断る
  const pass = process.env.APP_PASSCODE;
  if (pass && req.headers.get("x-app-pass") !== pass) return json({ error: "passcode" }, 401);
  if (!process.env.ANTHROPIC_API_KEY) return json({ error: "no_api_key" }, 500);

  let body;
  try { body = await req.json(); } catch { return json({ error: "bad_request" }, 400); }
  const prompt = typeof body.prompt === "string" ? body.prompt : "";
  const images = Array.isArray(body.images) ? body.images : [];
  if (!prompt || prompt.length > 60000 || images.length > 5) return json({ error: "bad_request" }, 400);
  for (const i of images) {
    if (!i || !TYPES.has(i.media_type) || typeof i.data !== "string" || i.data.length > 5_000_000) return json({ error: "bad_request" }, 400);
  }

  const content = [
    ...images.map((i) => ({ type: "image", source: { type: "base64", media_type: i.media_type, data: i.data } })),
    { type: "text", text: prompt },
  ];
  try {
    const response = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      // 書類の読み取りは定型作業なので考える量を抑えて速くする
      output_config: { effort: "low" },
      // 安全上の理由で断られたときは、サーバー側で別のモデルに切り替えて続ける
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      messages: [{ role: "user", content }],
    });
    if (response.stop_reason === "refusal") return json({ error: "refused" }, 422);
    const text = response.content.filter((b) => b.type === "text").map((b) => b.text).join("");
    return json({ text, truncated: response.stop_reason === "max_tokens" });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) return json({ error: "no_api_key" }, 500);
    if (error instanceof Anthropic.RateLimitError) return json({ error: "rate_limited" }, 429);
    if (error instanceof Anthropic.BadRequestError) return json({ error: "bad_request", message: error.message }, 400);
    if (error instanceof Anthropic.APIError) return json({ error: "upstream_error", message: error.message }, 502);
    return json({ error: "upstream_error" }, 502);
  }
};

export const config = { path: "/api/read" };
