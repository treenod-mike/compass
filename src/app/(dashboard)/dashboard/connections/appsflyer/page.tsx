import { listApps } from "@/shared/api/appsflyer"
import { ConnectionsClient } from "@/widgets/connections/ui/connections-client"

export const dynamic = "force-dynamic"

export default async function AppsFlyerConnectionsPage() {
  const apps = await listApps()
  return (
    <main className="px-10 pt-6 pb-24">
      <ConnectionsClient initialApps={apps} />
    </main>
  )
}
