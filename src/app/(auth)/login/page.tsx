import { LoginForm } from "@/components/auth/login-form";

export const metadata = {
  title: "Sign in",
};

type LoginPageProps = {
  searchParams: Promise<{ registered?: string | string[]; verified?: string | string[] }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const parameters = await searchParams;
  return <LoginForm registrationComplete={parameters.registered === "true"} emailVerified={parameters.verified === "true"} />;
}
