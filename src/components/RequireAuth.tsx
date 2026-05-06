export default function RequireAuth({ children }: { children: React.ReactNode }) {
  // Авторизация отключена
  return <>{children}</>;
}