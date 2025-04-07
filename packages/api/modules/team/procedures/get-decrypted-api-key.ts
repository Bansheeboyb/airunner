import { TRPCError } from "@trpc/server";
import { db } from "database";
import { z } from "zod";
import { protectedProcedure } from "../../trpc";
import * as crypto from "crypto";

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
const ENCRYPTION_IV = process.env.ENCRYPTION_IV;

// Function to decrypt an API key
function decryptApiKey(encryptedApiKey: string): string {
  const decipher = crypto.createDecipheriv(
    "aes-256-cbc",
    Buffer.from(ENCRYPTION_KEY, "hex"),
    Buffer.from(ENCRYPTION_IV, "hex"),
  );

  let decrypted = decipher.update(encryptedApiKey, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

export const getDecryptedApiKey = protectedProcedure
  .input(z.string()) // API key ID
  .query(async ({ input: id, ctx }) => {
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
          message: "No permission to access this API key",
        });
      }
    } else if (apiKey.type === "TEAM") {
      if (!ctx.abilities.canAccessTeam(apiKey.teamId)) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "No permission to access this team's API key",
        });
      }
    }

    // Update last used timestamp
    await db.apiKey.update({
      where: { id },
      data: { lastUsedAt: new Date() },
    });

    // Decrypt and return the API key
    const decryptedKey = decryptApiKey(apiKey.encryptedKey);

    return {
      id: apiKey.id,
      name: apiKey.name,
      key: decryptedKey,
      type: apiKey.type,
    };
  });
