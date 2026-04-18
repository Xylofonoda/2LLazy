/**
 * Query Intent Engine
 *
 * Classifies a user's job search query into a structured intent that drives:
 *  - Which job titles to include/exclude in AI page-filtering prompts
 *  - A canonical text expansion optimised for the role's embedding space
 *  - An anti-text to embed for negative similarity scoring
 *  - A normalised scraping keyword for cleaner board URLs
 *
 * Fast path: static lookup table for the most common queries (no API call).
 * Slow path: GPT-4o-mini JSON classification for unrecognised terms.
 */
import { ChatOpenAI } from "@langchain/openai";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY?.trim();

export type JobCategory =
  | "Frontend"
  | "Backend"
  | "Fullstack"
  | "Mobile"
  | "DevOps"
  | "Data"
  | "QA"
  | "Design"
  | "Other";

export interface QueryIntent {
  category: JobCategory;
  /** Job title patterns the AI filter should accept */
  includedTitles: string[];
  /** Job title patterns the AI filter should hard-reject */
  excludedTitles: string[];
  /** Rich domain description used to augment the query embedding */
  canonicalText: string;
  /** Description of out-of-domain roles for negative scoring */
  antiText: string;
  /** Best single keyword for scraper URL construction */
  scrapingKeyword: string;
}

// ─── Static Intent Table ──────────────────────────────────────────────────────

const STATIC_INTENTS: Record<string, QueryIntent> = {
  react: {
    category: "Frontend",
    includedTitles: [
      "React developer", "React frontend", "Frontend developer", "UI developer",
      "JavaScript developer", "TypeScript developer", "Next.js developer",
    ],
    excludedTitles: [
      "Backend", "Fullstack", "DevOps", "QA", "iOS", "Android", "Mobile",
      "Data engineer", "Java developer", "PHP developer", ".NET developer",
    ],
    canonicalText:
      "React.js frontend developer, JavaScript TypeScript HTML CSS, React hooks Redux Context API, " +
      "Next.js single-page applications, UI component libraries, responsive design, web interfaces, " +
      "REST API integration, cross-browser compatibility, modern frontend tooling (Vite Webpack).",
    antiText:
      "backend engineer server-side API Node.js database SQL PostgreSQL DevOps Kubernetes cloud " +
      "infrastructure mobile iOS Android Java PHP C# .NET data engineering machine learning Python data science.",
    scrapingKeyword: "React",
  },
  vue: {
    category: "Frontend",
    includedTitles: [
      "Vue developer", "Vue.js developer", "Nuxt developer", "Frontend developer",
      "UI developer", "JavaScript developer",
    ],
    excludedTitles: [
      "Backend", "Fullstack", "DevOps", "QA", "iOS", "Android", "Mobile", "Data engineer",
    ],
    canonicalText:
      "Vue.js frontend developer, Vue 3 Composition API Vuex Pinia, Nuxt.js, JavaScript TypeScript, " +
      "HTML CSS, UI components, responsive design, web application development.",
    antiText:
      "backend engineer server-side API database SQL DevOps cloud mobile iOS Android Java PHP .NET " +
      "data engineering machine learning.",
    scrapingKeyword: "Vue",
  },
  angular: {
    category: "Frontend",
    includedTitles: [
      "Angular developer", "Frontend developer", "UI developer", "TypeScript developer",
    ],
    excludedTitles: [
      "Backend", "Fullstack", "DevOps", "QA", "iOS", "Android", "Mobile", "Data engineer",
    ],
    canonicalText:
      "Angular frontend developer, Angular 17+ TypeScript RxJS NgRx, " +
      "HTML CSS component architecture, single-page applications, web UI development.",
    antiText:
      "backend server-side API database SQL DevOps cloud mobile iOS Android Java PHP .NET " +
      "data engineering machine learning.",
    scrapingKeyword: "Angular",
  },
  frontend: {
    category: "Frontend",
    includedTitles: [
      "Frontend developer", "UI developer", "React developer", "Vue developer",
      "Angular developer", "JavaScript developer", "TypeScript developer",
    ],
    excludedTitles: [
      "Backend", "Fullstack", "DevOps", "QA", "iOS", "Android", "Mobile",
      "Data engineer", "Java developer", "PHP developer", ".NET developer",
    ],
    canonicalText:
      "Frontend web developer, React Vue Angular HTML CSS JavaScript TypeScript, " +
      "UI/UX implementation, responsive design, web interfaces, component libraries, " +
      "cross-browser compatibility, modern tooling.",
    antiText:
      "backend engineer server-side API database SQL DevOps cloud mobile iOS Android " +
      "Java PHP C# .NET data engineering machine learning.",
    scrapingKeyword: "frontend",
  },
  backend: {
    category: "Backend",
    includedTitles: [
      "Backend developer", "Server-side developer", "Node.js developer",
      "Python developer", "API developer", "Software engineer", "Java developer",
    ],
    excludedTitles: [
      "Frontend", "UI developer", "Mobile", "iOS", "Android", "DevOps only", "QA only", "Design",
    ],
    canonicalText:
      "Backend software engineer, server-side development REST APIs GraphQL, " +
      "Node.js Python Java Go, PostgreSQL MySQL MongoDB Redis, microservices, " +
      "cloud AWS GCP Azure, system design, scalability, authentication.",
    antiText:
      "frontend UI design HTML CSS React Vue Angular mobile iOS Android DevOps cloud " +
      "infrastructure automation testing QA machine learning data science.",
    scrapingKeyword: "backend",
  },
  node: {
    category: "Backend",
    includedTitles: [
      "Node.js developer", "Backend developer", "JavaScript developer",
      "TypeScript developer", "Fullstack developer",
    ],
    excludedTitles: [
      "Frontend only", "iOS", "Android", "DevOps only", "QA only", "Java pure backend",
    ],
    canonicalText:
      "Node.js backend developer, Express Fastify NestJS, REST APIs GraphQL, " +
      "TypeScript, PostgreSQL MongoDB Redis, microservices, cloud AWS GCP.",
    antiText:
      "frontend UI HTML CSS React Vue Angular mobile iOS Android DevOps automation QA Java PHP .NET.",
    scrapingKeyword: "node.js",
  },
  python: {
    category: "Backend",
    includedTitles: [
      "Python developer", "Backend developer", "Software engineer",
      "Django developer", "FastAPI developer",
    ],
    excludedTitles: [
      "Frontend only", "iOS", "Android", "DevOps only", "QA only",
    ],
    canonicalText:
      "Python backend developer, Django FastAPI Flask REST APIs, PostgreSQL Redis, " +
      "cloud AWS, microservices, data processing, scripting automation.",
    antiText:
      "frontend UI HTML CSS React Vue Angular mobile iOS Android DevOps automation QA Java PHP .NET.",
    scrapingKeyword: "python",
  },
  fullstack: {
    category: "Fullstack",
    includedTitles: [
      "Fullstack developer", "Full-stack developer", "Frontend developer",
      "Backend developer", "Software engineer", "React developer", "Node.js developer",
    ],
    excludedTitles: ["DevOps only", "QA only", "iOS", "Android", "Data engineer only", "Design only"],
    canonicalText:
      "Fullstack developer, React Vue Angular frontend plus Node.js Python backend, " +
      "REST APIs GraphQL, PostgreSQL, TypeScript, cloud deployment, end-to-end feature development.",
    antiText:
      "DevOps cloud infrastructure automation QA testing iOS Android mobile native data engineering machine learning.",
    scrapingKeyword: "fullstack",
  },
  devops: {
    category: "DevOps",
    includedTitles: [
      "DevOps engineer", "Cloud engineer", "Platform engineer",
      "SRE", "Infrastructure engineer", "Kubernetes engineer",
    ],
    excludedTitles: [
      "Frontend", "Backend pure developer", "Mobile", "iOS", "Android", "QA only", "Data engineer",
    ],
    canonicalText:
      "DevOps engineer, Kubernetes Docker CI/CD pipelines (GitLab GitHub Actions), " +
      "AWS GCP Azure cloud infrastructure, Terraform monitoring Prometheus Grafana, " +
      "reliability engineering, IaC.",
    antiText:
      "frontend UI HTML CSS React Vue Angular mobile iOS Android backend feature development " +
      "QA data science machine learning design.",
    scrapingKeyword: "devops",
  },
  mobile: {
    category: "Mobile",
    includedTitles: [
      "Mobile developer", "React Native developer", "Flutter developer",
      "iOS developer", "Android developer",
    ],
    excludedTitles: ["Backend only", "Frontend web only", "DevOps", "QA only", "Data engineer"],
    canonicalText:
      "Mobile developer, React Native Flutter iOS Android, cross-platform development, " +
      "native modules, App Store Google Play, mobile UI, REST API integration, TypeScript Kotlin Swift.",
    antiText:
      "backend API server web frontend HTML CSS DevOps cloud infrastructure QA data engineering machine learning.",
    scrapingKeyword: "mobile",
  },
  ios: {
    category: "Mobile",
    includedTitles: ["iOS developer", "Swift developer", "Mobile developer"],
    excludedTitles: [
      "Android", "Flutter", "React Native", "Backend", "Frontend web", "DevOps", "QA",
    ],
    canonicalText:
      "iOS developer Swift Objective-C Xcode UIKit SwiftUI, App Store distribution, " +
      "Core Data networking ARKit Apple ecosystem.",
    antiText:
      "Android backend web frontend HTML CSS React Vue DevOps QA data machine learning.",
    scrapingKeyword: "iOS",
  },
  android: {
    category: "Mobile",
    includedTitles: ["Android developer", "Kotlin developer", "Mobile developer"],
    excludedTitles: ["iOS", "Swift", "Flutter", "Backend only", "Frontend web", "DevOps", "QA"],
    canonicalText:
      "Android developer Kotlin Java Android Studio Google Play Jetpack Compose MVVM " +
      "REST API integration mobile apps.",
    antiText:
      "iOS Swift backend web frontend HTML CSS React Vue DevOps QA data machine learning.",
    scrapingKeyword: "android",
  },
  data: {
    category: "Data",
    includedTitles: [
      "Data engineer", "Data analyst", "Data scientist",
      "ML engineer", "Machine learning engineer",
    ],
    excludedTitles: [
      "Frontend", "Backend pure", "Mobile", "iOS", "Android", "DevOps only", "QA only",
    ],
    canonicalText:
      "Data engineer, ETL pipelines Apache Spark Airflow, Python SQL, data warehouses " +
      "BigQuery Snowflake, machine learning MLOps, analytics dashboards, data modelling.",
    antiText:
      "frontend UI HTML CSS React Vue Angular mobile iOS Android DevOps automation QA design UX.",
    scrapingKeyword: "data",
  },
  qa: {
    category: "QA",
    includedTitles: [
      "QA engineer", "Test engineer", "SDET", "Automation engineer", "QA analyst",
    ],
    excludedTitles: ["Frontend", "Backend", "Mobile", "DevOps", "Data engineer"],
    canonicalText:
      "QA automation engineer, Selenium Playwright Cypress, test strategy, unit integration E2E testing, " +
      "CI/CD test pipelines, bug tracking Jira, performance testing.",
    antiText:
      "frontend UI HTML CSS React backend API DevOps cloud mobile iOS Android data science machine learning design.",
    scrapingKeyword: "QA",
  },
};

// ─── Alias normalisation ──────────────────────────────────────────────────────

function normaliseKey(query: string): string {
  return query.toLowerCase().trim().replace(/[.\s-]+/g, "");
}

const ALIAS_MAP: Record<string, string> = {
  "react.js": "react",
  reactjs: "react",
  nextjs: "react",
  "next.js": "react",
  "react native": "mobile",
  reactnative: "mobile",
  "vue.js": "vue",
  vuejs: "vue",
  "nuxt.js": "vue",
  nuxtjs: "vue",
  "node.js": "node",
  nodejs: "node",
  "full-stack": "fullstack",
  fullstackdeveloper: "fullstack",
  flutter: "mobile",
  swift: "ios",
  kotlin: "android",
  datascience: "data",
  "data science": "data",
  ml: "data",
  "machine learning": "data",
  sre: "devops",
  cloud: "devops",
  infrastructure: "devops",
  kubernetes: "devops",
  k8s: "devops",
  cypress: "qa",
  playwright: "qa",
  selenium: "qa",
  testing: "qa",
  automation: "qa",
};

// ─── Exported function ────────────────────────────────────────────────────────

export async function classifyQueryIntent(
  query: string,
  skillLevel: string,
): Promise<QueryIntent> {
  const key = normaliseKey(query);
  const resolvedKey = ALIAS_MAP[key] ?? key;

  // Fast path: static table lookup
  const staticMatch = STATIC_INTENTS[resolvedKey];
  if (staticMatch) return staticMatch;

  // Slow path: GPT-4o-mini
  if (!OPENAI_API_KEY) return buildFallbackIntent(query);

  try {
    const model = new ChatOpenAI({
      model: "gpt-4o-mini",
      apiKey: OPENAI_API_KEY,
      temperature: 0,
      modelKwargs: { response_format: { type: "json_object" } },
    });

    const result = await model.invoke([{
      role: "user",
      content:
        `Classify this job search query into a structured intent.\n` +
        `Query: "${query}"${skillLevel ? ` (level: ${skillLevel})` : ""}\n\n` +
        `Category rules:\n` +
        `- Frontend: React/Vue/Angular/HTML/CSS roles ONLY — excludes Backend, Fullstack, QA, DevOps\n` +
        `- Backend: server-side, APIs, databases — excludes Frontend, Mobile, Design\n` +
        `- Fullstack: includes Frontend + Backend + Fullstack roles — excludes DevOps, QA, pure Mobile\n` +
        `- Mobile: iOS/Android/React Native/Flutter — excludes pure web roles\n` +
        `- DevOps: infrastructure, cloud, CI/CD — excludes dev feature roles\n` +
        `- Data: data engineering, ML, analytics\n` +
        `- QA: testing, automation\n` +
        `- Design: UX/UI/product design\n` +
        `- Other: anything that doesn't fit\n\n` +
        `Return JSON:\n` +
        `{\n` +
        `  "category": "<Frontend|Backend|Fullstack|Mobile|DevOps|Data|QA|Design|Other>",\n` +
        `  "includedTitles": ["<5-7 job title patterns to accept>"],\n` +
        `  "excludedTitles": ["<5-7 job title patterns to reject>"],\n` +
        `  "canonicalText": "<2-3 sentence rich description of the role for embedding>",\n` +
        `  "antiText": "<1-2 sentence description of what should NOT appear in results>",\n` +
        `  "scrapingKeyword": "<best single keyword for job board URL params>"\n` +
        `}`,
    }]);

    const parsed = JSON.parse(result.content as string) as Partial<QueryIntent>;
    return {
      category: (parsed.category as JobCategory) ?? "Other",
      includedTitles: parsed.includedTitles ?? [],
      excludedTitles: parsed.excludedTitles ?? [],
      canonicalText: parsed.canonicalText ?? query,
      antiText: parsed.antiText ?? "",
      scrapingKeyword: parsed.scrapingKeyword ?? query,
    };
  } catch {
    return buildFallbackIntent(query);
  }
}

function buildFallbackIntent(query: string): QueryIntent {
  return {
    category: "Other",
    includedTitles: [],
    excludedTitles: [],
    canonicalText: query,
    antiText: "",
    scrapingKeyword: query,
  };
}
