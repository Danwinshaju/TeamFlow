import { z } from "zod";

export const registerSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Name must contain at least 2 characters")
      .max(80, "Name cannot exceed 80 characters"),

    email: z
      .string()
      .trim()
      .toLowerCase()
      .email("Enter a valid email address"),

    phone: z.string().trim().max(30, "Phone number is too long"),
    jobTitle: z.string().trim().max(100, "Job title is too long"),
    bio: z.string().trim().max(500, "Bio cannot exceed 500 characters"),
    avatarDataUrl: z.string().max(1_500_000, "Profile image is too large").refine(
      (value) => !value || /^data:image\/(?:png|jpeg|webp);base64,/.test(value),
      "Choose a PNG, JPEG, or WebP image",
    ),

    password: z
      .string()
      .min(8, "Password must contain at least 8 characters")
      .max(128, "Password cannot exceed 128 characters")
      .regex(/[A-Z]/, "Include at least one uppercase letter")
      .regex(/[a-z]/, "Include at least one lowercase letter")
      .regex(/[0-9]/, "Include at least one number"),

    confirmPassword: z.string(),

    acceptTerms: z.boolean().refine((value) => value, {
      message: "You must accept the terms",
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type RegisterInput = z.infer<typeof registerSchema>;
export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Enter a valid email address"),

  password: z
    .string()
    .min(1, "Password is required")
    .max(128, "Password cannot exceed 128 characters"),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const profileSchema = z.object({
  name: z.string().trim().min(2, "Name must contain at least 2 characters").max(80, "Name cannot exceed 80 characters"),
  phone: z.string().trim().max(30, "Phone number is too long").optional().default(""),
  jobTitle: z.string().trim().max(100, "Job title is too long").optional().default(""),
  bio: z.string().trim().max(500, "Bio cannot exceed 500 characters").optional().default(""),
  avatarDataUrl: z.string().max(1_500_000, "Profile image is too large").refine((value) => !value || /^data:image\/(?:png|jpeg|webp);base64,/.test(value), "Choose a PNG, JPEG, or WebP image").optional().default(""),
});

export type ProfileInput = z.infer<typeof profileSchema>;

export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Enter a valid email address"),
});

export type ForgotPasswordInput = z.infer<
  typeof forgotPasswordSchema
>;

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, "Reset token is required"),
    password: z
      .string()
      .min(8, "Password must contain at least 8 characters")
      .max(128, "Password cannot exceed 128 characters")
      .regex(/[A-Z]/, "Include at least one uppercase letter")
      .regex(/[a-z]/, "Include at least one lowercase letter")
      .regex(/[0-9]/, "Include at least one number"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type ResetPasswordInput = z.infer<
  typeof resetPasswordSchema
>;
