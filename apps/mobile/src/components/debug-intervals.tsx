import { dateFnsLocale } from "@koloda/app";
import { createCardFromCardFSRS, DEFAULT_FSRS_ALGORITHM, FSRS_GRADES, getCardGrades } from "@koloda/srs";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { formatDistanceStrict } from "date-fns";
import { StyleSheet, Text, View } from "react-native";
import { createEmptyCard } from "ts-fsrs";

export function DebugIntervals() {
  const { _ } = useLingui();
  const card = createCardFromCardFSRS(createEmptyCard(new Date()));
  const grades = getCardGrades(card, { content: DEFAULT_FSRS_ALGORITHM });
  const locale = dateFnsLocale("en");

  return (
    <View style={styles.screen}>
      <Text>{_(msg`mobile.debug.intervals`)}</Text>
      {grades.map(({ card, log }, i) => (
        <View style={styles.row} key={i}>
          <Text>{_(FSRS_GRADES[i])}</Text>
          <Text>{formatDistanceStrict(card.due, log.review, { locale })}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { padding: 16, gap: 8 },
  row: { flexDirection: "row", justifyContent: "space-between" },
});
