export type RowLayout = { y: number; height: number };

// The index a lifted row drops at: the number of other rows whose middle its middle has passed.
// INVARIANT: these run on the UI thread during a drag (`draggable-row.tsx`), so each stays a worklet.
export function dropIndex(layouts: readonly RowLayout[], from: number, offset: number): number {
  "worklet";
  const lifted = layouts[from];
  if (!lifted) return from;
  const middle = lifted.y + lifted.height / 2 + offset;
  let index = 0;
  for (let i = 0; i < layouts.length; i++) {
    if (i === from) continue;
    const row = layouts[i];
    if (row && row.y + row.height / 2 < middle) index++;
  }
  return index;
}

// How far a row that is not lifted moves to make room while the lifted row hovers at `to`; `slot` is the lifted row's
// height with the gap below it.
export function rowShift(index: number, from: number, to: number, slot: number): number {
  "worklet";
  if (from < to && index > from && index <= to) return -slot;
  if (to < from && index >= to && index < from) return slot;
  return 0;
}
