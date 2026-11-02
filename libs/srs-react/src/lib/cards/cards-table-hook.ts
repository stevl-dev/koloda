import {
  columnFilteringFeature,
  columnOrderingFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  createTableHook,
  filterFn_includesString,
  globalFilteringFeature,
  rowPaginationFeature,
  rowPinningFeature,
  rowSelectionFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_datetime,
  sortFn_text,
  tableFeatures,
  tableOptions,
} from "@tanstack/react-table";

const cardsTableFeatures = tableFeatures({
  columnSizingFeature,
  columnVisibilityFeature,
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  // WHY: sortFn auto resolves content strings to "text" and Date columns (dueAt/createdAt/updatedAt) to "datetime".
  sortFns: { alphanumeric: sortFn_alphanumeric, text: sortFn_text, datetime: sortFn_datetime },
  rowPinningFeature,
  columnFilteringFeature,
  globalFilteringFeature,
  filteredRowModel: createFilteredRowModel(),
  filterFns: { includesString: filterFn_includesString },
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(),
  rowSelectionFeature,
  columnOrderingFeature,
});

export type CardsTableFeatures = typeof cardsTableFeatures;

const cardsTableOptions = tableOptions({
  features: cardsTableFeatures,
  // WHY: the default resets to page 1 whenever `data` changes, and the cards table refetches its
  // list after every edit. The cards table resets the page on search and filter, and clamps it.
  autoResetPageIndex: false,
});

export const { useAppTable: useCardsTable, createAppColumnHelper: createCardsColumnHelper } = createTableHook({
  ...cardsTableOptions,
});
