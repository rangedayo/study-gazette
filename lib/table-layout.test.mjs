import test from "node:test";
import assert from "node:assert/strict";
import { mergeTableRows } from "./table-layout.mjs";

test("MPC의 정책과 개념 칸만 두 행에 걸쳐 표시하고 모델·방식은 각각 유지한다", () => {
  const source = [["MPC", "제어 방법", "XGBoost", "예측값", "씀"], ["", "", "oracle", "실제값", "실제값"]];
  const before = structuredClone(source);
  const result = mergeTableRows(source);
  assert.deepEqual(result[0].map(c => c.rowSpan), [2, 2, 1, 1, 1]);
  assert.deepEqual(result[1].map(c => [c.column, c.text]), [[2, "oracle"], [3, "실제값"], [4, "실제값"]]);
  assert.deepEqual(source, before);
});

test("후속 행이 여러 개여도 새 그룹을 만나면 병합을 끝낸다", () => {
  const result = mergeTableRows([["A", "설명", "1"], ["", "", "2"], ["", "", "3"], ["B", "", "4"], ["", "", "5"]]);
  assert.equal(result[0][0].rowSpan, 3);
  assert.equal(result[0][1].rowSpan, 3);
  assert.equal(result[3][0].rowSpan, 2);
  assert.equal(result[3][1].rowSpan, 1);
  assert.equal(result[4].find(c => c.column === 1).text, "");
});

test("일반 빈칸, 맨 위 빈칸, 전체 빈 행은 임의로 병합하지 않는다", () => {
  const result = mergeTableRows([["", "첫 값"], ["A", ""], ["", ""], ["", "다음 값"]]);
  assert.deepEqual(result.map(row => row.length), [2, 2, 2, 2]);
  assert.ok(result.flat().every(c => c.rowSpan === 1));
  assert.deepEqual(mergeTableRows([]), []);
});
