import { useNumberFormatter, useTimestampFormatter } from "@koloda/core-react";
import { FSRS_GRADES } from "@koloda/srs";
import type { Card, Deck } from "@koloda/srs";
import { CARD_STATES } from "@koloda/srs-react/cards";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { CardMarkdown } from "../cards/card-markdown";
import { useAppColors } from "../colors";
import { useMobileQueries } from "../host/queries-context";

export type CardViewProps = {
  deckId: Deck["id"];
  cardId: Card["id"];
};

export function CardView({ deckId, cardId }: CardViewProps) {
  const { _ } = useLingui();
  const colors = useAppColors();
  const { getCardsQuery } = useMobileQueries();
  // WHY: a card has no detail entry; the view reads it from its deck's list, which every card write refreshes.
  const cards = useQuery(getCardsQuery({ deckId }));
  const card = cards.data?.find((candidate) => candidate.id === cardId);

  if (cards.error) {
    return <Text style={[styles.message, { color: colors.danger }]}>{_(msg`mobile.cards.error`)}</Text>;
  }
  if (!cards.data) return null;
  // WHY: another device can delete the card while it is open; the list then refreshes without it.
  if (!card) return <Text style={[styles.message, { color: colors.text }]}>{_(msg`mobile.card.missing`)}</Text>;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <CardContent card={card} />
      <CardDetails card={card} />
    </ScrollView>
  );
}

type CardPartProps = {
  card: Card;
};

function CardContent({ card }: CardPartProps) {
  const { _ } = useLingui();
  const colors = useAppColors();
  const { getTemplateQuery } = useMobileQueries();
  const template = useQuery(getTemplateQuery(card.templateId));

  if (template.error || template.data === null) {
    return <Text style={{ color: colors.danger }}>{_(msg`mobile.card.no-template`)}</Text>;
  }
  if (!template.data) return null;

  return template.data.content.fields.map(({ id, title, type }) => {
    const text = card.content[id]?.text ?? "";
    return (
      <Section key={id} title={title}>
        {type === "markdown" ? (
          <CardMarkdown text={text} />
        ) : (
          <Text style={[styles.text, { color: colors.text }]}>{text}</Text>
        )}
      </Section>
    );
  });
}

function CardDetails({ card }: CardPartProps) {
  const { _ } = useLingui();
  const colors = useAppColors();
  const formatTimestamp = useTimestampFormatter();
  const formatNumber = useNumberFormatter();
  const state = CARD_STATES[card.state];
  const isGraded = card.state > 0;
  const value = (text: string) => <Text style={[styles.text, { color: colors.text }]}>{text}</Text>;

  return (
    <>
      {state && <Section title={_(msg`mobile.card.state`)}>{value(_(state.t))}</Section>}
      {isGraded && card.dueAt && (
        <Section title={_(msg`mobile.card.due-at`)}>{value(formatTimestamp(card.dueAt, "datetime"))}</Section>
      )}
      {isGraded && <Section title={_(msg`mobile.card.stability`)}>{value(formatNumber(card.stability, 2))}</Section>}
      {isGraded && <Section title={_(msg`mobile.card.difficulty`)}>{value(formatNumber(card.difficulty, 2))}</Section>}
      {isGraded && <Section title={_(msg`mobile.card.lapses`)}>{value(String(card.lapses))}</Section>}
      {isGraded && <CardReviews card={card} />}
      <Section title={_(msg`mobile.card.created-at`)}>{value(formatTimestamp(card.createdAt, "datetime"))}</Section>
      {card.updatedAt && (
        <Section title={_(msg`mobile.card.updated-at`)}>{value(formatTimestamp(card.updatedAt, "datetime"))}</Section>
      )}
    </>
  );
}

function CardReviews({ card }: CardPartProps) {
  const { _ } = useLingui();
  const colors = useAppColors();
  const formatTimestamp = useTimestampFormatter();
  const { getReviewsQuery } = useMobileQueries();
  const reviews = useQuery(getReviewsQuery({ cardId: card.id }));

  return (
    <Section title={_(msg`mobile.card.reviews`)}>
      {reviews.error && <Text style={{ color: colors.danger }}>{_(msg`mobile.card.reviews-error`)}</Text>}
      {reviews.data?.map((review) => (
        <View key={review.id} style={styles.review}>
          <Text style={{ color: colors.muted }}>{formatTimestamp(review.createdAt, "datetime")}</Text>
          <Text style={[styles.grade, { color: colors.text }]}>{_(FSRS_GRADES[review.rating - 1])}</Text>
        </View>
      ))}
    </Section>
  );
}

type SectionProps = {
  title: string;
  children: ReactNode;
};

function Section({ title, children }: SectionProps) {
  const colors = useAppColors();

  return (
    <View style={styles.section}>
      <Text style={[styles.title, { color: colors.muted }]}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  message: { padding: 16 },
  content: { padding: 16, gap: 20 },
  section: { gap: 6 },
  title: { fontSize: 13 },
  text: { fontSize: 16, lineHeight: 24 },
  review: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  grade: { fontWeight: "600" },
});
