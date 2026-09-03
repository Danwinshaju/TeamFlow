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

export const updateTaskSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(2, "Task title must contain at least 2 characters")
      .max(160, "Task title cannot exceed 160 characters")
      .optional(),
    description: z
      .string()
      .trim()
      .max(2000, "Description cannot exceed 2000 characters")
      .optional(),
    status: z.enum(taskStatuses).optional(),
    priority: z.enum(taskPriorities).optional(),
    assigneeId: z.union([z.string().uuid(), z.literal("")]).optional(),
    dueDate: z.union([z.string().date(), z.literal("")]).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Provide at least one task change.",
  });

export const createTaskCommentSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Comment cannot be empty")
    .max(2000, "Comment cannot exceed 2000 characters"),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
