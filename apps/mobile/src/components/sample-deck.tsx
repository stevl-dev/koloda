import {
  SEED_ALGORITHM_SIMPLE_ID,
  SEED_TEMPLATE_TYPE_BACK_FIELD_ID,
  SEED_TEMPLATE_TYPE_FRONT_FIELD_ID,
  SEED_TEMPLATE_TYPE_ID,
} from "@koloda/app";
import { queryKeys } from "@koloda/core-react";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Text, View } from "react-native";
import { useMobileQueries } from "../host/queries-context";

// WHY: card text is sample data, not interface copy, so it stays out of the catalog.
const WORDS: [string, string][] = [
  ["uno", "one"],
  ["dos", "two"],
  ["tres", "three"],
  ["cuatro", "four"],
  ["cinco", "five"],
  ["seis", "six"],
  ["siete", "seven"],
  ["ocho", "eight"],
  ["nueve", "nine"],
  ["diez", "ten"],
  ["once", "eleven"],
  ["doce", "twelve"],
];

export function SampleDeck() {
  const { _ } = useLingui();
  const queryClient = useQueryClient();
  const { addDeckMutation, addCardsMutation } = useMobileQueries();
  const { mutateAsync: addDeck } = useMutation(addDeckMutation());
  const { mutateAsync: addCards } = useMutation(addCardsMutation());
  const { mutate, isPending, isSuccess, isError } = useMutation({
    mutationFn: async () => {
      const deck = await addDeck({
        title: _(msg`mobile.debug.sample-deck-title`),
        algorithmId: SEED_ALGORITHM_SIMPLE_ID,
        templateId: SEED_TEMPLATE_TYPE_ID,
      });
      await addCards(
        WORDS.map(([front, back]) => ({
          deckId: deck.id,
          templateId: SEED_TEMPLATE_TYPE_ID,
          content: {
            [SEED_TEMPLATE_TYPE_FRONT_FIELD_ID]: { text: front },
            [SEED_TEMPLATE_TYPE_BACK_FIELD_ID]: { text: back },
          },
        })),
      );
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.decks.all() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.lessons.all() }),
      ]),
  });

  return (
    <View>
      <Button title={_(msg`mobile.debug.add-sample-deck`)} disabled={isPending} onPress={() => mutate()} />
      {isSuccess && <Text>{_(msg`mobile.debug.sample-deck-added`)}</Text>}
      {isError && <Text>{_(msg`mobile.debug.sample-deck-failed`)}</Text>}
    </View>
  );
}
