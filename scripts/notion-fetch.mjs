// 노션 API 요청을 직렬화하고 요청 제한 응답의 대기 시간을 지킨다.
export function createNotionFetch(fetchImpl, {
  intervalMs = 400,
  maxAttempts = 6,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now = Date.now,
  random = Math.random,
  warn = console.warn,
} = {}) {
  let queue = Promise.resolve();
  let nextStart = 0;
  return (...args) => {
    const request = queue.then(async () => {
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const pause = nextStart - now();
        if (pause > 0) await sleep(pause);
        nextStart = now() + intervalMs;
        const response = await fetchImpl(...args);
        if (![429, 529].includes(response.status)) return response;

        const body = await response.clone().json().catch(() => null);
        if (body?.additional_data?.rate_limit_reason === "public_api_request_blocked" || attempt === maxAttempts - 1) return response;
        const hint = response.headers.get("retry-after") ?? body?.additional_data?.retry_after;
        const seconds = hint == null || String(hint).trim() === "" ? NaN : Number(hint);
        const backoff = Math.min(2000 * 2 ** attempt, 30000);
        const delay = Math.max(Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : 0, backoff) + Math.floor(random() * 250);
        // 다음 요청도 같은 제한을 받으므로 큐 전체를 쉬게 한다.
        nextStart = Math.max(nextStart, now() + delay);
        await response.body?.cancel();
        warn(`· Notion 요청 제한(${response.status}) — ${delay}ms 대기 후 재시도 ${attempt + 1}/${maxAttempts - 1}`);
      }
    });
    // 한 요청이 실패해도 큐가 영구적으로 거부 상태에 머물지 않게 한다.
    queue = request.catch(() => {});
    return request;
  };
}
