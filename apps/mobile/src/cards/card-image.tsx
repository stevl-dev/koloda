import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import type { ImageLoadEventData } from "expo-image";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useMobileQueries } from "../host/queries-context";

export type CardImageProps = {
  id: string;
  alt: string;
  color: string;
};

type Size = { width: number; height: number };

export function CardImage({ id, alt, color }: CardImageProps) {
  const { getAttachmentFileQuery } = useMobileQueries();
  const { data: path, isPending, isError } = useQuery(getAttachmentFileQuery(id));
  const [size, setSize] = useState<Size | null>(null);
  const [isBroken, setIsBroken] = useState(false);

  // INVARIANT: the image's place stays empty while it loads (docs/specs/MEDIA.md §Where Images Show).
  if (isPending) return <View testID="card-image-pending" style={styles.pending} />;
  if (isError || !path || isBroken) return <Text style={{ color }}>{alt}</Text>;

  return (
    <Image
      testID="card-image"
      source={{ uri: `file://${path}` }}
      accessibilityLabel={alt}
      // WHY: the view starts tiny, so a downscaled first decode would blur once it grows to the image's size.
      allowDownscaling={false}
      contentFit="contain"
      style={size ? { width: size.width, maxWidth: "100%", aspectRatio: size.width / size.height } : styles.pending}
      onLoad={({ source }: ImageLoadEventData) => setSize({ width: source.width, height: source.height })}
      onError={() => setIsBroken(true)}
    />
  );
}

const styles = StyleSheet.create({
  pending: { width: 1, height: 1 },
});
