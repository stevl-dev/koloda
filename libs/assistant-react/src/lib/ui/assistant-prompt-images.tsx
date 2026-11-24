import { conversationImageUrl, modelAcceptsImages, parseConversationImageUrl } from "@koloda/ai";
import type { AIModel, AIProfile } from "@koloda/ai";
import { toFormErrors } from "@koloda/app";
import type { FormError } from "@koloda/app";
import {
  getImageFiles,
  isDroppableFileType,
  queriesAtom,
  readImageFile,
  shouldInsertDroppedFile,
} from "@koloda/core-react";
import { ATTACHMENT_MIMES } from "@koloda/srs";
import { Button, CloseIcon, ErrorMessage, Errors, ImageIcon, Tooltip } from "@koloda/ui";
import type { MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAtomValue, useSetAtom } from "jotai";
import { useEffect, useRef, useState } from "react";
import type { ClipboardEvent, DragEvent, PropsWithChildren } from "react";
import { FileTrigger } from "react-aria-components";
import { addAssistantPromptImageAtom, removeAssistantPromptImageAtom } from "../state/conversation-actions";
import { assistantPromptImagesAtom } from "../state/conversation-selectors";
import { currentConversationIdAtom } from "../state/conversation-store";

/** Whether the selected model takes images (AI-MODEL-INPUT.md §Image Input); `hidden` when no model is selected. */
export type ImageInputState = "enabled" | "unsupported" | "unknown" | "hidden";

export function getImageInputState(
  modelId: string,
  model: AIModel | undefined,
  profile: Pick<AIProfile, "imageInputModelIds"> | undefined,
): ImageInputState {
  if (!modelId) return "hidden";
  // WHY: a selected model missing from the list (AI-PROVIDERS.md §Allowlist) says nothing, so it is unknown.
  const known = model ?? { id: modelId, name: modelId, context_length: 0 };
  if (modelAcceptsImages(known, profile?.imageInputModelIds)) return "enabled";
  return known.has_image_input === false ? "unsupported" : "unknown";
}

const DISABLED_REASONS: Record<"unsupported" | "unknown", MessageDescriptor> = {
  unsupported: msg`ai.chat.images.unsupported`,
  unknown: msg`ai.chat.images.unknown`,
};

type Feedback = { errors: FormError[]; reason: MessageDescriptor | null };

const NO_FEEDBACK: Feedback = { errors: [], reason: null };

// INVARIANT: feedback belongs to the draft it was shown for; another conversation shows none.
// A key, not an effect on the id: an attach that mints a conversation keeps its errors for the minted one.
type KeyedFeedback = Feedback & { conversationId: string | null };

export type UseAssistantImageAttachOptions = {
  imageInput: ImageInputState;
  onConversationIdChange: (id: string) => void;
};

export function useAssistantImageAttach({ imageInput, onConversationIdChange }: UseAssistantImageAttachOptions) {
  const conversationId = useAtomValue(currentConversationIdAtom);
  const addImage = useSetAtom(addAssistantPromptImageAtom);
  const { addConversationAttachmentMutation } = useAtomValue(queriesAtom);
  const { mutateAsync } = useMutation(addConversationAttachmentMutation());
  const [keyedFeedback, setKeyedFeedback] = useState<KeyedFeedback>({ ...NO_FEEDBACK, conversationId: null });
  const [isAttaching, setIsAttaching] = useState(false);
  const isAttachingRef = useRef(false);
  const feedback = keyedFeedback.conversationId === conversationId ? keyedFeedback : NO_FEEDBACK;

  const attach = async (files: File[]) => {
    if (files.length === 0) return;
    if (imageInput === "unsupported" || imageInput === "unknown") {
      setKeyedFeedback({ errors: [], reason: DISABLED_REASONS[imageInput], conversationId });
      return;
    }
    if (imageInput === "hidden" || isAttachingRef.current) return;
    isAttachingRef.current = true;
    setIsAttaching(true);
    setKeyedFeedback({ ...NO_FEEDBACK, conversationId });
    let mintedId: string | null = null;
    const errors: FormError[] = [];
    try {
      for (const file of files) {
        try {
          const attachment = await mutateAsync(await readImageFile(file));
          const image = { url: conversationImageUrl(attachment.id), mediaType: attachment.mime };
          // WHY: the first image may mint the conversation; the rest join that one.
          mintedId = addImage({ conversationId: conversationId ?? mintedId, image }) ?? mintedId;
        } catch (error) {
          errors.push(...Object.values(toFormErrors(error)).flat());
        }
      }
    } finally {
      isAttachingRef.current = false;
      setIsAttaching(false);
    }
    setKeyedFeedback({ errors, reason: null, conversationId: conversationId ?? mintedId });
    if (mintedId) onConversationIdChange(mintedId);
  };

  const handlePaste = (event: ClipboardEvent<HTMLElement>) => {
    const files = getImageFiles(event.clipboardData.files);
    if (files.length === 0) return;
    // WHY: a browser "Copy image" also puts HTML on the clipboard; the image data wins.
    event.preventDefault();
    void attach(files);
  };

  const handleDragOver = (event: DragEvent<HTMLElement>) => {
    const items = Array.from(event.dataTransfer.items);
    if (items.some((item) => item.kind === "file" && isDroppableFileType(item.type))) event.preventDefault();
  };

  const attachDropped = async (files: File[]) => {
    // WHY: as in the card editor, an untyped file that is not an image is skipped without an error.
    const isKept = await Promise.all(files.map(shouldInsertDroppedFile));
    await attach(files.filter((_, index) => isKept[index]));
  };

  const handleDrop = (event: DragEvent<HTMLElement>) => {
    const files = Array.from(event.dataTransfer.files).filter((file) => isDroppableFileType(file.type));
    if (files.length === 0) return;
    event.preventDefault();
    void attachDropped(files);
  };

  return { attach, handlePaste, handleDragOver, handleDrop, feedback, isAttaching };
}

export type AssistantAttachImageProps = {
  imageInput: ImageInputState;
  isAttaching: boolean;
  onSelect: (files: File[]) => void;
};

export function AssistantAttachImage({ imageInput, isAttaching, onSelect }: AssistantAttachImageProps) {
  const { _ } = useLingui();
  if (imageInput === "hidden") return null;
  const reason = imageInput === "enabled" ? null : DISABLED_REASONS[imageInput];

  return (
    <div className="relative self-end p-1">
      <FileTrigger
        acceptedFileTypes={[...ATTACHMENT_MIMES]}
        allowsMultiple
        onSelect={(files) => onSelect(Array.from(files ?? []))}
      >
        <Button
          variants={{ style: "ghost", size: "icon", class: "rounded-xl" }}
          aria-label={_(msg`ai.chat.images.attach`)}
          isDisabled={reason !== null || isAttaching}
        >
          <ImageIcon className="size-5 min-w-5" strokeWidth={1.75} aria-hidden="true" />
        </Button>
      </FileTrigger>
      {reason && (
        <Tooltip content={_(reason)}>
          <Tooltip.Trigger variants={{ isHidden: true, isDisabled: true }} aria-label={_(reason)} />
        </Tooltip>
      )}
    </div>
  );
}

export type AssistantPromptImagesProps = { feedback: Feedback; areImagesBlocked: boolean };

export function AssistantPromptImages({ feedback, areImagesBlocked }: AssistantPromptImagesProps) {
  const { _ } = useLingui();
  const images = useAtomValue(assistantPromptImagesAtom);
  const removeImage = useSetAtom(removeAssistantPromptImageAtom);
  const hasFeedback = feedback.errors.length > 0 || feedback.reason !== null;
  if (images.length === 0 && !hasFeedback && !areImagesBlocked) return null;

  return (
    <div className="flex flex-col gap-2 w-full max-w-3xl mx-auto pb-2">
      {images.length > 0 && (
        <ul className="flex flex-row flex-wrap gap-2" aria-label={_(msg`ai.chat.images.list`)}>
          {images.map(({ url }) => (
            <li key={url} className="relative">
              <ConversationImage url={url} className="size-16 rounded-lg object-cover border-2 border-input" />
              <Button
                variants={{
                  style: "ghost",
                  size: "icon",
                  class: "absolute -top-2 -right-2 size-6 rounded-full bg-input",
                }}
                aria-label={_(msg`ai.chat.images.remove`)}
                onPress={() => removeImage(url)}
              >
                <CloseIcon className="size-4 min-w-4" aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      {areImagesBlocked && <ErrorMessage layout="inline" message={_(msg`ai.chat.images.blocked`)} />}
      {feedback.reason && <ErrorMessage layout="inline" message={_(feedback.reason)} />}
      {feedback.errors.length > 0 && <Errors errors={feedback.errors} />}
    </div>
  );
}

export type ConversationImageProps = { url: string; className?: string };

export function ConversationImage({ url, className }: ConversationImageProps) {
  const { _ } = useLingui();
  const src = useConversationImageSrc(url);
  return <img src={src ?? undefined} alt={_(msg`ai.chat.images.alt`)} className={className} />;
}

function useConversationImageSrc(url: string) {
  const id = parseConversationImageUrl(url) ?? "";
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

export type AssistantImageDropZoneProps = PropsWithChildren & {
  onPaste: (event: ClipboardEvent<HTMLElement>) => void;
  onDragOver: (event: DragEvent<HTMLElement>) => void;
  onDrop: (event: DragEvent<HTMLElement>) => void;
};

// WHY: capture, so a pasted image is taken before the token field inserts the clipboard's text or HTML.
export function AssistantImageDropZone({ onPaste, onDragOver, onDrop, children }: AssistantImageDropZoneProps) {
  return (
    <div className="contents" onPasteCapture={onPaste} onDragOver={onDragOver} onDrop={onDrop}>
      {children}
    </div>
  );
}
