import { AppError, formatAppError } from "@koloda/app";
import type { ErrorCode } from "@koloda/app";
import { useWriteMutation } from "@koloda/core-react";
import type { DataKind } from "@koloda/core-react";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import type { UseMutationOptions } from "@tanstack/react-query";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useAppColors } from "../colors";
import { ActionButton } from "./action-button";

type Parsed<TData> =
  | { success: true; data: TData }
  | { success: false; error: { issues: readonly { path: readonly PropertyKey[]; message: string }[] } };

export type TitleFormProps<TData, TEntity> = {
  submitLabel: string;
  toData: (title: string) => TData;
  schema: { safeParse: (data: TData) => Parsed<TData> };
  mutation: UseMutationOptions<TEntity, AppError, TData, unknown>;
  kinds: readonly DataKind[];
  onDone: (entity: TEntity) => void;
};

export function TitleForm<TData, TEntity>({
  submitLabel,
  toData,
  schema,
  mutation,
  kinds,
  onDone,
}: TitleFormProps<TData, TEntity>) {
  const { _ } = useLingui();
  const colors = useAppColors();
  const { mutateAsync, isPending } = useWriteMutation(mutation, kinds);
  const [title, setTitle] = useState("");
  const [errors, setErrors] = useState<{ title?: string[]; form?: string[] }>({});
  const messageOf = (code: string) => formatAppError(new AppError(code as ErrorCode), _).message;

  const submit = async () => {
    const parsed = schema.safeParse(toData(title));
    if (!parsed.success) {
      const next: typeof errors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] === "title" ? "title" : "form";
        next[key] = [...new Set([...(next[key] ?? []), messageOf(issue.message)])];
      }
      setErrors(next);
      return;
    }
    let entity: TEntity;
    try {
      entity = await mutateAsync(parsed.data);
    } catch (error) {
      setErrors({ form: [formatAppError(error, _).message] });
      return;
    }
    onDone(entity);
  };

  const errorText = (key: keyof typeof errors) =>
    errors[key]?.map((message) => (
      <Text key={message} accessibilityRole="alert" style={{ color: colors.danger }}>
        {message}
      </Text>
    ));

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.field}>
          <Text style={{ color: colors.muted }}>{_(msg`mobile.title-form.title`)}</Text>
          <TextInput
            accessibilityLabel={_(msg`mobile.title-form.title`)}
            autoFocus
            value={title}
            onChangeText={setTitle}
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
          />
          {errorText("title")}
        </View>
      </ScrollView>
      <View style={styles.actions}>
        {errorText("form")}
        <ActionButton label={submitLabel} isDisabled={isPending} onPress={() => void submit()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 16, gap: 20 },
  field: { gap: 6 },
  input: { minHeight: 44, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, fontSize: 16 },
  actions: { padding: 16, gap: 8 },
});
