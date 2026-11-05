// 앞쪽 칸을 비운 후속 행은 윗행의 연속 항목으로 표시한다.
// 중간 빈칸, 전부 빈 행, 첫 행의 빈칸은 일반 셀로 남긴다.
export function mergeTableRows(rows) {
  const above = [];
  return rows.map(row => {
    const firstValue = row.findIndex(text => text.trim() !== "");
    const cells = row.flatMap((text, column) => {
      const anchor = above[column];
      if (column < firstValue && anchor?.text.trim()) {
        anchor.rowSpan += 1;
        return [];
      }
      const cell = { text, column, rowSpan: 1 };
      above[column] = cell;
      return [cell];
    });
    above.length = row.length;
    return cells;
  });
}
