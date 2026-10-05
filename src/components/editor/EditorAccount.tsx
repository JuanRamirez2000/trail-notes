/** Who's signed in, and sign out. Sign-out is a real form POST so it works without client JS. */
export function EditorAccount({ name, canSignOut }: { name: string; canSignOut: boolean }) {
  return (
    <span className="flex items-center gap-2 text-sm text-bark">
      <span className="max-w-[16ch] truncate" title={name}>
        {name}
      </span>
      {canSignOut && (
        <form action="/auth/sign-out" method="post">
          <button type="submit" className="cursor-pointer rounded-lg border border-line-strong px-2.5 py-0.5 text-bark">
            Sign out
          </button>
        </form>
      )}
    </span>
  );
}
