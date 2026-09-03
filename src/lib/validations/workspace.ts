import { z } from "zod";

export const createWorkspaceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Workspace name must contain at least 2 characters")
    .max(80, "Workspace name cannot exceed 80 characters"),
});

export type CreateWorkspaceInput = z.infer<
  typeof createWorkspaceSchema
>;
