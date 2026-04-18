/**
 * findApplyButton
 *
 * Locates the primary "Apply" call-to-action on a job detail page.
 *
 * Strategy:
 *  1. Fast path: text-pattern match against visible buttons/links.
 *  2. Slow path: GPT-4o-mini classifies the element list when no pattern matches.
 *
 * Returns the DOM index (data-aaf-btn-idx) of the best match, or null when
 * no suitable element is found (→ MANUAL_REQUIRED in the orchestrator).
 */
import type { Page } from "playwright-core";
import { ChatOpenAI } from "@langchain/openai";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY?.trim();

const APPLY_TEXT_PATTERN =
  /^(apply|apply now|apply for (this )?job|send (my )?application|send cv|quick apply|easy apply|odeslat žádost|přihlásit se|respond to job|reagovat na nabídku)/i;

interface BtnCandidate {
  idx: number;
  tag: string;
  text: string;
  href: string;
  ariaLabel: string;
  classes: string;
}

export async function findApplyButton(page: Page): Promise<number | null> {
  // Inject data-aaf-btn-idx and collect candidate info
  const candidates: BtnCandidate[] = await page.evaluate((): BtnCandidate[] => {
    const all = Array.from(document.querySelectorAll("button, a[href]")) as (
      | HTMLButtonElement
      | HTMLAnchorElement
    )[];

    return all
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      })
      .slice(0, 60)
      .map((el, idx) => {
        el.setAttribute("data-aaf-btn-idx", String(idx));
        return {
          idx,
          tag: el.tagName.toLowerCase(),
          text: (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 120),
          href: el instanceof HTMLAnchorElement ? el.href : "",
          ariaLabel: el.getAttribute("aria-label") ?? "",
          classes: el.className.toString().slice(0, 80),
        };
      });
  });

  if (candidates.length === 0) return null;

  // Fast path: text match
  const fastMatch = candidates.find(
    (c) => APPLY_TEXT_PATTERN.test(c.text) || APPLY_TEXT_PATTERN.test(c.ariaLabel),
  );
  if (fastMatch) return fastMatch.idx;

  // Slow path: GPT-4o-mini
  if (!OPENAI_API_KEY) return null;

  try {
    const model = new ChatOpenAI({
      model: "gpt-4o-mini",
      apiKey: OPENAI_API_KEY,
      temperature: 0,
      modelKwargs: { response_format: { type: "json_object" } },
    });

    const list = candidates
      .map(
        (c) =>
          `${c.idx}: [${c.tag}] "${c.text}"` +
          (c.ariaLabel ? ` aria="${c.ariaLabel}"` : "") +
          (c.href ? ` href="${c.href.slice(0, 80)}"` : "") +
          (c.classes ? ` class="${c.classes}"` : ""),
      )
      .join("\n");

    const result = await model.invoke([{
      role: "user",
      content:
        `You are helping automate a job application. Given the list of page elements below, ` +
        `identify the index of the PRIMARY "Apply" or "Apply Now" button that a user would click ` +
        `to start the application process. Ignore login buttons, save buttons, and navigation.\n` +
        `Return JSON: { "idx": <number> | null }\n\nElements:\n${list}`,
    }]);

    const parsed = JSON.parse(result.content as string) as { idx?: number | null };
    return typeof parsed.idx === "number" ? parsed.idx : null;
  } catch {
    return null;
  }
}
