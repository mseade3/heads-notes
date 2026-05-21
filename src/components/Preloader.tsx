"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";

type PreloaderProps = {
  children: ReactNode;
  durationMs?: number;
};

export function Preloader({ children, durationMs = 1800 }: PreloaderProps) {
  const [progress, setProgress] = useState(0);
  const [isExiting, setIsExiting] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [spotlight, setSpotlight] = useState({ x: 50, y: 50 });

  useEffect(() => {
    let animationFrame = 0;
    const startedAt = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startedAt;
      const nextProgress = Math.min(100, (elapsed / durationMs) * 100);
      setProgress(nextProgress);

      if (nextProgress < 100) {
        animationFrame = window.requestAnimationFrame(tick);
        return;
      }

      setIsExiting(true);
      window.setTimeout(() => {
        setIsVisible(false);
      }, 520);
    };

    animationFrame = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(animationFrame);
    };
  }, [durationMs]);

  const spotlightBackground = useMemo(
    () =>
      `radial-gradient(480px circle at ${spotlight.x}% ${spotlight.y}%, rgba(214, 176, 78, 0.16), transparent 58%)`,
    [spotlight.x, spotlight.y]
  );

  const textFillGradient = useMemo(
    () =>
      `linear-gradient(90deg, rgba(248,249,252,0.98) ${progress}%, rgba(248,249,252,0.1) ${progress}%)`,
    [progress]
  );
  return (
    <div className="relative">
      {children}

      {isVisible ? (
        <div
          className={`fixed inset-0 z-[120] flex items-center justify-center bg-[#050505] transition-opacity duration-500 ${
            isExiting ? "pointer-events-none opacity-0" : "opacity-100"
          }`}
          onMouseMove={(event) => {
            const x = (event.clientX / window.innerWidth) * 100;
            const y = (event.clientY / window.innerHeight) * 100;
            setSpotlight({ x, y });
          }}
        >
          <div
            className="pointer-events-none absolute inset-0 transition-opacity duration-300"
            style={{ background: spotlightBackground }}
          />

          <div
            className={`relative flex flex-col items-center gap-4 transition-all duration-500 ${
              isExiting ? "scale-105 opacity-0" : "scale-100 opacity-100"
            }`}
          >
            <div className="relative mb-2 h-8 w-14">
              <svg
                viewBox="0 0 60 40"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="h-8 w-14"
              >
                <path
                  d="M4 34L10 8L24 21L30 5L36 21L50 8L56 34H4Z"
                  stroke="rgba(244, 217, 143, 0.35)"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
                <path d="M6 34H54" stroke="rgba(244, 217, 143, 0.35)" strokeWidth="2" />
              </svg>
              <div
                className="absolute inset-0 overflow-hidden transition-all duration-150"
                style={{ width: `${progress}%` }}
              >
                <svg
                  viewBox="0 0 60 40"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-8 w-14"
                >
                  <path
                    d="M4 34L10 8L24 21L30 5L36 21L50 8L56 34H4Z"
                    fill="url(#headsPreloaderCrownFill)"
                    stroke="#f6dfa3"
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />
                  <path d="M6 34H54" stroke="#be8f31" strokeWidth="2" />
                  <defs>
                    <linearGradient
                      id="headsPreloaderCrownFill"
                      x1="4"
                      y1="5"
                      x2="56"
                      y2="34"
                      gradientUnits="userSpaceOnUse"
                    >
                      <stop stopColor="#f4d98f" />
                      <stop offset="1" stopColor="#d6ad4f" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
            </div>
            <div className="relative">
              <span
                className="select-none text-6xl font-semibold tracking-[0.2em] text-transparent sm:text-7xl"
                style={{ WebkitTextStroke: "1px rgba(245, 245, 247, 0.25)" }}
              >
                H.E.A.D.S.
              </span>
              <span
                className="pointer-events-none absolute inset-0 select-none text-6xl font-semibold tracking-[0.2em] text-transparent sm:text-7xl"
                style={{
                  backgroundImage: textFillGradient,
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  WebkitTextFillColor: "transparent"
                }}
              >
                H.E.A.D.S.
              </span>
            </div>
            <p className="text-xs tracking-[0.28em] text-white/45">
              LOADING {Math.round(progress)}%
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
