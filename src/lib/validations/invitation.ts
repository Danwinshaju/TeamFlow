import { z } from "zod";

export const createInvitationSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Enter a valid email address"),

  role: z.enum(["admin", "member"], {
    message: "Select a valid workspace role",
  }),
});

export type CreateInvitationInput = z.infer<
  typeof createInvitationSchema
>;