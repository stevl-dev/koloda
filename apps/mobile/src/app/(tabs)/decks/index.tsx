import { useRouter } from "expo-router";
import { DecksList } from "../../../components/decks-list";

export default function DecksScreen() {
  const router = useRouter();

  return (
    <DecksList
      onOpenDeck={(id) => router.push({ pathname: "/deck/[id]", params: { id } })}
      onAdd={() => router.push("/deck/new")}
    />
  );
}
