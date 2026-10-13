"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

export type AgentStripItem = {
  key: string;
  name: string;
  title: string;
  weight: string;
  image: string;
  description: string;
};

export function AgentStrip({ agents }: { agents: AgentStripItem[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      const container = scrollRef.current;
      if (!container) return;

      const cardWidth = container.clientWidth;
      const nextIndex = (activeIndex + 1) % agents.length;
      const nextScrollLeft = nextIndex * (cardWidth + 16);

      container.scrollTo({
        left: nextScrollLeft,
        behavior: "smooth",
      });
      setActiveIndex(nextIndex);
    }, 4000);

    return () => clearInterval(interval);
  }, [activeIndex, isPaused, agents.length]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    let scrollTimeout: ReturnType<typeof setTimeout>;

    const handleScroll = () => {
      setIsPaused(true);
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        const cardWidth = container.clientWidth;
        const index = Math.round(container.scrollLeft / (cardWidth + 16));
        setActiveIndex(Math.min(index, agents.length - 1));
        setIsPaused(false);
      }, 200);
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", handleScroll);
      clearTimeout(scrollTimeout);
    };
  }, [agents.length]);

  function goToSlide(index: number) {
    const container = scrollRef.current;
    if (!container) return;
    const cardWidth = container.clientWidth;
    container.scrollTo({
      left: index * (cardWidth + 16),
      behavior: "smooth",
    });
    setActiveIndex(index);
  }

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        className="agent-strip flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2"
      >
        {agents.map((agent) => (
          <div
            key={agent.key}
            className="snap-center flex-shrink-0 w-full min-w-full"
          >
            <div
              className="agent-card group"
              tabIndex={0}
              aria-label={`${agent.name}, ${agent.title}`}
            >
              <div className="agent-card-glow" aria-hidden />
              <div className="agent-card-scan" aria-hidden />

              <div className="relative w-full aspect-[3/4] z-10">
                <Image
                  src={agent.image}
                  alt={agent.name}
                  fill
                  sizes="90vw"
                  className="object-contain object-bottom agent-card-image"
                  priority={false}
                />
              </div>

              <div className="p-3 text-center flex flex-col items-center relative z-10">
                <div className="font-semibold text-[13px] mb-1 transition-colors group-hover:text-[var(--color-neon)]">
                  {agent.name}
                </div>
                <div className="font-mono text-[9px] text-[var(--color-text-low)] uppercase tracking-wider mb-2">
                  {agent.title}
                </div>
                <div className="font-mono text-xs text-[var(--color-neon)] mb-3 transition-all group-hover:drop-shadow-[0_0_8px_var(--color-neon-glow)]">
                  {agent.weight}
                </div>
                <p className="text-[10px] text-[var(--color-text-mid)] leading-relaxed">
                  {agent.description}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-center gap-2 mt-6">
        {agents.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => goToSlide(i)}
            aria-label={`Go to agent ${i + 1}`}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === activeIndex
                ? "w-6 bg-[var(--color-neon)]"
                : "w-1.5 bg-[var(--color-border)]"
            }`}
          />
        ))}
      </div>
    </div>
  );
}