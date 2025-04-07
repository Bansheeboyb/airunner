import { TRPCError } from "@trpc/server";
import { ApiKeyType, db } from "database";
import { z } from "zod";
import { protectedProcedure } from "../../trpc";
import * as crypto from "crypto";

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
const ENCRYPTION_IV = process.env.ENCRYPTION_IV;

// Generate a new API key (format: pk_live_xxxxxxxxxxxxxxxx)
function generateApiKey(): string {
  const randomBytes = crypto.randomBytes(24);
  return `pk_live_${randomBytes.toString("hex")}`;
}

// Function to encrypt an API key
function encryptApiKey(apiKey: string): string {
  const cipher = crypto.createCipheriv(
    "aes-256-cbc",
    Buffer.from(ENCRYPTION_KEY, "hex"),
    Buffer.from(ENCRYPTION_IV, "hex"),
  );

  let encrypted = cipher.update(apiKey, "utf8", "hex");
  encrypted += cipher.final("hex");

  return encrypted;
}

export const createApiKey = protectedProcedure
  .input(
    z.object({
      name: z.string(),
      type: z.enum(["PERSONAL", "TEAM"]),
      teamId: z.string().optional(),
      // Make expiresAt truly optional (undefined, not null)
      expiresAt: z.date().optional(),
    }),
  )
  .mutation(async ({ input, ctx }) => {
    const { name, type, teamId, expiresAt } = input;
    const userId = ctx.user.id;

    // Check permissions for team API keys
    if (type === "TEAM") {
      if (!teamId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Team ID is required for team API keys",
        });
      }

      if (!ctx.abilities.isTeamOwner(teamId)) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "No permission to create API keys for this team",
        });
      }
    }

    // Generate a new API key
    const apiKey = generateApiKey();
    const keyPrefix = apiKey.substring(0, 10); // Get first 10 chars for display
    const encryptedKey = encryptApiKey(apiKey);

    // Create the API key in the database
    const createdKey = await db.apiKey.create({
      data: {
        name,
        encryptedKey,
        keyPrefix,
        type: type as ApiKeyType,
        userId: type === "PERSONAL" ? userId : null,
        teamId: type === "TEAM" ? teamId : null,
        expiresAt,
      },
    });

    // Return the new API key with the plain text key (only shown once)
    return {
      id: createdKey.id,
      name: createdKey.name,
      key: apiKey, // Return the plain key only on creation
      keyPrefix: createdKey.keyPrefix,
      type: createdKey.type,
      createdAt: createdKey.createdAt,
      expiresAt: createdKey.expiresAt,
    };
  });
