import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";

export function QueryLoading() {
  const { _ } = useLingui();

  return (
    <div className="flex items-center justify-center py-4">
      <p className="fg-level-4">{_(msg`query-loading.message`)}</p>
    </div>
  );
}
