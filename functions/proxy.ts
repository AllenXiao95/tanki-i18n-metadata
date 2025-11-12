// Cloudflare Pages Functions 版本
// /api/proxy?url=<encoded image url>

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Expose-Headers': '*',
};

const ALLOW_HOSTS = [
  'cos.goover.cn',
];

function hostAllowed(hostname: string) {
  if (ALLOW_HOSTS.includes(hostname)) return true;
  // 简单通配示例：sun9-xx.userapi.com
  if (/^sun\d+\-.*\.userapi\.com$/i.test(hostname)) return true;
  return false;
}

export function onRequestOptions() {
  return new Response(null, { headers: CORS_HEADERS });
}

export async function onRequestGet(context: any) {
  const req: Request = context.request;
  const url = new URL(req.url);
  const target = url.searchParams.get('url') || '';

  if (!target) return new Response('Missing url', { status: 400, headers: CORS_HEADERS });

  let u: URL;
  try { u = new URL(target); } catch { return new Response('Bad url', { status: 400, headers: CORS_HEADERS }); }

  if (!/^https?:$/i.test(u.protocol)) {
    return new Response('Only http/https', { status: 400, headers: CORS_HEADERS });
  }
  if (!hostAllowed(u.hostname)) {
    return new Response('Host not allowed', { status: 403, headers: CORS_HEADERS });
  }

  // 可选：限制图片类型，避免代理到HTML/JS
  const accept = 'image/avif,image/webp,image/apng,image/*;q=0.8,*/*;q=0.5';

  try {
    const upstream = await fetch(u.toString(), {
      headers: {
        // 某些图源需要 Referer 才给图
        'Referer': 'https://tanki.onlyax.com/',
        'User-Agent': req.headers.get('User-Agent') || 'Mozilla/5.0',
        'Accept': accept,
      },
      // Pages Functions 同样支持 cf 缓存参数
      cf: { cacheEverything: true, cacheTtl: 3600 },
    });

    // 透传部分响应头（类型/长度等），并加上 CORS
    const h = new Headers(upstream.headers);
    h.set('Access-Control-Allow-Origin', '*');
    h.set('Access-Control-Expose-Headers', '*');
    h.set('Content-Disposition', 'inline');
    // 有些源可能没有 Content-Type；给个兜底
    if (!h.get('Content-Type')) h.set('Content-Type', 'application/octet-stream');

    // 可选：只允许图片 MIME
    const ct = (h.get('Content-Type') || '').toLowerCase();
    if (ct && !/^image\//.test(ct)) {
      return new Response('Upstream not image', { status: 415, headers: CORS_HEADERS });
    }

    return new Response(upstream.body, { status: upstream.status, headers: h });
  } catch (e) {
    return new Response('Upstream fetch failed', { status: 502, headers: CORS_HEADERS });
  }
}
