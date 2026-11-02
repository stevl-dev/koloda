import {
  columnResizingFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  createSortedRowModel,
  createTableHook,
  rowPinningFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_text,
  tableFeatures,
  tableOptions,
} from "@tanstack/react-table";

const lessonsTableFeatures = tableFeatures({
  columnSizingFeature,
  columnVisibilityFeature,
  columnResizingFeature,
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  // WHY: sortFn auto resolves plain string columns to "text"; title is string|null.
  sortFns: { alphanumeric: sortFn_alphanumeric, text: sortFn_text },
  rowPinningFeature,
});

const lessonsTableOptions = tableOptions({
  features: lessonsTableFeatures,
  enableColumnResizing: true,
  columnResizeMode: "onChange",
  keepPinnedRows: true,
});

export const { useAppTable: useLessonsTable, createAppColumnHelper: createLessonsColumnHelper } = createTableHook({
  ...lessonsTableOptions,
});
