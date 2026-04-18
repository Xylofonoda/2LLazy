import { JobSource } from "@prisma/client";

export interface ScrapedJob {
  title: string;
  company: string;
  location: string;
  description: string;
  sourceUrl: string;
  source: JobSource;
  salary?: string;
  workType?: string;
  postedAt?: Date;
}

export interface ScraperOptions {
  /** Query intent from classifyQueryIntent — improves AI page filtering precision. */
  intent?: import("../queryIntent").QueryIntent;
  /** Normalised keyword for board-specific URL construction (e.g. slug-based search). */
  scrapingKeyword?: string;
}
