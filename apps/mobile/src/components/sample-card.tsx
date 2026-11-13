import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { useMutation } from "@tanstack/react-query";
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { CardMarkdown } from "../cards/card-markdown";
import { useMobileQueries } from "../host/queries-context";

// WHY: a 48×48 PNG inlined as bytes, so the debug card needs no asset and no decoding.
const SAMPLE_PNG = new Uint8Array([
  137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 48, 0, 0, 0, 48, 8, 2, 0, 0, 0, 216, 96, 110,
  208, 0, 0, 0, 79, 73, 68, 65, 84, 120, 218, 237, 215, 177, 13, 0, 32, 8, 4, 64, 6, 99, 18, 103, 103, 18, 43, 71, 80,
  18, 163, 205, 37, 95, 63, 215, 1, 81, 153, 219, 204, 26, 219, 220, 234, 9, 32, 32, 32, 32, 32, 160, 38, 232, 229, 176,
  147, 30, 32, 32, 32, 32, 32, 160, 46, 200, 182, 7, 2, 2, 2, 2, 242, 151, 57, 63, 128, 128, 128, 128, 128, 190, 130,
  22, 6, 31, 210, 226, 144, 104, 5, 153, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130,
]);

// WHY: card text is sample data, not interface copy, so it stays out of the catalog.
function sampleMarkdown(imageId: string): string {
  return `# Sample card
## Every token kind

A paragraph with *emphasis*, **strong**, ~~struck~~, \`inline code\`, and a [web link](https://example.com).
A line break follows,  
then an escaped \\*star\\* and an &amp; entity.

![The sample image](attachment:${imageId})

![A remote image](https://example.com/cat.png) and ![an embedded image](data:image/png;base64,AAAA) show their alt.

- One
- Two
  1. Nested
- [x] A done task

> A quote with **strong** text.

| Word | Meaning |
| --- | --- |
| uno | one |
| dos | two |

---

\`\`\`
a code block
\`\`\`

<div>Raw <b>HTML</b> shows as text.</div>
`;
}

export function SampleCard() {
  const { _ } = useLingui();
  const { addAttachmentMutation } = useMobileQueries();
  const { mutate, data: image, isError } = useMutation(addAttachmentMutation());

  useEffect(() => {
    mutate({ bytes: SAMPLE_PNG, width: 48, height: 48 });
  }, [mutate]);

  if (isError) return <Text>{_(msg`mobile.debug.sample-card-failed`)}</Text>;
  if (!image) return null;
  return (
    <View style={styles.card}>
      <CardMarkdown text={sampleMarkdown(image.id)} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16 },
});
