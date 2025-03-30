import { TRPCError } from "@trpc/server";
import { TeamSchema, db } from "database";
import { z } from "zod";
import { protectedProcedure } from "../../trpc";
import * as crypto from "crypto";

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
const ENCRYPTION_IV = process.env.ENCRYPTION_IV;

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

export const update = protectedProcedure
  .input(
    z.object({
      id: z.string(),
      name: z.string().optional(),
      avatarUrl: z.string().optional(),
      encryptedHFApiKey: z.string().optional(),
    }),
  )
  .output(TeamSchema)
  .mutation(
    async ({
      input: { id, name, avatarUrl, encryptedHFApiKey },
      ctx: { abilities, user },
    }) => {
      if (!abilities.isTeamOwner(id)) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "No permission to update this team.",
        });
      }

      // Create the data object
      const data: any = {};
      if (name !== undefined) data.name = name;
      if (avatarUrl !== undefined) data.avatarUrl = avatarUrl;

      // Handle the HF API Key if provided
      if (encryptedHFApiKey !== undefined) {
        data.encryptedHFApiKey = encryptApiKey(encryptedHFApiKey);
      }

      const team = await db.team.update({
        where: {
          id,
        },
        data,
      });

      return team;
    },
  );
