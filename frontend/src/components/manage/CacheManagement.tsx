import { useState, useEffect, useCallback } from "react"
import { useAuth } from "../../contexts/AuthContext"
import { adminFetch, adminJson } from "../../lib/adminApi"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { Switch } from "../ui/switch"
import { toast } from "sonner"
import { RefreshCw, Trash2 } from "lucide-react"
import type { CacheStatsResponse, CacheConfigResponse } from "../../types/admin"

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(2)} MB`
}

export function CacheManagement({ active }: { active: boolean }) {
  const { token } = useAuth()
  const [cacheEnabled, setCacheEnabled] = useState(true)
  const [cacheTimeout, setCacheTimeout] = useState("7200")
  const [cacheBaseUrl, setCacheBaseUrl] = useState("")
  const [cacheEffectiveUrl, setCacheEffectiveUrl] = useState("")

  const [statsLoading, setStatsLoading] = useState(false)
  const [fileCount, setFileCount] = useState<number | null>(null)
  const [totalBytes, setTotalBytes] = useState<number | null>(null)
  const [cacheDir, setCacheDir] = useState("")

  const [busy, setBusy] = useState(false)

  const loadConfig = useCallback(async () => {
    if (!token || !active) return
    const cache = await adminJson<CacheConfigResponse>("/api/cache/config", token)
    if (cache.ok && cache.data?.success && cache.data.config) {
      setCacheEnabled(cache.data.config.enabled !== false)
      setCacheTimeout(String(cache.data.config.timeout ?? 7200))
      setCacheBaseUrl(cache.data.config.base_url || "")
      setCacheEffectiveUrl(cache.data.config.effective_base_url || "")
    }
  }, [token, active])

  const loadStats = useCallback(async () => {
    if (!token || !active) return
    setStatsLoading(true)
    try {
      const r = await adminJson<CacheStatsResponse>("/api/cache/stats", token)
      if (r.ok && r.data?.success) {
        setFileCount(r.data.file_count ?? 0)
        setTotalBytes(r.data.total_bytes ?? 0)
        setCacheDir(r.data.cache_dir || "")
      } else toast.error("Failed to load cache stats")
    } catch {
      toast.error("Failed to load cache stats")
    } finally {
      setStatsLoading(false)
    }
  }, [token, active])

  const loadAll = useCallback(async () => {
    await Promise.all([loadConfig(), loadStats()])
  }, [loadConfig, loadStats])

  useEffect(() => {
    if (!active) return
    const id = requestAnimationFrame(() => {
      void loadAll()
    })
    return () => cancelAnimationFrame(id)
  }, [active, loadAll])

  const saveCache = async () => {
    if (!token) return
    const timeout = cacheTimeout.trim() === "" ? 7200 : parseInt(cacheTimeout, 10)
    const baseUrl = cacheBaseUrl.trim()
    if (Number.isNaN(timeout) || timeout < 0 || timeout > 86400) return toast.error("Cache timeout 0–86400")
    if (baseUrl && !baseUrl.startsWith("http://") && !baseUrl.startsWith("https://")) return toast.error("Base URL must start with http(s)://")
    setBusy(true)
    try {
      const r0 = await adminFetch("/api/cache/enabled", token, {
        method: "POST",
        body: JSON.stringify({ enabled: cacheEnabled }),
      })
      if (!r0) return
      const d0 = await r0.json()
      if (!d0.success) return toast.error("Cache enabled save failed")
      const r1 = await adminFetch("/api/cache/config", token, {
        method: "POST",
        body: JSON.stringify({ timeout }),
      })
      if (!r1) return
      const d1 = await r1.json()
      if (!d1.success) return toast.error("Cache timeout save failed")
      const r2 = await adminFetch("/api/cache/base-url", token, {
        method: "POST",
        body: JSON.stringify({ base_url: baseUrl }),
      })
      if (!r2) return
      const d2 = await r2.json()
      if (d2.success) {
        toast.success("Cache config saved")
        await new Promise((r) => setTimeout(r, 200))
        await loadConfig()
      } else toast.error("Cache base URL failed")
    } finally {
      setBusy(false)
    }
  }

  const clearCache = async () => {
    if (!token) return
    if (!confirm("Delete all files in the cache directory? This cannot be undone.")) return
    setBusy(true)
    try {
      const r = await adminFetch("/api/cache/clear", token, { method: "POST" })
      if (!r) return
      const d = await r.json().catch(() => ({}))
      if (d.success) {
        const n = d.removed_count ?? 0
        toast.success(`Removed ${n} file(s)`)
        await loadStats()
      } else toast.error(d.detail || d.message || "Clear failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle>File cache</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Switch checked={cacheEnabled} onCheckedChange={setCacheEnabled} />
            <Label>Enable file cache</Label>
          </div>
          {cacheEnabled ? (
            <>
              <div>
                <Label>Cache TTL (seconds)</Label>
                <Input type="number" className="mt-1" value={cacheTimeout} onChange={(e) => setCacheTimeout(e.target.value)} />
              </div>
              <div>
                <Label>Public base URL for cached files</Label>
                <Input className="mt-1" value={cacheBaseUrl} onChange={(e) => setCacheBaseUrl(e.target.value)} placeholder="https://yourdomain.com" />
              </div>
              {cacheEffectiveUrl ? (
                <p className="text-xs text-muted-foreground">
                  Effective URL: <code className="bg-muted px-1 rounded">{cacheEffectiveUrl}</code>
                </p>
              ) : null}
            </>
          ) : null}
          <Button onClick={saveCache} disabled={busy}>
            Save cache settings
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Cache store</CardTitle>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => void loadStats()} disabled={statsLoading || busy}>
              <RefreshCw className={`h-4 w-4 mr-1 ${statsLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button type="button" variant="destructive" size="sm" onClick={clearCache} disabled={busy || statsLoading}>
              <Trash2 className="h-4 w-4 mr-1" />
              Clear cache
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {cacheDir ? (
            <p className="text-muted-foreground break-all">
              <span className="text-foreground font-medium">Path: </span>
              {cacheDir}
            </p>
          ) : null}
          <p>
            <span className="text-muted-foreground">Files: </span>
            {fileCount !== null ? fileCount : "—"}
          </p>
          <p>
            <span className="text-muted-foreground">Size: </span>
            {totalBytes !== null ? formatBytes(totalBytes) : "—"}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
