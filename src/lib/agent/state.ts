import { Annotation } from "@langchain/langgraph";
import type { JobPosting, PageLink } from "./types";

/**
 * LangGraph state definition for the agentic scraper.
 *
 * Reducer strategy:
 *  - searchUrl / currentHtml → replace (last write wins)
 *  - urlsToVisit             → replace (nodes manage the full queue)
 *  - visitedUrls / errors    → append + deduplicate
 *  - extractedJobs           → append
 *  - pageLinks               → replace (only used between discovery nodes)
 */
export const GraphStateAnnotation = Annotation.Root({
  /** The initial search-results URL to start crawling from. */
  searchUrl: Annotation<string>({
    reducer: (_, b) => (b !== undefined ? b : ""),
    default: () => "",
  }),

  /** Markdown snapshot of the most recently visited page. */
  currentHtml: Annotation<string>({
    reducer: (_, b) => (b !== undefined ? b : ""),
    default: () => "",
  }),

  /**
   * All anchor links (text + href) extracted from the search-results page.
   * Passed to the LLM to identify job-detail URLs.
   */
  pageLinks: Annotation<PageLink[]>({
    reducer: (_, b) => b ?? [],
    default: () => [],
  }),

  /**
   * Queue of job-detail URLs waiting to be scraped.
   * Replaced wholesale so each node manages the full remaining list.
   */
  urlsToVisit: Annotation<string[]>({
    reducer: (_, b) => b ?? [],
    default: () => [],
  }),

  /** Accumulates every URL that has been successfully processed. */
  visitedUrls: Annotation<string[]>({
    reducer: (a, b) => [...new Set([...(a ?? []), ...(b ?? [])])],
    default: () => [],
  }),

  /** Grows with each successfully extracted job posting. */
  extractedJobs: Annotation<JobPosting[]>({
    reducer: (a, b) => [...(a ?? []), ...(b ?? [])],
    default: () => [],
  }),

  /** Human-readable error log so failures don't silently crash the graph. */
  errors: Annotation<string[]>({
    reducer: (a, b) => [...(a ?? []), ...(b ?? [])],
    default: () => [],
  }),
});

export type AgentState = typeof GraphStateAnnotation.State;
