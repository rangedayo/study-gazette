import test from "node:test";
import assert from "node:assert/strict";
import { Client } from "@notionhq/client";
import { createNotionFetch } from "./notion-fetch.mjs";

function clock() {
  let time = 0;
  const waits = [];
  return { waits, now: () => time, sleep: async (ms) => { waits.push(ms); time += ms; }, random: () => 0, warn: () => {} };
}
const limited = (seconds, status = 429) => new Response(JSON.stringify({
  object: "error", status, code: status === 529 ? "service_overload" : "rate_limited",
  message: "limited", additional_data: { retry_after: seconds },
}), { status, headers: { "content-type": "application/json" } });

test("연속·동시 요청을 시작 간격 400ms로 직렬화한다", async () => {
  const timing = clock();
  const starts = [];
  const fetch = createNotionFetch(async () => { starts.push(timing.now()); return new Response("ok"); }, timing);
  await Promise.all([fetch("first"), fetch("second"), fetch("third")]);
  assert.deepEqual(starts, [0, 400, 800]);
});

test("실패 로그와 같은 retry_after=5초를 지킨 뒤 SDK 조회를 완료한다", async () => {
  const timing = clock();
  let calls = 0;
  const fetch = createNotionFetch(async () => ++calls === 1 ? limited("5") : new Response(JSON.stringify({ results: [], has_more: false })), timing);
  const client = new Client({ auth: "test-only", fetch, logger: () => {} });
  const result = await client.blocks.children.list({ block_id: "test-block" });
  assert.deepEqual(result.results, []);
  assert.equal(calls, 2);
  assert.deepEqual(timing.waits, [5000]);
});

test("Retry-After 헤더를 우선하고 60초가 넘는 대기도 줄이지 않는다", async () => {
  const timing = clock();
  let calls = 0;
  const fetch = createNotionFetch(async () => {
    if (++calls !== 1) return new Response("ok");
    const response = limited("2");
    response.headers.set("retry-after", "75");
    return response;
  }, timing);
  await fetch();
  assert.deepEqual(timing.waits, [75000]);
});

test("반복되는 429/529에는 대기를 늘리고 대기 중 다른 요청도 멈춘다", async () => {
  const timing = clock();
  const starts = [];
  let calls = 0;
  const fetch = createNotionFetch(async () => {
    starts.push(timing.now());
    return ++calls === 1 ? limited("2") : calls === 2 ? limited("2", 529) : new Response("ok");
  }, timing);
  await Promise.all([fetch(), fetch()]);
  assert.deepEqual(starts, [0, 2000, 6000, 6400]);
});

test("재시도 상한의 오류를 SDK에 돌려주고 인증 오류는 바로 반환한다", async () => {
  const timing = clock();
  let calls = 0;
  const fetch = createNotionFetch(async () => { calls++; return limited("invalid"); }, { ...timing, maxAttempts: 3 });
  assert.equal((await fetch()).status, 429);
  assert.equal(calls, 3);
  assert.deepEqual(timing.waits, [2000, 4000]);
  const unauthorized = createNotionFetch(async () => new Response("unauthorized", { status: 401 }), clock());
  assert.equal((await unauthorized()).status, 401);
});

test("API 접근 차단은 재시도하지 않는다", async () => {
  const timing = clock();
  const fetch = createNotionFetch(async () => new Response(JSON.stringify({ additional_data: { rate_limit_reason: "public_api_request_blocked" } }), { status: 429 }), timing);
  assert.equal((await fetch()).status, 429);
  assert.deepEqual(timing.waits, []);
});
