import { AcceptInvitationForm } from "@/components/accept-invitation-form";

export const metadata = {
  title: "Accept invitation",
};

type AcceptInvitationPageProps = {
  searchParams: Promise<{
    token?: string | string[];
  }>;
};

export default async function AcceptInvitationPage({
  searchParams,
}: AcceptInvitationPageProps) {
  const parameters = await searchParams;

  const token =
    typeof parameters.token === "string"
      ? parameters.token
      : null;

  return (
    <AcceptInvitationForm token={token} />
  );
}
