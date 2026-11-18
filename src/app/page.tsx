import { redirect } from "next/navigation";

export default function RootPage() {
  // A home redireciona para o dashboard; o WorkspaceShell cuida de auth e do
  // fallback para a primeira rota permitida conforme as permissões do usuário.
  redirect("/dashboard");
}
