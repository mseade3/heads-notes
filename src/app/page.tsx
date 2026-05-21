import Link from "next/link";
import Image from "next/image";
import { BrandMark } from "@/components/BrandMark";

export default function HomePage() {
  return (
    <main className="relative mx-auto flex min-h-screen max-w-6xl flex-col justify-center gap-10 overflow-hidden px-6 py-14">
      <div className="pointer-events-none absolute -top-16 right-[-120px] opacity-20">
        <Image
          src="/brand/heads-bear.png"
          alt=""
          width={520}
          height={520}
          className="h-auto w-[340px] object-contain sm:w-[420px]"
          priority
        />
      </div>
      <div className="relative z-10 flex justify-center">
        <BrandMark />
      </div>
      <div className="heads-glass-card relative z-10 rounded-3xl border border-white/10 p-10 sm:p-12">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#d4af37]">
          H.E.A.D.S. Core Executive Board
        </p>
        <h1 className="mt-4 text-5xl font-bold tracking-tight text-[#f5f8fe]">
          Private Meeting Notes Platform
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-[#aab1bc]">
          Upload board meeting audio, auto-transcribe with AI, format into your
          official note template, and review edits before publishing.
        </p>
        <div className="mt-8">
          <Link
            href="/login"
            className="heads-gold-btn inline-flex rounded-2xl px-7 py-3 text-sm"
          >
            Sign in to Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
