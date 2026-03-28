import { StateGraph, START, END } from "@langchain/langgraph";
import { GraphStateAnnotation } from "./state";
import type { AgentState } from "./state";
import {
  scrapeSearchResultsNode,
  filterJobLinksNode,
  scrapeJobDetailNode,
} from "./nodes";

/**
 * Routing function used after `scrapeJobDetail`.
 *
 * If there are still URLs in the queue the graph loops back to process the
 * next one; otherwise it terminates.
 */
function shouldContinueScraping(
  state: AgentState,
): "scrapeJobDetail" | typeof END {
  return state.urlsToVisit.length > 0 ? "scrapeJobDetail" : END;
}

/**
 * Compiled LangGraph agentic scraper.
 *
 * Flow:
 *   START
 *     └─► scrapeSearchResults   (Playwright → Markdown + link list)
 *           └─► filterJobLinks  (gpt-4o-mini classifies job-detail URLs)
 *                 └─► scrapeJobDetail  ◄─────────────────────┐
 *                       │ (structured extraction via gpt-4o-mini)   │
 *                       ├── urlsToVisit not empty? ────────────────►┘
 *                       └── urlsToVisit empty? ──► END
 *
 * Resilience:
 *  - Each node catches its own errors and logs them to `state.errors`.
 *  - A failed URL is still moved to `visitedUrls` so the loop never stalls.
 *
 * Memory / deduplication:
 *  - `visitedUrls` accumulates across the whole run (append + Set dedup reducer).
 *  - `filterJobLinks` pre-filters out already-visited URLs before calling the LLM.
 */
const workflow = new StateGraph(GraphStateAnnotation)
  .addNode("scrapeSearchResults", scrapeSearchResultsNode)
  .addNode("filterJobLinks", filterJobLinksNode)
  .addNode("scrapeJobDetail", scrapeJobDetailNode)
  // ── Edges ─────────────────────────────────────────────────────────────────
  .addEdge(START, "scrapeSearchResults")
  .addEdge("scrapeSearchResults", "filterJobLinks")
  .addEdge("filterJobLinks", "scrapeJobDetail")
  // Conditional loop: keep extracting until the queue is drained
  .addConditionalEdges("scrapeJobDetail", shouldContinueScraping, {
    scrapeJobDetail: "scrapeJobDetail",
    [END]: END,
  });

export const agentScraper = workflow.compile();
