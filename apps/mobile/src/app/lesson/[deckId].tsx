import { useLocalSearchParams, useRouter } from "expo-router";
import { LessonScreen } from "../../lesson/lesson-screen";

export default function LessonRoute() {
  const { deckId } = useLocalSearchParams<{ deckId: string }>();
  const router = useRouter();
  return <LessonScreen deckId={deckId} onDone={() => router.back()} />;
}
