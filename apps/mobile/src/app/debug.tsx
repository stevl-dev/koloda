import { ScrollView } from "react-native";
import { DebugIntervals } from "../components/debug-intervals";
import { SampleCard } from "../components/sample-card";
import { SampleDeck } from "../components/sample-deck";

export default function DebugScreen() {
  return (
    <ScrollView>
      <DebugIntervals />
      <SampleDeck />
      <SampleCard />
    </ScrollView>
  );
}
