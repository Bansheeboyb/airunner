import { TRPCError } from "@trpc/server";
import { db } from "database";
import { z } from "zod";
import { protectedProcedure } from "../../trpc";

export const deleteApiKey = protectedProcedure
  .input(z.string()) // API key ID
  .mutation(async ({ input: id, ctx }) => {
    // Get the API key
    const apiKey = await db.apiKey.findUnique({
      where: { id },
    });

    if (!apiKey) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "API key not found",
      });
    }

    // Check permissions
    if (apiKey.type === "PERSONAL") {
      if (apiKey.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "No permission to delete this API key",
        });
      }
    } else if (apiKey.type === "TEAM") {
      if (!ctx.abilities.isTeamOwner(apiKey.teamId)) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "No permission to delete this team's API key",
        });
      }
    }

    // Delete the API key
    await db.apiKey.delete({
      where: { id },
    });

    return { success: true };
  });
