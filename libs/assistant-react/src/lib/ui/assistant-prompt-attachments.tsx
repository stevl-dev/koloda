import { conversationAttachmentUrl, parseConversationAttachmentUrl } from "@koloda/ai";
import { toFormErrors } from "@koloda/app";
import type { FormError } from "@koloda/app";
import { queriesAtom } from "@koloda/core-react";
import { AttachmentIcon, Button, CloseIcon, ErrorMessage, Errors, FileIcon } from "@koloda/ui";
import type { MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAtomValue, useSetAtom } from "jotai";
import { useEffect, useRef, useState } from "react";
import type { ClipboardEvent, DragEvent, PropsWithChildren } from "react";
import { FileTrigger } from "react-aria-components";
import { addAssistantPromptAttachmentAtom, removeAssistantPromptAttachmentAtom } from "../state/conversation-actions";
import { assistantPromptAttachmentsAtom } from "../state/conversation-selectors";
import { currentConversationIdAtom } from "../state/conversation-store";
import type { PromptAttachment } from "../state/conversation-types";
import type { InputState, InputStates } from "./conversation-files";
import {
  ATTACHABLE_FILE_TYPES,
  getConversationFileKind,
  getConversationFileKindOfMime,
  isUntypedFile,
  readConversationFile,
} from "./conversation-files";

const REFUSED_REASONS: Record<"image" | "pdf", Record<Exclude<InputState, "enabled">, MessageDescriptor>> = {
  image: { unsupported: msg`ai.chat.images.unsupported`, unknown: msg`ai.chat.images.unknown` },
  pdf: { unsupported: msg`ai.chat.pdf.unsupported`, unknown: msg`ai.chat.pdf.unknown` },
};

type Feedback = { errors: FormError[]; reasons: MessageDescriptor[] };

const NO_FEEDBACK: Feedback = { errors: [], reasons: [] };

// INVARIANT: feedback belongs to the draft it was shown for; another conversation shows none.
// A key, not an effect on the id: an attach that mints a conversation keeps its errors for the minted one.
type KeyedFeedback = Feedback & { conversationId: string | null };

export type UseAssistantFileAttachOptions = {
  inputs: InputStates;
  onConversationIdChange: (id: string) => void;
};

export function useAssistantFileAttach({ inputs, onConversationIdChange }: UseAssistantFileAttachOptions) {
  const conversationId = useAtomValue(currentConversationIdAtom);
  const addAttachment = useSetAtom(addAssistantPromptAttachmentAtom);
  const { addConversationAttachmentMutation } = useAtomValue(queriesAtom);
  const { mutateAsync } = useMutation(addConversationAttachmentMutation());
  const [keyedFeedback, setKeyedFeedback] = useState<KeyedFeedback>({ ...NO_FEEDBACK, conversationId: null });
  const [isAttaching, setIsAttaching] = useState(false);
  const isAttachingRef = useRef(false);
  const feedback = keyedFeedback.conversationId === conversationId ? keyedFeedback : NO_FEEDBACK;

  const attach = async (files: File[]) => {
    if (files.length === 0 || inputs === null || isAttachingRef.current) return;
    isAttachingRef.current = true;
    setIsAttaching(true);
    setKeyedFeedback({ ...NO_FEEDBACK, conversationId });
    let mintedId: string | null = null;
    const errors: FormError[] = [];
    const reasons = new Set<MessageDescriptor>();
    try {
      for (const file of files) {
        const kind = await getConversationFileKind(file);
        if (kind === null) {
          // WHY: as in the card editor, an untyped dropped file that is not an image is skipped without an error.
          if (!isUntypedFile(file)) errors.push({ message: "validation.conversation-attachments.format" });
          continue;
        }
        if (kind !== "text" && inputs[kind] !== "enabled") {
          reasons.add(REFUSED_REASONS[kind][inputs[kind]]);
          continue;
        }
        try {
          const stored = await mutateAsync(await readConversationFile(file, kind));
          const attachment: PromptAttachment = {
            url: conversationAttachmentUrl(stored.id),
            mediaType: stored.mime,
            ...(kind === "image" ? {} : { filename: file.name }),
          };
          // WHY: the first file may mint the conversation; the rest join that one.
          mintedId = addAttachment({ conversationId: conversationId ?? mintedId, attachment }) ?? mintedId;
        } catch (error) {
          errors.push(...Object.values(toFormErrors(error)).flat());
        }
      }
    } finally {
      isAttachingRef.current = false;
      setIsAttaching(false);
    }
    setKeyedFeedback({ errors, reasons: [...reasons], conversationId: conversationId ?? mintedId });
    if (mintedId) onConversationIdChange(mintedId);
  };

  const handlePaste = (event: ClipboardEvent<HTMLElement>) => {
    const files = Array.from(event.clipboardData.files);
    if (files.length === 0) return;
    // WHY: a browser "Copy image" also puts HTML on the clipboard; the file data wins.
    event.preventDefault();
    void attach(files);
  };

  const handleDragOver = (event: DragEvent<HTMLElement>) => {
    if (Array.from(event.dataTransfer.items).some((item) => item.kind === "file")) event.preventDefault();
  };

  const handleDrop = (event: DragEvent<HTMLElement>) => {
    const files = Array.from(event.dataTransfer.files);
    if (files.length === 0) return;
    event.preventDefault();
    void attach(files);
  };

  return { attach, handlePaste, handleDragOver, handleDrop, feedback, isAttaching };
}

export type AssistantAttachFilesProps = {
  inputs: InputStates;
  isAttaching: boolean;
  onSelect: (files: File[]) => void;
};

export function AssistantAttachFiles({ inputs, isAttaching, onSelect }: AssistantAttachFilesProps) {
  const { _ } = useLingui();
  if (inputs === null) return null;

  return (
    <div className="self-end p-1">
      <FileTrigger
        acceptedFileTypes={ATTACHABLE_FILE_TYPES}
        allowsMultiple
        onSelect={(files) => onSelect(Array.from(files ?? []))}
      >
        <Button
          variants={{ style: "ghost", size: "icon", class: "rounded-xl" }}
          aria-label={_(msg`ai.chat.attachments.attach`)}
          isDisabled={isAttaching}
        >
          <AttachmentIcon className="size-5 min-w-5" strokeWidth={1.75} aria-hidden="true" />
        </Button>
      </FileTrigger>
    </div>
  );
}

const fileChip = [
  "flex flex-row items-center gap-2 h-16 max-w-48 px-3",
  "rounded-lg border-2 border-input fg-level-2",
].join(" ");

export type AssistantPromptAttachmentsProps = { feedback: Feedback; blockedReasons: MessageDescriptor[] };

export function AssistantPromptAttachments({ feedback, blockedReasons }: AssistantPromptAttachmentsProps) {
  const { _ } = useLingui();
  const attachments = useAtomValue(assistantPromptAttachmentsAtom);
  const removeAttachment = useSetAtom(removeAssistantPromptAttachmentAtom);
  const hasFeedback = feedback.errors.length > 0 || feedback.reasons.length > 0;
  if (attachments.length === 0 && !hasFeedback && blockedReasons.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 w-full max-w-3xl mx-auto pb-2">
      {attachments.length > 0 && (
        <ul className="flex flex-row flex-wrap gap-2" aria-label={_(msg`ai.chat.attachments.list`)}>
          {attachments.map((attachment) => (
            <li key={attachment.url} className="relative">
              {getConversationFileKindOfMime(attachment.mediaType) === "image" ? (
                <ConversationImage
                  url={attachment.url}
                  className="size-16 rounded-lg object-cover border-2 border-input"
                />
              ) : (
                <ConversationFileChip filename={attachment.filename} className={fileChip} />
              )}
              <Button
                variants={{
                  style: "ghost",
                  size: "icon",
                  class: "absolute -top-2 -right-2 size-6 rounded-full bg-input",
                }}
                aria-label={_(msg`ai.chat.attachments.remove`)}
                onPress={() => removeAttachment(attachment.url)}
              >
                <CloseIcon className="size-4 min-w-4" aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      {blockedReasons.map((reason) => (
        <ErrorMessage key={reason.id} layout="inline" message={_(reason)} />
      ))}
      {feedback.reasons.map((reason) => (
        <ErrorMessage key={reason.id} layout="inline" message={_(reason)} />
      ))}
      {feedback.errors.length > 0 && <Errors errors={feedback.errors} />}
    </div>
  );
}

export type ConversationFileChipProps = { filename: string | undefined; className?: string };

export function ConversationFileChip({ filename, className }: ConversationFileChipProps) {
  const { _ } = useLingui();
  return (
    <span className={className}>
      <FileIcon className="size-5 min-w-5" strokeWidth={1.75} aria-hidden="true" />
      <span className="truncate">{filename ?? _(msg`ai.chat.attachments.unnamed`)}</span>
    </span>
  );
}

export type ConversationImageProps = { url: string; className?: string };

export function ConversationImage({ url, className }: ConversationImageProps) {
  const { _ } = useLingui();
  const src = useConversationImageSrc(url);
  return <img src={src ?? undefined} alt={_(msg`ai.chat.images.alt`)} className={className} />;
}

function useConversationImageSrc(url: string) {
  const id = parseConversationAttachmentUrl(url) ?? "";
  const { getConversationAttachmentQuery } = useAtomValue(queriesAtom);
  const { data } = useQuery({ ...getConversationAttachmentQuery(id), enabled: id !== "" });
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    const objectUrl = URL.createObjectURL(new Blob([data.bytes], { type: data.mime }));
    setSrc(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [data]);

  return src;
}

export type AssistantFileDropZoneProps = PropsWithChildren & {
  onPaste: (event: ClipboardEvent<HTMLElement>) => void;
  onDragOver: (event: DragEvent<HTMLElement>) => void;
  onDrop: (event: DragEvent<HTMLElement>) => void;
};

// WHY: capture, so a pasted file is taken before the token field inserts the clipboard's text or HTML.
export function AssistantFileDropZone({ onPaste, onDragOver, onDrop, children }: AssistantFileDropZoneProps) {
  return (
    <div className="contents" onPasteCapture={onPaste} onDragOver={onDragOver} onDrop={onDrop}>
      {children}
    </div>
  );
}
