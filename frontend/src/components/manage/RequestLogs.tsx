import { useState, useEffect, useCallback } from "react"
import { useAuth } from "../../contexts/AuthContext"
import { adminFetch, adminJson } from "../../lib/adminApi"
import type { LogListItem, LogDetail } from "../../types/admin"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { Button } from "../ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog"
import { toast } from "sonner"
import { RefreshCw, Trash2, Loader2 } from "lucide-react"

const STATUS_MAP: Record<string, string> = {
  started: "Started",
  token_selected: "Token selected",
  token_ready: "Token ready",
  project_ready: "Project ready",
  uploading_images: "Uploading images",
  solving_image_captcha: "Solving captcha",
  submitting_image: "Submitting image",
  image_generated: "Image done",
  preparing_video: "Preparing video",
  submitting_video: "Submitting video",
  video_submitted: "Video submitted",
  video_polling: "Video polling",
  caching_image: "Caching image",
  caching_video: "Caching video",
  completed: "Completed",
  failed: "Failed",
  processing: "Processing",
  upsampling_2k: "Upsampling 2K",
  upsampling_4k: "Upsampling 4K",
  upsampling_1080p: "Upsampling 1080p",
}

function formatLogStatus(l: LogListItem): string {
  const st = (l.status_text || "").trim()
  if (st) return STATUS_MAP[st] || st
  if (l.status_code === 102) return "Processing"
  if (l.status_code === 200) return "Completed"
  if (l.status_code != null && l.status_code >= 400) return "Failed"
  return "—"
}

function formatProgress(l: LogListItem): string {
  if (l.progress === null || l.progress === undefined) return "—"
  const n = Number(l.progress)
  return Number.isFinite(n) ? `${Math.max(0, Math.min(100, n))}%` : "—"
}

function formatOutcome(l: LogListItem): string {
  const code = Number(l.status_code)
  if (code === 200) {
    const op = String(l.operation || "").trim()
    if (op === "generate_image") return "Image result returned"
    if (op === "generate_video") return "Video result returned"
    return "Result returned"
  }
  if (code === 102) return "Processing"
  const err = (l.error_summary || "").trim()
  if (err) return err.length > 96 ? `${err.slice(0, 93)}...` : err
  if (code >= 400) return "Request failed"
  return "—"
}

function tryFormatJson(raw: string | null | undefined): string {
  if (!raw) return ""
  try {
    return JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    return raw
  }
}

export function RequestLogs() {
  const { token } = useAuth()
  const [logs, setLogs] = useState<LogListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detail, setDetail] = useState<LogDetail | null>(null)

  const fetchLogs = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const r = await adminFetch("/api/logs?limit=100", token)
      if (!r?.ok) throw new Error("fetch failed")
      const data = (await r.json()) as LogListItem[]
      setLogs(Array.isArray(data) ? data : [])
    } catch {
      toast.error("Failed to load logs")
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void fetchLogs()
  }, [fetchLogs])

  const clearLogs = async () => {
    if (!token) return
    if (!confirm("Clear all request logs? This cannot be undone.")) return
    try {
      const r = await adminFetch("/api/logs", token, { method: "DELETE" })
      if (!r) return
      const d = await r.json().catch(() => ({}))
      if (d.success) {
        toast.success("Logs cleared")
        setLogs([])
        setDetailOpen(false)
        setDetail(null)
      } else toast.error(d.message || "Clear failed")
    } catch {
      toast.error("Network error")
    }
  }

  const openDetail = async (id: number) => {
    if (!token) return
    setDetailOpen(true)
    setDetailLoading(true)
    setDetail(null)
    try {
      const { ok, data } = await adminJson<LogDetail>(`/api/logs/${id}`, token)
      if (!ok || !data) {
        toast.error("Failed to load log detail")
        return
      }
      setDetail(data)
    } catch {
      toast.error("Failed to load log detail")
    } finally {
      setDetailLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-4 border-b">
        <CardTitle>Request logs</CardTitle>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={clearLogs} className="text-destructive hover:text-destructive hover:bg-destructive/10">
            <Trash2 className="h-4 w-4 mr-2" /> Clear
          </Button>
          <Button variant="outline" size="icon" onClick={() => void fetchLogs()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="w-full overflow-auto max-h-[600px]">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead>Operation</TableHead>
                <TableHead>Token email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Code</TableHead>
                <TableHead className="w-[17rem]">Summary</TableHead>
                <TableHead>Duration (s)</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!logs.length ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    {loading ? "Loading…" : "No logs"}
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-mono text-xs">{log.operation || "—"}</TableCell>
                    <TableCell className="text-xs">{log.token_email || "—"}</TableCell>
                    <TableCell className="text-xs">{formatLogStatus(log)}</TableCell>
                    <TableCell className="text-xs">{formatProgress(log)}</TableCell>
                    <TableCell className="text-xs">{log.status_code ?? "—"}</TableCell>
                    <TableCell className="max-w-[17rem] truncate text-xs" title={formatOutcome(log)}>
                      {formatOutcome(log)}
                    </TableCell>
                    <TableCell className="text-xs">{Number(log.duration || 0).toFixed(2)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {log.created_at ? new Date(log.created_at).toLocaleString() : "—"}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => void openDetail(log.id)}>
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Log detail</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto space-y-4 text-sm pr-1">
            {detailLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : detail ? (
              <>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">ID:</span> {detail.id}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Operation:</span> {detail.operation}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Email:</span> {detail.token_email || "—"}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Status:</span> {formatLogStatus(detail)} ({detail.status_code})
                  </div>
                  <div>
                    <span className="text-muted-foreground">Duration:</span> {Number(detail.duration || 0).toFixed(2)}s
                  </div>
                  <div>
                    <span className="text-muted-foreground">Updated:</span>{" "}
                    {detail.updated_at ? new Date(detail.updated_at).toLocaleString() : "—"}
                  </div>
                </div>
                {detail.error_summary ? (
                  <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs">
                    <strong>Error:</strong> {detail.error_summary}
                  </div>
                ) : null}
                <div>
                  <h4 className="font-medium mb-1">Request body</h4>
                  <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap break-all">
                    {tryFormatJson(detail.request_body) || "—"}
                  </pre>
                </div>
                <div>
                  <h4 className="font-medium mb-1">Response body</h4>
                  <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto max-h-64 overflow-y-auto whitespace-pre-wrap break-all">
                    {tryFormatJson(detail.response_body) || "—"}
                  </pre>
                </div>
              </>
            ) : (
              <p className="text-muted-foreground">No data</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
