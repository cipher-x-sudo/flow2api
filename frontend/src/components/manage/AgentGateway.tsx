import { useEffect, useState, useMemo } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { adminJson } from "@/lib/adminApi"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Loader2, CheckCircle2, XCircle, Copy } from "lucide-react"
import { Link } from "react-router-dom"

function toWssBase(publicBase: string): string {
  const t = publicBase.trim()
  if (!t) return ""
  try {
    const u = new URL(t.startsWith("http") ? t : `https://${t}`)
    u.protocol = u.protocol === "https:" ? "wss:" : "ws:"
    return u.origin
  } catch {
    return ""
  }
}

export function AgentGateway() {
  const { token } = useAuth()
  const [captchaMethod, setCaptchaMethod] = useState<string>("")
  const [remoteBase, setRemoteBase] = useState("")
  const [publicAgentUrl, setPublicAgentUrl] = useState("")
  const [captchaLoaded, setCaptchaLoaded] = useState(false)
  const [healthStatus, setHealthStatus] = useState<"idle" | "loading" | "ok" | "err">("idle")
  const [healthBody, setHealthBody] = useState<string>("")

  useEffect(() => {
    if (!token) return
    let cancelled = false
    ;(async () => {
      const { ok, data } = await adminJson<Record<string, unknown>>("/api/captcha/config", token)
      if (cancelled) return
      if (ok && data) {
        const m = data.captcha_method
        setCaptchaMethod(typeof m === "string" ? m : "")
        const rb = data.remote_browser_base_url
        setRemoteBase(typeof rb === "string" ? rb : "")
      }
      setCaptchaLoaded(true)
    })()
    return () => {
      cancelled = true
    }
  }, [token])

  const wssUrl = useMemo(() => {
    const o = toWssBase(publicAgentUrl)
    return o ? `${o}/ws/agents` : ""
  }, [publicAgentUrl])

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success("Copied")
    } catch {
      toast.error("Copy failed")
    }
  }

  const pingHealth = async () => {
    const base = publicAgentUrl.trim()
    if (!base) {
      toast.error("Set the public agent URL first")
      return
    }
    let url: string
    try {
      url = new URL("/health", base.startsWith("http") ? base : `https://${base}`).toString()
    } catch {
      toast.error("Invalid URL")
      return
    }
    setHealthStatus("loading")
    setHealthBody("")
    try {
      const r = await fetch(url, { method: "GET" })
      const text = await r.text()
      setHealthBody(text || `HTTP ${r.status}`)
      setHealthStatus(r.ok ? "ok" : "err")
      if (r.ok) toast.success("Gateway reachable")
      else toast.error(`HTTP ${r.status}`)
    } catch (e) {
      setHealthStatus("err")
      setHealthBody(e instanceof Error ? e.message : String(e))
      toast.error("Health check failed (CORS or network)")
    }
  }

  if (!token) {
    return null
  }
  if (!captchaLoaded) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading captcha config…
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <p className="text-sm text-muted-foreground">
        Operator UI for the <strong>remote captcha agent</strong> lives here (this admin app in{" "}
        <code className="text-xs bg-muted px-1 rounded">frontend/</code>
        ), not on the gateway port’s API docs. Connect PCs over WebSocket to your public{" "}
        <code className="text-xs bg-muted px-1 rounded">agents.*</code> hostname.
      </p>

      {captchaMethod && captchaMethod !== "remote_browser" && (
        <p className="text-sm text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-800/60 rounded-md px-3 py-2">
          Captcha method is <strong>{captchaMethod}</strong>. For agents, set{" "}
          <Link to="/manage?tab=settings" className="underline font-medium">
            System settings
          </Link>{" "}
          → captcha to <strong>Remote headed</strong> (
          <code className="text-xs">remote_browser</code>).
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Flow2API → gateway (HTTP)</CardTitle>
          <CardDescription>
            Value from <strong>System settings</strong> (remote browser). Inside Docker this is usually{" "}
            <code className="text-xs">http://agent-gateway:9080</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <code className="text-sm break-all bg-muted px-2 py-1 rounded flex-1 min-w-0">
              {remoteBase || "— not configured —"}
            </code>
            {remoteBase ? (
              <Button type="button" variant="outline" size="sm" onClick={() => copy(remoteBase)}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>PC agents → public URL</CardTitle>
          <CardDescription>
            The hostname you set in Cloudflare (e.g. <code className="text-xs">https://agents.example.com</code> →
            <code className="text-xs">http://agent-gateway:9080</code>). Used to build the WebSocket URL and test
            health.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="public-agent-url">Public agent base URL</Label>
            <Input
              id="public-agent-url"
              placeholder="https://agents.example.com"
              value={publicAgentUrl}
              onChange={(e) => setPublicAgentUrl(e.target.value)}
            />
          </div>
          {wssUrl ? (
            <div className="space-y-2">
              <Label>WebSocket (register agents here)</Label>
              <div className="flex flex-wrap items-center gap-2">
                <code className="text-sm break-all bg-muted px-2 py-1 rounded flex-1 min-w-0">{wssUrl}</code>
                <Button type="button" variant="outline" size="sm" onClick={() => copy(wssUrl)}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" onClick={pingHealth} disabled={healthStatus === "loading"}>
              {healthStatus === "loading" ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                  Checking…
                </>
              ) : (
                "GET /health (browser)"
              )}
            </Button>
            {healthStatus === "ok" && <CheckCircle2 className="h-4 w-4 text-green-600" />}
            {healthStatus === "err" && <XCircle className="h-4 w-4 text-destructive" />}
          </div>
          {healthBody ? (
            <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto max-h-40">{healthBody}</pre>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Register message (first frame after connect)</CardTitle>
          <CardDescription>
            <code className="text-xs">GATEWAY_AGENT_DEVICE_TOKEN</code> must match your server env.{" "}
            <code className="text-xs">token_ids</code> are Flow2API token row IDs to serve.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto">
            {`{
  "type": "register",
  "device_token": "<GATEWAY_AGENT_DEVICE_TOKEN>",
  "token_ids": [1]
}`}
          </pre>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() =>
              copy(
                `{
  "type": "register",
  "device_token": "<GATEWAY_AGENT_DEVICE_TOKEN>",
  "token_ids": [1]
}`
              )
            }
          >
            <Copy className="h-3.5 w-3.5 mr-1" />
            Copy JSON
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
