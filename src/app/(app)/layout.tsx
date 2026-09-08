import { redirect } from "next/navigation";
import { getSessionUser, publicUser, mePayload } from "@/lib/auth";
import AuthProvider from "@/components/AuthProvider";
import { Nav } from "@/components/Nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const payload = await mePayload(user);
  return (
    <AuthProvider initialUser={payload.user}>
      <Nav user={payload.user} />
      <main className="md:pl-[76px] lg:pl-[248px] min-h-dvh">
        <div className="mx-auto w-full max-w-3xl px-3 sm:px-5 pb-24 md:pb-10 pt-16 md:pt-8">{children}</div>
      </main>
    </AuthProvider>
  );
}
