import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Stack, useLocalSearchParams } from "expo-router";
import { CardView } from "../../../../components/card-view";

export default function CardRoute() {
  const { _ } = useLingui();
  const { id, cardId } = useLocalSearchParams<{ id: string; cardId: string }>();

  return (
    <>
      <Stack.Screen options={{ title: _(msg`mobile.card.title`) }} />
      <CardView deckId={id} cardId={cardId} />
    </>
  );
}
