import { queriesAtom } from "@koloda/core-react";
import { useMutation } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import { useEffect } from "react";

// WHY: an image pasted into a card or a conversation that is not saved yet (here or in another web tab)
// has no ref so far; the grace window keeps it until that card or conversation can be saved.
const SWEEP_GRACE_MS = 24 * 60 * 60 * 1000;

// WHY: once per app session — App remounts on the not-found route and under StrictMode.
let hasSwept = false;

export function useAttachmentSweep() {
  const { sweepAttachmentsMutation, sweepConversationAttachmentsMutation } = useAtomValue(queriesAtom);
  const { mutate } = useMutation({
    ...sweepAttachmentsMutation(),
    onError: (error) => console.error("Failed to sweep unreferenced attachments", error),
  });
  const { mutate: mutateConversations } = useMutation({
    ...sweepConversationAttachmentsMutation(),
    onError: (error) => console.error("Failed to sweep unreferenced conversation images", error),
  });

  useEffect(() => {
    if (hasSwept) return;
    hasSwept = true;
    const createdBefore = new Date(Date.now() - SWEEP_GRACE_MS);
    mutate({ createdBefore });
    mutateConversations({ createdBefore });
  }, [mutate, mutateConversations]);
}
