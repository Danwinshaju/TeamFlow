import { VerifyEmailForm } from "@/components/auth/verify-email-form";

export const metadata = {
  title: "Verify email",
};

type VerifyEmailPageProps = {
  searchParams: Promise<{
    token?: string | string[];
  }>;
};

export default async function VerifyEmailPage({
  searchParams,
}: VerifyEmailPageProps) {
  const parameters = await searchParams;

  const token =
    typeof parameters.token === "string"
      ? parameters.token
      : null;

  return <VerifyEmailForm token={token} />;
}