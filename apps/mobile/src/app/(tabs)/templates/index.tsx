import { useRouter } from "expo-router";
import { TemplatesList } from "../../../components/templates-list";

export default function TemplatesScreen() {
  const router = useRouter();

  return (
    <TemplatesList
      onOpenTemplate={(id) => router.push({ pathname: "/template/[id]", params: { id } })}
      onAdd={() => router.push("/template/new")}
    />
  );
}
