import { TRPCError } from "@trpc/server";
import { db } from "database";
import { z } from "zod";
import { protectedProcedure } from "../../trpc";

export const listApiKeys = protectedProcedure
  .input(
    z.object({
      type: z.enum(["PERSONAL", "TEAM", "ALL"]).optional().default("ALL"),
      teamId: z.string().optional(),
    }),
  )
  .query(async ({ input, ctx }) => {
    const { type, teamId } = input;
    const userId = ctx.user.id;

    // Build filter conditions
    const whereCondition: any = {};

    if (type === "PERSONAL") {
      whereCondition.userId = userId;
    } else if (type === "TEAM") {
      if (!teamId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Team ID is required when filtering by team API keys",
        });
      }

      if (!ctx.abilities.canAccessTeam(teamId)) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "No permission to access this team's API keys",
        });
      }

      whereCondition.teamId = teamId;
    } else {
      // ALL keys - get personal keys and keys for teams user has access to
      const userTeamIds = (
        await db.teamMembership.findMany({
          where: { userId },
          select: { teamId: true },
        })
      ).map((m) => m.teamId);

      whereCondition.OR = [{ userId }, { teamId: { in: userTeamIds } }];
    }

    // Get the API keys
    const apiKeys = await db.apiKey.findMany({
      where: whereCondition,
      orderBy: { createdAt: "desc" },
      include: {
        team: {
          select: {
            name: true,
          },
        },
      },
    });

    return apiKeys;
  });
