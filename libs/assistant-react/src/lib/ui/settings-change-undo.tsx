import {
  applySettingsValues,
  parseSettingsChanges,
  saveSettingsRows,
  SETTINGS_CHANGE_ROWS,
  splitSettingsChangeField,
} from "@koloda/ai";
import type { SettingsChange, SettingsChangeRow, SettingsRowContents } from "@koloda/ai";
import { ERROR_MESSAGES, formatAppError } from "@koloda/app";
import { queriesAtom } from "@koloda/core-react";
import { Button, ErrorMessage } from "@koloda/ui";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAtomValue, useSetAtom } from "jotai";
import { useState } from "react";
import { notifySavedSettings } from "../runs/settings-change-notification";
import { markSettingsChangeUndoneAtom } from "../state/conversation-actions";
import { currentConversationIdAtom } from "../state/conversation-store";
import type { RunToolCall } from "../state/conversation-types";

type UndoSettingsChangeOptions = {
  changes: SettingsChange[];
  readRow: (row: SettingsChangeRow) => Promise<Record<string, unknown>>;
  saveRow: (row: SettingsChangeRow, content: Record<string, unknown>) => Promise<unknown>;
};

/**
 * Write each changed setting's old value back, reading the rows fresh.
 * A setting changed since the change is overwritten (ASSISTANT-SETTINGS-CHANGES.md §Undo).
 */
export async function undoSettingsChange({ changes, readRow, saveRow }: UndoSettingsChangeOptions): Promise<void> {
  const rows: SettingsRowContents = {};
  for (const row of SETTINGS_CHANGE_ROWS) {
    if (changes.some(({ field }) => splitSettingsChangeField(field).row === row)) rows[row] = await readRow(row);
  }
  const next = applySettingsValues(
    rows,
    changes.map(({ field, from }) => ({ field, value: from })),
  );
  await saveSettingsRows(rows, next, saveRow);
}

export type SettingsChangeUndoProps = {
  runId: string;
  call: RunToolCall;
};

export function SettingsChangeUndo({ runId, call }: SettingsChangeUndoProps) {
  const { _ } = useLingui();
  const conversationId = useAtomValue(currentConversationIdAtom);
  const { getSettingsQuery, setSettingsMutation } = useAtomValue(queriesAtom);
  const queryClient = useQueryClient();
  const { mutateAsync: saveSettings } = useMutation(setSettingsMutation());
  const markUndone = useSetAtom(markSettingsChangeUndoneAtom);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const changes = parseSettingsChanges(call.output);
  if (call.status !== "success" || changes === null || changes.length === 0) return null;
  if (call.undone) return <span className="px-1 fg-level-4">{_(msg`ai.chat.settings-change.undone`)}</span>;

  const undo = async () => {
    setIsPending(true);
    setError(null);
    try {
      await undoSettingsChange({
        changes,
        readRow: async (row) => {
          const saved = await queryClient.fetchQuery({ ...getSettingsQuery(row), staleTime: 0 });
          if (saved == null) throw new Error(`No ${row} settings are saved`);
          return saved.content as Record<string, unknown>;
        },
        // WHY: the content is a row read back with one field set per change; the save checks it whole.
        saveRow: (name, content) => saveSettings({ name, content } as Parameters<typeof saveSettings>[0]),
      });
      notifySavedSettings(changes.map(({ field, from }) => ({ field, value: from })));
      if (conversationId) markUndone({ conversationId, runId, callId: call.id });
    } catch (undoError) {
      setError(undoError);
    } finally {
      setIsPending(false);
    }
  };

  const errorProps = error ? formatAppError(error, _, ERROR_MESSAGES["db.update"]) : null;

  return (
    <div className="flex flex-col items-start gap-1">
      <Button variants={{ style: "ghost", size: "small" }} onPress={undo} isDisabled={isPending}>
        {_(msg`ai.chat.settings-change.undo`)}
      </Button>
      {errorProps ? <ErrorMessage {...errorProps} /> : null}
    </div>
  );
}
