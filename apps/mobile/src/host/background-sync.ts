import { starterContent } from "@koloda/native-host";
import { i18n } from "@lingui/core";
import * as BackgroundTask from "expo-background-task";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";
import { registerSecretVault } from "../../modules/koloda-secrets";
import { activateLanguage, deviceLanguage } from "../i18n";
import { call, wireArgs } from "./facade";
import { openFacade } from "./open-facade";

const BACKGROUND_SYNC_TASK = "koloda-background-sync";

// WHY: the shortest interval WorkManager allows; the system may run it later.
const MINIMUM_INTERVAL_MINUTES = 15;

// INVARIANT: defined when the bundle loads, from its entry (`index.ts`). A background run loads the bundle in a
// process the system may have started for it, and mounts no screen, so no route file runs.
TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
  try {
    // WHY: the starter content is named in the active language; a process started for this run has none yet.
    if (!i18n.locale) activateLanguage(deviceLanguage());
    if (Platform.OS === "android") registerSecretVault();
    const facade = openFacade();
    await call(() => facade.syncTick(wireArgs(starterContent(i18n._.bind(i18n)))));
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

// WHY: registered on every start; registering again keeps the one schedule. A phone in no space keeps it too, since
// `koloda-mobile` skips the run there, so joining needs no second registration.
export function registerBackgroundSync(): Promise<void> {
  return BackgroundTask.registerTaskAsync(BACKGROUND_SYNC_TASK, { minimumInterval: MINIMUM_INTERVAL_MINUTES });
}
