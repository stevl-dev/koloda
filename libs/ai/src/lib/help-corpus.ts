import { HELP_TOPICS } from "./help-corpus.generated";

type HelpSection = { heading: string; depth: 2 | 3; markdown: string };

export type HelpTopic = {
  id: string;
  title: string;
  summary: string;
  intro: string;
  sections: HelpSection[];
};

type HelpTopicRead = { title: string; section?: string; markdown: string };

export const HELP_TOPIC_INDEX = HELP_TOPICS.map((topic) => `- ${topic.id}: ${topic.summary}`).join("\n");

function sameHeading(a: string, b: string) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export function readHelpTopic(topicId: string, section?: string): HelpTopicRead {
  const topic = HELP_TOPICS.find((candidate) => candidate.id === topicId);
  if (!topic) {
    const ids = HELP_TOPICS.map((candidate) => candidate.id).join(", ");
    throw new Error(`Unknown help topic "${topicId}". Topics: ${ids}.`);
  }
  if (section === undefined) {
    return { title: topic.title, markdown: topic.intro + topic.sections.map((part) => part.markdown).join("") };
  }

  const start = topic.sections.findIndex((part) => sameHeading(part.heading, section));
  if (start === -1) {
    const headings = topic.sections.map((part) => part.heading).join(", ");
    throw new Error(`Help topic "${topicId}" has no section "${section}". Sections: ${headings}.`);
  }
  const found = topic.sections[start];
  const end = topic.sections.findIndex((part, index) => index > start && part.depth <= found.depth);
  const parts = topic.sections.slice(start, end === -1 ? undefined : end);
  return { title: topic.title, section: found.heading, markdown: parts.map((part) => part.markdown).join("") };
}
