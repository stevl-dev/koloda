import { useAppHotkey, useHotkeysSettings } from "@koloda/core-react";
import { TokenField } from "@koloda/ui";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { useRef, useState } from "react";
import { TokenFieldValue } from "react-aria-components";

export type AIChatPromptInputProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
};

function toFieldValue(text: string) {
  const end = { index: 0, offset: text.length };
  return new TokenFieldValue([{ type: "text", text }], { selectedRange: new TokenFieldValue.SelectedRange(end) });
}

export function AIChatPromptInput({ value, onChange, onSubmit }: AIChatPromptInputProps) {
  const { _ } = useLingui();
  const { ui, ai } = useHotkeysSettings();
  const inputRef = useRef<HTMLDivElement>(null);
  const [field, setField] = useState(() => ({ value, fieldValue: toFieldValue(value) }));

  // WHY: the field keeps its own `TokenFieldValue`, which carries the caret and undo history a string cannot.
  // `field.value` is the last `value` prop seen, not the field's text.
  // The field is rebuilt only when that prop changes to text the field does not already hold:
  // revert, restore, submit, and switching conversations. Typing echoes back unchanged and keeps the caret.
  if (field.value !== value) {
    const isEcho = field.fieldValue.toString() === value;
    setField({ value, fieldValue: isEcho ? field.fieldValue : toFieldValue(value) });
  }

  const handleChange = (fieldValue: TokenFieldValue) => {
    setField((prev) => ({ ...prev, fieldValue }));
    onChange(fieldValue.toString());
  };

  useAppHotkey(ai.focusPrompt, () => inputRef.current?.focus(), "", { ignoreInputs: false });
  useAppHotkey(
    ui.submit,
    () => {
      if (document.activeElement === inputRef.current) onSubmit();
    },
    "",
    { ignoreInputs: false, conflictBehavior: "allow" },
  );

  return (
    <TokenField
      variants={{ class: "w-full m-0.5 rounded-2xl outline-offset-1" }}
      aria-label={_(msg`ai.chat.input.label`)}
      value={field.fieldValue}
      onChange={handleChange}
      onSubmit={onSubmit}
      allowsNewlines
      autoFocus
    >
      <TokenField.Input
        variants={{ style: "inline", class: "rounded-xl" }}
        placeholder={_(msg`ai.chat.input.placeholder`)}
        maxRows={6}
        ref={inputRef}
      >
        {(segment) => <TokenField.Token>{segment.text}</TokenField.Token>}
      </TokenField.Input>
    </TokenField>
  );
}
