import { createContext, useContext } from "react";
import type { MobileQueries } from "./queries";

// WHY: a context, not `queriesAtom`, which is typed as the whole `Queries`; the app implements only a `Pick` of it.
export const MobileQueriesContext = createContext<MobileQueries | null>(null);

export function useMobileQueries(): MobileQueries {
  const queries = useContext(MobileQueriesContext);
  if (!queries) throw new Error("useMobileQueries needs a MobileQueriesContext provider");
  return queries;
}
