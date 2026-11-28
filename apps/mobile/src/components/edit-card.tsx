import { queryKeys, useWriteMutation } from "@koloda/core-react";
import type { Card, Deck } from "@koloda/srs";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { StyleSheet, Text } from "react-native";
import { useAppColors } from "../colors";
import { useMobileQueries } from "../host/queries-context";
import { CardForm } from "./card-form";

export type EditCardProps = {
  deckId: Deck["id"];
  cardId: Card["id"];
  onSaved: () => void;
};

export function EditCard({ deckId, cardId, onSaved }: EditCardProps) {
  const { _ } = useLingui();
  const colors = useAppColors();
  const queryClient = useQueryClient();
  const { getCardsQuery, getTemplateQuery, updateCardMutation } = useMobileQueries();
  const cards = useQuery(getCardsQuery({ deckId }));
  const card = cards.data?.find((candidate) => candidate.id === cardId);
  const template = useQuery({ ...getTemplateQuery(card?.templateId ?? ""), enabled: !!card });
  const { mutateAsync } = useWriteMutation(updateCardMutation(), ["cards"]);
  const message = (text: string, color: string) => <Text style={[styles.message, { color }]}>{text}</Text>;

  if (cards.error) return message(_(msg`mobile.cards.error`), colors.danger);
  if (!cards.data) return null;
  if (!card) return message(_(msg`mobile.card.missing`), colors.text);
  if (template.error || template.data === null) return message(_(msg`mobile.card.edit-no-template`), colors.danger);
  if (!template.data) return null;

  return (
    <CardForm
      template={template.data}
      content={card.content}
      submitLabel={_(msg`mobile.card.save`)}
      onSubmit={async (content) => {
        const saved = await mutateAsync({ id: card.id, values: { content } });
        // WHY: the view reads its card from the deck's list; a card has no detail entry. The saved row goes there
        // at once, so the view shows it before the refetch lands.
        queryClient.setQueryData<Card[]>(queryKeys.cards.deck({ deckId }), (list) =>
          list?.map((item) => (item.id === saved.id ? saved : item)),
        );
        onSaved();
        return saved.content;
      }}
    />
  );
}

const styles = StyleSheet.create({
  message: { padding: 16 },
});
