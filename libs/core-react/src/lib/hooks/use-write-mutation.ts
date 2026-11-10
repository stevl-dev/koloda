import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { UseMutationOptions } from "@tanstack/react-query";
import { refreshKinds } from "../cache-refresh";
import type { DataKind } from "../cache-refresh";

export function useWriteMutation<TData, TError, TVariables, TContext>(
  options: UseMutationOptions<TData, TError, TVariables, TContext>,
  kinds: readonly DataKind[],
) {
  const queryClient = useQueryClient();

  return useMutation({
    ...options,
    // WHY: the refresh is a mutation-level callback, not a per-call `mutate` one. TanStack runs per-call
    // callbacks only while the calling component is mounted, so a write that settles after a dialog
    // closes or a route changes would leave the screens that read its rows stale.
    onSuccess: (...args) => {
      refreshKinds(queryClient, kinds);
      return options.onSuccess?.(...args);
    },
  });
}
