"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { BrandMark } from "@/components/BrandMark";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const [showUnauthorized] = useState(
    () =>
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("unauthorized") === "1"
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    try {
      setIsLoading(true);
      if (!supabase) {
        throw new Error("Supabase client unavailable. Please refresh the page.");
      }
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (signInError) {
        throw signInError;
      }

      router.push("/dashboard");
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Unable to sign in."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-6">
      <div className="w-full space-y-5">
        <div className="heads-topbar flex items-center justify-center rounded-xl px-4 py-3">
          <BrandMark compact />
        </div>
        <section className="heads-card w-full rounded-xl p-7">
        <h1 className="text-3xl font-semibold text-[#f5f5f5]">Core Login</h1>
        <p className="mt-1 text-sm text-[#bdbdbd]">
          Access restricted to approved H.E.A.D.S. Core members.
        </p>
        {showUnauthorized ? (
          <p className="mt-3 rounded-md border border-[#6e5a21] bg-[#18130a] px-3 py-2 text-sm text-[#f5df9a]">
            Your account is authenticated but not authorized for this workspace.
          </p>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-[#d8d8d8]">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="w-full rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[#d8d8d8]">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              className="w-full rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="heads-gold-btn w-full rounded-lg px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? "Signing in..." : "Sign in"}
          </button>
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        </form>
        </section>
      </div>
    </main>
  );
}
