import {
  columnSizingFeature,
  columnVisibilityFeature,
  createSortedRowModel,
  rowPinningFeature,
  rowSelectionFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_text,
  tableFeatures,
  tableOptions,
} from "@tanstack/react-table";

const selectionTableFeatures = tableFeatures({
  columnSizingFeature,
  columnVisibilityFeature,
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  // WHY: sortFn auto resolves plain string field columns to "text".
  sortFns: { alphanumeric: sortFn_alphanumeric, text: sortFn_text },
  rowPinningFeature,
  rowSelectionFeature,
});

export const selectionTableOptions = tableOptions({
  features: selectionTableFeatures,
});

export type SelectionTableFeatures = typeof selectionTableFeatures;
