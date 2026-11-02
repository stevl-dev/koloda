import { createTableHook } from "@tanstack/react-table";
import { selectionTableOptions } from "./table-features";

// WHY: createTableHook binds TFeatures at the hook. A single wide useAppTable would
// force unused features onto simple tables and weaken types/tree-shaking. Pair each
// named preset with its own hook; the cards and lessons presets live in srs-react.
const { useAppTable: useSelectionTable, createAppColumnHelper: createSelectionColumnHelper } = createTableHook({
  ...selectionTableOptions,
});

export { useSelectionTable, createSelectionColumnHelper };
