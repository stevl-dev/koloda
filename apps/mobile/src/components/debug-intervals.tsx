import { dateFnsLocale } from "@koloda/app";
import { createFSRSScheduler, DEFAULT_FSRS_ALGORITHM, FSRS_GRADES } from "@koloda/srs";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { formatDistanceStrict } from "date-fns";
import { StyleSheet, Text, View } from "react-native";

export function DebugIntervals() {
  const { _ } = useLingui();
  const scheduler = createFSRSScheduler(DEFAULT_FSRS_ALGORITHM);
  const now = new Date();
  const grades = [...scheduler.preview({ card: scheduler.newCard({ now }), now })];
  const locale = dateFnsLocale("en");

  return (
    <View style={styles.screen}>
      <Text>{_(msg`mobile.debug.intervals`)}</Text>
      {grades.map(({ grade, card, revlog }) => (
        <View style={styles.row} key={grade}>
          <Text>{_(FSRS_GRADES[grade - 1])}</Text>
          <Text>{formatDistanceStrict(card.dueAt, revlog.reviewTime, { locale })}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { padding: 16, gap: 8 },
  row: { flexDirection: "row", justifyContent: "space-between" },
});
