import test from "node:test";
import assert from "node:assert/strict";
import { createProjectResolver } from "./notion-project.mjs";

const relation = (...ids) => ({ Project: { type: "relation", relation: ids.map((id) => ({ id })) } });

test("기존 스터디 글과 비어 있는 프로젝트는 추가 조회 없이 유지한다", async () => {
  const resolve = createProjectResolver(() => { throw new Error("조회하면 안 됨"); });
  assert.equal(await resolve({}), null);
  assert.equal(await resolve(relation()), null);
});

test("프로젝트 관계를 Slug로 연결하고 여러 글이 공유하는 프로젝트는 한 번만 조회한다", async () => {
  const calls = [];
  const resolve = createProjectResolver(async (id) => {
    calls.push(id);
    return { id, properties: { Slug: { rich_text: [{ plain_text: id === "energy-page" ? "p2" : "p1" }] } } };
  });
  assert.equal(await resolve(relation("energy-page")), "p2");
  assert.equal(await resolve(relation("energy-page")), "p2");
  assert.equal(await resolve(relation("plant-page")), "p1");
  assert.deepEqual(calls, ["energy-page", "plant-page"]);
});

test("Slug가 없는 프로젝트도 프로젝트 동기화와 같은 페이지 ID를 사용한다", async () => {
  const resolve = createProjectResolver(async () => ({ id: "abcd-1234", properties: {} }));
  assert.equal(await resolve(relation("abcd-1234")), "abcd1234");
});

test("잘못된 속성과 복수 프로젝트를 일반 스터디 글로 잘못 분류하지 않는다", async () => {
  const resolve = createProjectResolver(async () => { throw new Error("조회하면 안 됨"); });
  await assert.rejects(resolve({ Project: { type: "select" } }), /관계형/);
  await assert.rejects(resolve(relation("p1", "p2")), /하나만/);
  await assert.rejects(resolve({ Project: { ...relation("p1").Project, has_more: true } }), /하나만/);
});

test("프로젝트를 읽을 수 없거나 삭제되었으면 동기화를 실패시켜 이전 산출물을 보존한다", async () => {
  const denied = createProjectResolver(async () => { throw new Error("권한 없음"); });
  await assert.rejects(denied(relation("hidden")), /권한 없음/);
  const archived = createProjectResolver(async () => ({ id: "old", archived: true }));
  await assert.rejects(archived(relation("old")), /휴지통/);
});
