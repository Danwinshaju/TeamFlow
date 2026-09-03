import { z } from "zod";

export const taskStatuses = ["todo", "in_progress", "done"] as const;
export const taskPriorities = ["low", "medium", "high", "urgent"] as const;

export const createTaskSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, "Task title must contain at least 2 characters")
    .max(160, "Task title cannot exceed 160 characters"),
  description: z
    .string()
    .trim()
    .max(2000, "Description cannot exceed 2000 characters")
    .optional(),
  priority: z.enum(taskPriorities),
  assigneeId: z.union([z.string().uuid(), z.literal("")]).optional(),
  dueDate: z.union([z.string().date(), z.literal("")]).optional(),
});

export const updateTaskStatusSchema = z.object({
  status: z.enum(taskStatuses),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
