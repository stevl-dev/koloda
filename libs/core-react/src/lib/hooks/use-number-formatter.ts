import { formatNumber } from "@koloda/app";
import type { NumberFormatter } from "@koloda/app";
import { langAtom } from "../atoms";
import { useAtomValue } from "jotai";
import { useCallback } from "react";

export function useNumberFormatter(): NumberFormatter {
  const locale = useAtomValue(langAtom);

  return useCallback((value, fractionDigits = 0) => formatNumber(value, fractionDigits, locale), [locale]);
}
