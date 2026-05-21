"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
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
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12 sm:px-6">
      <div className="pointer-events-none absolute inset-0 opacity-20">
        <Image
          src="/brand/heads-hero-black.png"
          alt=""
          fill
          className="object-cover object-center"
          priority
        />
      </div>
      <div className="relative z-10 w-full max-w-md space-y-5">
        <section className="heads-glass-card w-full rounded-3xl border border-white/10 p-10 shadow-xl shadow-black/30">
          <div className="mb-6 flex items-center justify-between">
            <BrandMark compact />
            <Image
              src="/brand/heads-gold-h.png"
              alt="H.E.A.D.S. crest"
              width={42}
              height={42}
              className="h-9 w-9 object-contain"
            />
          </div>

          <h1 className="text-4xl font-bold tracking-tight text-[#f5f7fb]">Leadership Access</h1>
          <p className="mt-2 text-base leading-relaxed text-[#a9afba]">
            Secure login for approved H.E.A.D.S. Core executives.
          </p>
          {showUnauthorized ? (
            <p className="mt-3 rounded-xl border border-[#6e5a21]/60 bg-[#241b0c]/70 px-3 py-2 text-sm text-[#f5df9a]">
              Your account is authenticated but not authorized for this workspace.
            </p>
          ) : null}

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#d8dcea]">Email</label>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                className="w-full rounded-2xl px-4 py-3 text-sm"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#d8dcea]">Password</label>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                className="w-full rounded-2xl px-4 py-3 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="heads-gold-btn w-full rounded-2xl px-4 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? "Signing in..." : "Enter Dashboard"}
            </button>
            {error ? <p className="text-sm text-[#ffc6c6]">{error}</p> : null}
          </form>
        </section>
      </div>
    </main>
  );
}
