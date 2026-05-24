import { StatsDashboard } from "@/components/StatsDashboard";
import { DashboardAlerts } from "./DashboardAlerts";

export default function DashboardPage() {
  return (
    <div className="space-y-5">
      <DashboardAlerts />
      <StatsDashboard />
    </div>
  );
}