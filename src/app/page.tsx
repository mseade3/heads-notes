import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col justify-center gap-6 px-6">
      <div className="flex justify-center">
        <BrandMark />
      </div>
      <div className="heads-card rounded-2xl p-10">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#d4af37]">
          H.E.A.D.S. Core Executive Board
        </p>
        <h1 className="mt-3 text-4xl font-semibold text-[#f5f5f5]">
          Private Meeting Notes Platform
        </h1>
        <p className="mt-4 max-w-2xl text-[#bdbdbd]">
          Upload board meeting audio, auto-transcribe with AI, format into your
          official note template, and review edits before publishing.
        </p>
        <div className="mt-8">
          <Link
            href="/login"
            className="heads-gold-btn inline-flex rounded-lg px-5 py-2.5 text-sm"
          >
            Sign in to Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
