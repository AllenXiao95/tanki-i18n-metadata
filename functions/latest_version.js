export async function onRequest(context) {
  const version = "2.2"; // 你也可以从 context.env 或环境变量中读取
  return new Response(JSON.stringify({ version }), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    }
  });
}
