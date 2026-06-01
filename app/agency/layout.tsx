import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Impact BBDO - Brief Creator",
};

export default function AgencyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
