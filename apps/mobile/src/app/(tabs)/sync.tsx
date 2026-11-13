import { ScrollView, StyleSheet } from "react-native";
import { SyncPanel } from "../../components/sync-panel";

export default function SyncTab() {
  return (
    <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      <SyncPanel />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { padding: 16, gap: 16 },
});
