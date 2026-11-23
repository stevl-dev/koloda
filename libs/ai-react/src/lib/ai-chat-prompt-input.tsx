import { formatMention, parseMentionText } from "@koloda/ai";
import type { Mention, MentionKind } from "@koloda/ai";
import { useAppHotkey, useHotkeysSettings } from "@koloda/core-react";
import { Popover, TokenField } from "@koloda/ui";
import type { MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { Autocomplete, Menu, MenuItem, Text, TokenFieldValue } from "react-aria-components";
import { tokenFieldPositionToDOMRange } from "react-aria/useTokenField";

export type AIChatPromptInputProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  mentions?: Mention[];
};

type MentionFieldValue = TokenFieldValue<Mention>;
type MentionFieldSegment = MentionFieldValue["segments"][number];
type Position = MentionFieldValue["caretPosition"];
type MentionQuery = { anchor: Position; anchorKey: string; query: string };

const MENTION_KIND_LABELS: Record<MentionKind, MessageDescriptor> = {
  deck: msg`ai.chat.mention.kind.deck`,
  template: msg`ai.chat.mention.kind.template`,
  algorithm: msg`ai.chat.mention.kind.algorithm`,
};

// `@` at the start of the text or after whitespace, so an email address does not open the list.
const MENTION_TRIGGER = /(?<=^|\s)@/;

const mentionMenuItem = [
  "flex flex-row items-center justify-between gap-4 mx-1 py-2 px-2",
  "outline-none rounded-lg cursor-default select-none",
  "focus:bg-picker-item-hover",
].join(" ");

function toFieldValue(text: string): MentionFieldValue {
  const segments: MentionFieldSegment[] = parseMentionText(text).map((part) =>
    part.type === "text" ? part : { type: "token", text: part.mention.title, value: part.mention },
  );
  // WHY: the caret needs a text segment to sit in after a trailing chip, and an empty value still needs one.
  if (segments.at(-1)?.type !== "text") segments.push({ type: "text", text: "" });
  const end = { index: segments.length - 1, offset: segments[segments.length - 1].text.length };
  return new TokenFieldValue<Mention>(segments, { selectedRange: new TokenFieldValue.SelectedRange(end) });
}

function toText(fieldValue: MentionFieldValue): string {
  return fieldValue.segments
    .map((segment) => (segment.type === "token" && segment.value ? formatMention(segment.value) : segment.text))
    .join("");
}

function findMentionQuery(fieldValue: MentionFieldValue): MentionQuery | null {
  if (!fieldValue.selectedRange.isCollapsed) return null;
  const caret = fieldValue.caretPosition;
  const segment = fieldValue.segments[caret.index];
  if (segment?.type !== "text") return null;
  const anchor = fieldValue.findText(caret, TokenFieldValue.Direction.Backward, MENTION_TRIGGER);
  if (!anchor || anchor.index !== caret.index) return null;
  const query = segment.text.slice(anchor.offset + 1, caret.offset);
  if (query.includes("\n")) return null;
  return { anchor, anchorKey: `${anchor.index}:${anchor.offset}`, query };
}

export function AIChatPromptInput({ value, onChange, onSubmit, mentions = [] }: AIChatPromptInputProps) {
  const { _, i18n } = useLingui();
  const { ui, ai } = useHotkeysSettings();
  const inputRef = useRef<HTMLDivElement>(null);
  const [field, setField] = useState(() => ({ value, fieldValue: toFieldValue(value) }));
  const [dismissedAnchorKey, setDismissedAnchorKey] = useState<string | null>(null);

  // WHY: the field keeps its own `TokenFieldValue`, which carries the caret and undo history a string cannot.
  // `field.value` is the last `value` prop seen, not the field's text.
  // The field is rebuilt only when that prop changes to text the field does not already hold:
  // revert, restore, submit, and switching conversations. Typing echoes back unchanged and keeps the caret.
  if (field.value !== value) {
    const isEcho = toText(field.fieldValue) === value;
    setField({ value, fieldValue: isEcho ? field.fieldValue : toFieldValue(value) });
  }

  const handleChange = (fieldValue: MentionFieldValue) => {
    setField((prev) => ({ ...prev, fieldValue }));
    onChange(toText(fieldValue));
  };

  const sortedMentions = useMemo(() => {
    const collator = new Intl.Collator(i18n.locale);
    return [...mentions].sort((a, b) => collator.compare(a.title, b.title));
  }, [mentions, i18n.locale]);

  const mentionQuery = findMentionQuery(field.fieldValue);
  // WHY: a dismissal holds only while its `@` is the one being typed after; a new `@` at the same offset reopens.
  if (dismissedAnchorKey !== null && mentionQuery?.anchorKey !== dismissedAnchorKey) setDismissedAnchorKey(null);
  const query = mentionQuery?.query.toLocaleLowerCase(i18n.locale);
  const matches = useMemo(
    () =>
      query === undefined
        ? []
        : sortedMentions.filter((mention) => mention.title.toLocaleLowerCase(i18n.locale).includes(query)),
    [query, sortedMentions, i18n.locale],
  );
  const isListOpen = mentionQuery != null && matches.length > 0 && mentionQuery.anchorKey !== dismissedAnchorKey;

  const pickMention = (mention: Mention) => {
    if (!mentionQuery) return;
    const { fieldValue } = field;
    handleChange(
      fieldValue.replaceRangeWithSegments(
        mentionQuery.anchor,
        fieldValue.caretPosition,
        [
          { type: "token", text: mention.title, value: mention },
          { type: "text", text: " " },
        ],
        false,
      ),
    );
  };

  // WHY: a capture handler on a wrapper, not `TokenField`'s `onKeyDown`: react-aria stops the propagation of every
  // key that reaches a handler passed there, and the app's hotkeys listen on the document.
  // It checks the target because keys Autocomplete forwards to the list pass through here too.
  const handleKeyDownCapture = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!isListOpen || e.target !== inputRef.current) return;
    if (e.key === "Escape") setDismissedAnchorKey(mentionQuery.anchorKey);
    // WORKAROUND: Autocomplete highlights the first item only when the filter changes while the list is mounted,
    // so right after `@` nothing is highlighted and Enter would submit. Pick the first match instead;
    // with an item highlighted, Autocomplete picks it.
    if (e.key === "Enter" && !e.shiftKey && !inputRef.current.hasAttribute("aria-activedescendant")) {
      e.preventDefault();
      pickMention(matches[0]);
    }
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
    <div className="contents" onKeyDownCapture={handleKeyDownCapture}>
      <Autocomplete>
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
        <Popover
          variants={{ class: "min-w-64 max-w-96 max-h-80 overflow-y-auto" }}
          triggerRef={inputRef}
          isOpen={isListOpen}
          isNonModal
          placement="top start"
          trigger="MenuTrigger"
          getTargetRect={(target) =>
            mentionQuery ? tokenFieldPositionToDOMRange(target, mentionQuery.anchor).getBoundingClientRect() : null
          }
        >
          {/* WHY: Autocomplete forwards the field's keys to the list, outside the field, and they would bubble to the
            document as if typed there, where the app's single-key hotkeys would take them. */}
          <div onKeyDown={(e) => e.stopPropagation()}>
            <Menu<Mention>
              className="py-1 outline-none"
              aria-label={_(msg`ai.chat.mention.list.label`)}
              items={matches}
              dependencies={[mentionQuery?.anchorKey]}
            >
              {(mention) => (
                <MenuItem
                  id={`${mention.kind}:${mention.id}`}
                  textValue={mention.title}
                  className={mentionMenuItem}
                  onAction={() => pickMention(mention)}
                >
                  <Text slot="label" className="truncate fg-level-1">
                    {mention.title}
                  </Text>
                  <Text slot="description" className="shrink-0 text-sm fg-level-3">
                    {_(MENTION_KIND_LABELS[mention.kind])}
                  </Text>
                </MenuItem>
              )}
            </Menu>
          </div>
        </Popover>
      </Autocomplete>
    </div>
  );
}
