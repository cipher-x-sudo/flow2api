import { useMemo, useEffect } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { Layout } from "../components/Layout"
import { Tabs, TabsList, TabsTrigger } from "../components/ui/tabs"
import { TokenManagement } from "../components/manage/TokenManagement"
import { SystemSettings } from "../components/manage/SystemSettings"
import { RequestLogs } from "../components/manage/RequestLogs"
import { CacheManagement } from "../components/manage/CacheManagement"
import { AgentGateway } from "../components/manage/AgentGateway"
import { cn } from "@/lib/utils"

const MANAGE_TABS = ["tokens", "settings", "logs", "cache", "agent"] as const
type ManageTab = (typeof MANAGE_TABS)[number]

function parseManageTab(raw: string | null): ManageTab {
  if (raw && (MANAGE_TABS as readonly string[]).includes(raw)) return raw as ManageTab
  return "tokens"
}

export default function Manage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = useMemo(
    () => parseManageTab(searchParams.get("tab")),
    [searchParams]
  )
  const setTab = (v: string) => {
    if (v === "tokens") setSearchParams({})
    else setSearchParams({ tab: v })
  }
  useEffect(() => {
    const raw = searchParams.get("tab")
    if (raw && !MANAGE_TABS.includes(raw as ManageTab)) {
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams])

  const settingsActive = tab === "settings"
  const cacheActive = tab === "cache"

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
            <TabsTrigger
              value="cache"
              className={cn(
                "rounded-none border-b-2 border-transparent px-1 py-3 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
              )}
            >
              Cache management
            </TabsTrigger>
            <TabsTrigger
              value="agent"
              className={cn(
                "rounded-none border-b-2 border-transparent px-1 py-3 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
              )}
            >
              Agent gateway
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
      {tab === "cache" && (
        <div className="animate-in fade-in duration-300">
          <CacheManagement active={cacheActive} />
        </div>
      )}
      {tab === "agent" && (
        <div className="animate-in fade-in duration-300">
          <AgentGateway />
        </div>
      )}
    </Layout>
  )
}
