import { useQuery } from "@tanstack/react-query";
import { Stack, useLocalSearchParams } from "expo-router";
import { DeckCards } from "../../components/deck-cards";
import { useMobileQueries } from "../../host/queries-context";

export default function DeckRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getDecksQuery } = useMobileQueries();
  // WHY: the title comes from the decks query, not the link, so a rename synced from desktop shows here.
  const deck = useQuery(getDecksQuery()).data?.find((candidate) => candidate.id === id);

  return (
    <>
      <Stack.Screen options={{ title: deck?.title ?? "" }} />
      <DeckCards deckId={id} />
    </>
  );
}
