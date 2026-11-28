import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { useQuery } from "@tanstack/react-query";
import { Stack, useLocalSearchParams, usePreventRemove, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { useAppColors } from "../../../colors";
import { DeckCards } from "../../../components/deck-cards";
import { useMobileQueries } from "../../../host/queries-context";

export default function DeckRoute() {
  const { _ } = useLingui();
  const colors = useAppColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { getDecksQuery } = useMobileQueries();
  // WHY: the title comes from the decks query, not the link, so a rename synced from desktop shows here.
  const deck = useQuery(getDecksQuery()).data?.find((candidate) => candidate.id === id);
  const [selection, setSelection] = useState<string[] | null>(null);
  // WHY: the back button, the back gesture, and the header's back control all remove the screen; while cards are
  // selected, each of them ends the selection instead.
  usePreventRemove(selection !== null, () => setSelection(null));

  return (
    <>
      <Stack.Screen
        options={{
          title: deck?.title ?? "",
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              hitSlop={12}
              onPress={() => router.push({ pathname: "/deck/[id]/details", params: { id } })}
            >
              <Text style={[styles.details, { color: colors.link }]}>{_(msg`mobile.decks.details`)}</Text>
            </Pressable>
          ),
        }}
      />
      {deck && (
        <DeckCards
          deck={deck}
          onOpenCard={(cardId) => router.push({ pathname: "/deck/[id]/card/[cardId]", params: { id, cardId } })}
          onAdd={() => router.push({ pathname: "/deck/[id]/add", params: { id } })}
          selection={selection}
          onSelectionChange={setSelection}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  details: { fontSize: 16 },
});
