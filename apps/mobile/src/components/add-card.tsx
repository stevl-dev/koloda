import { useWriteMutation } from "@koloda/core-react";
import type { Card, Deck, Template } from "@koloda/srs";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useAppColors } from "../colors";
import { useMobileQueries } from "../host/queries-context";
import { CardForm } from "./card-form";

export type AddCardProps = {
  deck: Deck;
};

export function AddCard({ deck }: AddCardProps) {
  const { _ } = useLingui();
  const colors = useAppColors();
  const { getTemplateQuery } = useMobileQueries();
  const template = useQuery(getTemplateQuery(deck.templateId));

  if (template.error || template.data === null) {
    return <Text style={[styles.message, { color: colors.danger }]}>{_(msg`mobile.cards.add-no-template`)}</Text>;
  }
  if (!template.data) return null;
  return <AddCardForm deck={deck} template={template.data} />;
}

type AddCardFormProps = {
  deck: Deck;
  template: Template;
};

function AddCardForm({ deck, template }: AddCardFormProps) {
  const { _ } = useLingui();
  const colors = useAppColors();
  const { addCardMutation } = useMobileQueries();
  const { mutateAsync } = useWriteMutation(addCardMutation(), ["cards"]);
  const [addedCount, setAddedCount] = useState(0);
  const empty = useMemo<Card["content"]>(
    () => Object.fromEntries(template.content.fields.map(({ id }) => [id, { text: "" }])),
    [template],
  );

  return (
    <View style={styles.screen}>
      {addedCount > 0 && (
        <Text accessibilityRole="alert" style={[styles.notice, { color: colors.success }]}>
          {_(msg`mobile.cards.added ${addedCount}`)}
        </Text>
      )}
      <CardForm
        template={template}
        content={empty}
        submitLabel={_(msg`mobile.cards.add`)}
        onSubmit={async (content) => {
          await mutateAsync({ deckId: deck.id, templateId: template.id, content });
          setAddedCount((count) => count + 1);
          // INVARIANT: the form clears and stays open for the next card (CARDS.md §Adding Cards).
          return empty;
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  message: { padding: 16 },
  notice: { paddingHorizontal: 16, paddingTop: 16 },
});
