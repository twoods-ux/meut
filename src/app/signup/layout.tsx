import { MaintenanceScreen } from "@/components/maintenance-screen";
import { isMaintenanceMode } from "@/lib/maintenance";

export const dynamic = "force-dynamic";

export default function SignupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (isMaintenanceMode()) return <MaintenanceScreen />;
  return children;
}
