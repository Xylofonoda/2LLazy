"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface ScrapeProgressState {
  scraping: boolean;
  scrapePercent: number;
  setScraping: (v: boolean) => void;
  setScrapePercent: (v: number) => void;
}

const ScrapeProgressContext = createContext<ScrapeProgressState>({
  scraping: false,
  scrapePercent: 0,
  setScraping: () => {},
  setScrapePercent: () => {},
});

export function ScrapeProgressProvider({ children }: { children: ReactNode }) {
  const [scraping, setScraping] = useState(false);
  const [scrapePercent, setScrapePercent] = useState(0);

  return (
    <ScrapeProgressContext.Provider value={{ scraping, scrapePercent, setScraping, setScrapePercent }}>
      {children}
    </ScrapeProgressContext.Provider>
  );
}

export function useScrapeProgress() {
  return useContext(ScrapeProgressContext);
}
