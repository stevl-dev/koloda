import { markdownToHtml } from "@koloda/srs";
import { useMotionSetting } from "@koloda/ui";
import { motion } from "motion/react";
import { useMemo, useRef } from "react";
import type { FieldComponentProps } from "./lesson-card-field-types";
import { useAttachmentImages } from "./use-attachment-images";

export function LessonCardFieldMarkdown({ value }: FieldComponentProps) {
  const html = useMemo(() => markdownToHtml(value, { shouldKeepAttachmentImages: true }), [value]);
  // INVARIANT: the object keeps its identity while `html` does. React re-assigns `innerHTML` when it gets a new one,
  // which replaces the loaded `<img>`s with source-less copies, and `useAttachmentImages` re-runs only on new `html`.
  const innerHtml = useMemo(() => ({ __html: html }), [html]);
  const ref = useRef<HTMLDivElement>(null);
  const isMotionOn = useMotionSetting();
  useAttachmentImages(ref, html);

  return <motion.div ref={ref} dangerouslySetInnerHTML={innerHtml} layout={isMotionOn} />;
}
