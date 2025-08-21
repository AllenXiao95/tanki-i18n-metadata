export const onRequestPost: PagesFunction<{ EVENTS_KV: KVNamespace }> = async (ctx) => {
  const { request, env } = ctx;

  // 简单 CORS（同源即可）
  const cors = {
    "Access-Control-Allow-Origin": new URL(request.url).origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
  };
  if (request.method === "OPTIONS") return new Response(null, { headers: cors });

  // 读取 body 并做体积限制
  const text = await request.text();
  if (text.length > 16 * 1024) return new Response("payload too large", { status: 413, headers: cors });

  let evt: any;
  try { evt = JSON.parse(text); } catch { return new Response("bad json", { status: 400, headers: cors }); }
  if (!evt?.name) return new Response("missing name", { status: 400, headers: cors });

  // 附加服务端元数据
  const now = Date.now();
  const ip = request.headers.get("CF-Connecting-IP") || "";
  const colo = request.headers.get("CF-Ray") || "";
  const record = { ...evt, ip, colo, received: now };

  // key：按天分桶 + 随机
  const day = new Date(now).toISOString().slice(0,10); // YYYY-MM-DD
  const key = `events:${record.name}:${day}:${crypto.randomUUID()}`;

  // 写入 KV，设置 TTL（例如保留 180 天）
  await env.track_event.put(key, JSON.stringify(record), {
    expirationTtl: 60 * 60 * 24 * 180,
  });

  return new Response("ok", { headers: cors });
};
