/**
 * RAG Role Profiles
 *
 * Loads a canonical role profile from the DB (seeded via prisma/seed.ts)
 * and uses it to:
 *  1. Augment the user query text before embedding (richer domain signal)
 *  2. Score job embeddings with a negative penalty (penalise out-of-domain results)
 */
import { prisma } from "@/lib/prisma";
import type { JobCategory } from "./queryIntent";

export interface RoleProfile {
  id: string;
  category: string;
  description: string;
  antiQuery: string;
  embedding: number[] | null;
  antiEmbedding: number[] | null;
}

/**
 * Retrieve a seeded role profile by category.
 * Returns null if the profiles table has not been seeded yet — all callers
 * must handle null gracefully and fall back to standard cosine similarity.
 */
export async function getRoleProfile(category: JobCategory): Promise<RoleProfile | null> {
  try {
    const rows = await prisma.$queryRaw<Array<{
      id: string;
      category: string;
      description: string;
      antiQuery: string;
      embedding: string | null;
      antiEmbedding: string | null;
    }>>`
      SELECT id, category, description, "antiQuery",
             embedding::text  AS embedding,
             "antiEmbedding"::text AS "antiEmbedding"
      FROM   "RoleProfile"
      WHERE  category = ${category}
      LIMIT  1
    `;

    const row = rows[0];
    if (!row) return null;

    return {
      id: row.id,
      category: row.category,
      description: row.description,
      antiQuery: row.antiQuery,
      embedding: row.embedding ? (JSON.parse(row.embedding) as number[]) : null,
      antiEmbedding: row.antiEmbedding ? (JSON.parse(row.antiEmbedding) as number[]) : null,
    };
  } catch {
    // Table may not yet exist in older deployments
    return null;
  }
}

/**
 * Concatenate the expanded query with the canonical role profile description.
 * This grounds the query embedding in a richer, more stable domain space
 * compared to embedding the raw user input alone.
 */
export function buildAugmentedQueryText(expandedQuery: string, profile: RoleProfile): string {
  return `${expandedQuery}\n\n${profile.description}`;
}

/**
 * Weight applied to the anti-query penalty.
 * 0.35 means: "if a job is 100% similar to the anti-text, subtract 0.35 from its score."
 * Adjust downwards if too many borderline Fullstack jobs get penalised for Frontend queries.
 */
const ANTI_WEIGHT = 0.35;

/**
 * Cosine similarity with negative anti-query penalty.
 *
 * Formula: cos(job, query) − ANTI_WEIGHT × cos(job, anti)
 *
 * A job that scores high against the query but also high against the anti-text
 * (e.g. a Backend posting when the user searched for Frontend) gets penalised.
 * Result is clamped to [0, 1].
 */
export function scoreWithNegative(
  jobEmbedding: number[],
  queryEmbedding: number[],
  antiEmbedding: number[],
): number {
  const pos = cosineSim(jobEmbedding, queryEmbedding);
  const neg = cosineSim(jobEmbedding, antiEmbedding);
  return Math.max(0, Math.min(1, pos - ANTI_WEIGHT * neg));
}

function cosineSim(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}
