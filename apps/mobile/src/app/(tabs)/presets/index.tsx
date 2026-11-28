import { useRouter } from "expo-router";
import { PresetsList } from "../../../components/presets-list";

export default function PresetsScreen() {
  const router = useRouter();

  return (
    <PresetsList
      onOpenPreset={(id) => router.push({ pathname: "/preset/[id]", params: { id } })}
      onAdd={() => router.push("/preset/new")}
    />
  );
}
