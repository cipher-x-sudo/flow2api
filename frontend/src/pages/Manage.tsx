import { useState } from "react"
import { Link } from "react-router-dom"
import { Layout } from "../components/Layout"
import { Tabs, TabsList, TabsTrigger } from "../components/ui/tabs"
import { TokenManagement } from "../components/manage/TokenManagement"
import { SystemSettings } from "../components/manage/SystemSettings"
import { RequestLogs } from "../components/manage/RequestLogs"
import { cn } from "@/lib/utils"

export default function Manage() {
  const [tab, setTab] = useState("tokens")
  const settingsActive = tab === "settings"

  return (
    <Layout>
      <div className="border-b border-border mb-6 flex flex-wrap items-end gap-6">
        <Tabs value={tab} onValueChange={setTab} className="flex-1 min-w-0">
          <TabsList className="h-auto w-full justify-start rounded-none bg-transparent p-0 gap-6">
            <TabsTrigger
              value="tokens"
              className={cn(
                "rounded-none border-b-2 border-transparent px-1 py-3 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
              )}
            >
              Token management
            </TabsTrigger>
            <TabsTrigger
              value="settings"
              className={cn(
                "rounded-none border-b-2 border-transparent px-1 py-3 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
              )}
            >
              System settings
            </TabsTrigger>
            <TabsTrigger
              value="logs"
              className={cn(
                "rounded-none border-b-2 border-transparent px-1 py-3 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
              )}
            >
              Request logs
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <Link
          to="/test"
          className={cn(
            "text-sm font-medium py-3 px-1 border-b-2 border-transparent text-muted-foreground hover:text-foreground transition-colors shrink-0 mb-px"
          )}
        >
          Test page
        </Link>
      </div>

      {tab === "tokens" && (
        <div className="animate-in fade-in duration-300">
          <TokenManagement />
        </div>
      )}
      {tab === "settings" && (
        <div className="animate-in fade-in duration-300">
          <SystemSettings active={settingsActive} />
        </div>
      )}
      {tab === "logs" && (
        <div className="animate-in fade-in duration-300">
          <RequestLogs />
        </div>
      )}
    </Layout>
  )
}
