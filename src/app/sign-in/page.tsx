import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Wordmark } from "@/components/ui/Logo";
import { can } from "@/lib/auth/can";
import { authMode, getEditor } from "@/lib/auth/server";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };
// Who may see this is decided per request, never baked into a build.
export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  "not-an-editor": "That Google account isn't on the editors list for this site.",
  cancelled: "Sign-in was cancelled.",
  failed: "Sign-in didn't complete. Please try again.",
  start: "Couldn't start Google sign-in. Please try again.",
};

export default async function SignIn({ searchParams }: PageProps<"/sign-in">) {
  if (authMode() !== "supabase") notFound();
  if (can(await getEditor(), "list")) redirect("/editor");
  const error = (await searchParams).error;
  const message = typeof error === "string" ? ERRORS[error] : undefined;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-6 py-10">
      <Wordmark />
      <h1 className="mt-8 font-display text-h2 font-bold text-forest">Sign in to edit</h1>
      <p className="mt-2 text-bark">For editors of this site. Reading the guides needs no account.</p>
      {message && (
        <p role="alert" className="mt-4 rounded-lg border border-pin-bailout bg-card px-3 py-2 text-pin-bailout">
          {message}
        </p>
      )}
      <a href="/auth/sign-in" className="mt-6 flex min-h-11 items-center justify-center rounded-[10px] bg-forest px-4 py-2.5 text-lg text-paper hover:text-paper">
        Continue with Google
      </a>
    </main>
  );
}
