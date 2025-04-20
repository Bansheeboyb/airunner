import superjson from "superjson";
import { createTRPCNuxtClient, httpBatchLink } from "trpc-nuxt/client";
import type { ApiRouter } from "api/modules/trpc";

export const useApiCaller = () => {
  const apiCaller = createTRPCNuxtClient<ApiRouter>({
    links: [
      httpBatchLink({
        url: "/api/trpc",
        timeout: 90000, // 90-second timeout for LLM operations
      }),
    ],
    transformer: superjson,
  });

  return { apiCaller };
};
