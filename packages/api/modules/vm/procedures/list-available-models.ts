import { TRPCError } from "@trpc/server";
import { db } from "database";
import { z } from "zod";
import { protectedProcedure } from "../../trpc";

// Define the Model schema for output typing
const ModelSchema = z.object({
  id: z.number(),
  name: z.string(),
  model: z.string(),
  company: z.string(),
  category: z.string(),
  description: z.string(),
  longDescription: z.string(),
  tags: z.array(z.string()),
  updated: z.string(),
  apiEndpoint: z.string().optional(),
  imageUrl: z.string().optional(),
});

export const listAvailableModels = protectedProcedure
  .input(
    z
      .object({
        // Optional filtering parameters
        category: z.string().optional(),
        searchQuery: z.string().optional(),
      })
      .optional(),
  )
  .output(z.array(ModelSchema))
  .query(async ({ input, ctx }) => {
    try {
      const where = {};

      // Add filtering conditions if provided
      if (input?.category) {
        Object.assign(where, { category: input.category });
      }

      if (input?.searchQuery) {
        Object.assign(where, {
          OR: [
            { name: { contains: input.searchQuery, mode: "insensitive" } },
            {
              description: { contains: input.searchQuery, mode: "insensitive" },
            },
            { company: { contains: input.searchQuery, mode: "insensitive" } },
            { tags: { has: input.searchQuery } },
          ],
        });
      }

      const models = await db.model.findMany({
        where,
        orderBy: { id: "asc" },
      });

      return models;
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch models",
        cause: error,
      });
    }
  });
