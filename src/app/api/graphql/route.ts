import { ApolloServer } from "@apollo/server";
import { NextRequest, NextResponse } from "next/server";
import { typeDefs } from "@/graphql/schema";
import { resolvers, type GqlContext } from "@/graphql/resolvers";
import { auth } from "@/auth";

export const runtime = "nodejs";

const globalForApollo = globalThis as unknown as {
  apolloServer?: ApolloServer<GqlContext>;
  apolloStartPromise?: Promise<void>;
};

if (!globalForApollo.apolloServer) {
  const s = new ApolloServer<GqlContext>({ typeDefs, resolvers });
  globalForApollo.apolloServer = s;
  globalForApollo.apolloStartPromise = s.start();
}

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const server = globalForApollo.apolloServer!;

async function ensureStarted() {
  await globalForApollo.apolloStartPromise;
}

async function handleRequest(req: NextRequest): Promise<NextResponse> {
  await ensureStarted();

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body =
    req.method === "POST"
      ? await req.text()
      : null;

  const searchParams = req.nextUrl.searchParams;
  const queryParam = searchParams.get("query");
  const variablesParam = searchParams.get("variables");
  const operationNameParam = searchParams.get("operationName");

  let graphqlRequest: {
    query?: string;
    variables?: Record<string, unknown>;
    operationName?: string;
  };

  if (req.method === "POST" && body) {
    try {
      graphqlRequest = JSON.parse(body);
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
  } else if (req.method === "GET" && queryParam) {
    let parsedVariables: Record<string, unknown> | undefined;
    if (variablesParam) {
      try {
        parsedVariables = JSON.parse(variablesParam);
      } catch {
        return NextResponse.json({ error: "Invalid variables JSON" }, { status: 400 });
      }
    }
    graphqlRequest = {
      query: queryParam,
      variables: parsedVariables,
      operationName: operationNameParam ?? undefined,
    };
  } else {
    return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
  }

  const response = await server.executeOperation(graphqlRequest, {
    contextValue: { userId: session.user.id },
  });

  // Handle SingleResultResponse
  if (response.body.kind === "single") {
    return NextResponse.json(response.body.singleResult, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  return NextResponse.json({ error: "Unexpected response kind" }, { status: 500 });
}

export const GET = handleRequest;
export const POST = handleRequest;
