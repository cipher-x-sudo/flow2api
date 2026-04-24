import { useState, useEffect, useCallback } from "react"
import { useAuth } from "../../contexts/AuthContext"
import { adminFetch, adminJson } from "../../lib/adminApi"
import type { LogDetail, LogListItem } from "../../types/admin"
import {
  formatLogStatus,
  formatOutcome,
  formatProgressLabel,
  formatRelativeTime,
  getOperationKind,
  httpCodeTone,
  operationChipClass,
  operationLabel,
  outcomeTone,
  progressPercent,
  statusTone,
  tonePillClass,
  toneTextClass,
} from "./requestLogUi"
import { LogDetailStatic } from "./LogDetailStatic"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { Button } from "../ui/button"
import { Badge } from "../ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog"
import { toast } from "sonner"
import { RefreshCw, Trash2, Loader2, Copy } from "lucide-react"
import { cn } from "@/lib/utils"

async function copyText(text: string, okMsg = "Copied") {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(okMsg)
  } catch {
    toast.error("Copy failed")
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
    queueMicrotask(() => {
      void fetchLogs()
    })
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

  const colCount = 11

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-4 border-b">
        <div>
          <CardTitle className="text-lg">Request logs</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">Last 100 entries · semantic colors for status and HTTP code</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={clearLogs} className="text-destructive hover:text-destructive hover:bg-destructive/10">
            <Trash2 className="h-4 w-4 mr-2" /> Clear
          </Button>
          <Button variant="outline" size="icon" onClick={() => void fetchLogs()} disabled={loading} title="Refresh">
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="w-full overflow-auto max-h-[min(70vh,720px)] rounded-b-lg border-t border-border/60">
          <Table>
            <TableHeader className="sticky top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 shadow-sm">
              <TableRow className="hover:bg-transparent border-b">
                <TableHead className="w-[72px] text-[11px] uppercase tracking-wide text-muted-foreground">Log</TableHead>
                <TableHead className="w-[88px] text-[11px] uppercase tracking-wide text-muted-foreground">Operation</TableHead>
                <TableHead className="min-w-[140px] max-w-[200px] text-[11px] uppercase tracking-wide text-muted-foreground">Token</TableHead>
                <TableHead className="w-[120px] text-[11px] uppercase tracking-wide text-muted-foreground">Status</TableHead>
                <TableHead className="w-[100px] text-[11px] uppercase tracking-wide text-muted-foreground">Progress</TableHead>
                <TableHead className="w-[64px] text-[11px] uppercase tracking-wide text-muted-foreground">HTTP</TableHead>
                <TableHead className="min-w-[12rem] max-w-[18rem] text-[11px] uppercase tracking-wide text-muted-foreground">Summary</TableHead>
                <TableHead className="w-[72px] text-[11px] uppercase tracking-wide text-muted-foreground">Duration</TableHead>
                <TableHead className="w-[128px] text-[11px] uppercase tracking-wide text-muted-foreground">Time</TableHead>
                <TableHead className="w-[72px] text-right text-[11px] uppercase tracking-wide text-muted-foreground"> </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!logs.length ? (
                <TableRow>
                  <TableCell colSpan={colCount} className="text-center text-muted-foreground py-14 text-sm">
                    {loading ? (
                      <span className="inline-flex items-center gap-2 justify-center">
                        <Loader2 className="h-5 w-5 animate-spin" /> Loading…
                      </span>
                    ) : (
                      "No request logs yet"
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => {
                  const opKind = getOperationKind(log.operation)
                  const stTone = statusTone(log)
                  const httpTone = httpCodeTone(log.status_code ?? undefined)
                  const outTone = outcomeTone(log)
                  const pct = progressPercent(log)
                  const email = log.token_email || "—"
                  const emailTitle = [log.token_username, log.token_email].filter(Boolean).join(" · ") || email

                  return (
                    <TableRow key={log.id} className="group border-border/60 hover:bg-muted/50 transition-colors">
                      <TableCell className="align-top py-2.5">
                        <span className="font-mono text-[11px] text-muted-foreground tabular-nums" title={`Log id ${log.id}`}>
                          #{log.id}
                        </span>
                        {log.token_id != null ? (
                          <div className="font-mono text-[10px] text-muted-foreground/80 tabular-nums mt-0.5" title={`Token id ${log.token_id}`}>
                            t{log.token_id}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell className="align-top py-2.5">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px]",
                            operationChipClass(opKind)
                          )}
                          title={log.operation || ""}
                        >
                          {operationLabel(opKind, log.operation)}
                        </span>
                      </TableCell>
                      <TableCell className="align-top py-2.5 max-w-[200px]">
                        <div className="flex items-start gap-1">
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-xs font-medium text-foreground" title={emailTitle}>
                              {email}
                            </div>
                          </div>
                          {log.token_email ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 shrink-0 opacity-60 group-hover:opacity-100"
                              title="Copy email"
                              onClick={(e) => {
                                e.stopPropagation()
                                void copyText(log.token_email!, "Email copied")
                              }}
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="align-top py-2.5">
                        <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-[11px]", tonePillClass[stTone])}>
                          {formatLogStatus(log)}
                        </span>
                      </TableCell>
                      <TableCell className="align-top py-2.5">
                        <div className="flex flex-col gap-1 w-full max-w-[92px]">
                          {pct != null ? (
                            <>
                              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                                <div className="h-full rounded-full bg-primary/80 transition-all" style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-[10px] tabular-nums text-muted-foreground">{formatProgressLabel(log)}</span>
                            </>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">—</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="align-top py-2.5">
                        <Badge variant="outline" className={cn("font-mono text-[11px] px-1.5 py-0 h-6 border", tonePillClass[httpTone])}>
                          {log.status_code ?? "—"}
                        </Badge>
                      </TableCell>
                      <TableCell className="align-top py-2.5 max-w-[18rem]">
                        <p
                          className={cn("text-xs leading-snug line-clamp-2", toneTextClass[outTone])}
                          title={formatOutcome(log)}
                        >
                          {formatOutcome(log)}
                        </p>
                      </TableCell>
                      <TableCell className="align-top py-2.5 tabular-nums text-xs text-muted-foreground">{Number(log.duration || 0).toFixed(2)}</TableCell>
                      <TableCell className="align-top py-2.5">
                        <div className="text-[11px] leading-tight whitespace-nowrap text-muted-foreground">
                          {log.created_at ? new Date(log.created_at).toLocaleString() : "—"}
                        </div>
                        {log.created_at ? (
                          <div className="text-[10px] text-muted-foreground/70 mt-0.5">{formatRelativeTime(log.created_at)}</div>
                        ) : null}
                      </TableCell>
                      <TableCell className="align-top py-2.5 text-right">
                        <Button variant="secondary" size="sm" className="h-8 text-xs" onClick={() => void openDetail(log.id)}>
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="flex max-h-[80vh] w-[calc(100vw-2rem)] max-w-3xl translate-x-[-50%] translate-y-[-50%] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
          <DialogHeader className="shrink-0 flex-row items-center justify-between space-y-0 border-b border-border p-5 text-left">
            <DialogTitle className="text-lg font-semibold leading-none">日志详情</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            {detailLoading ? (
              <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                日志详情加载中…
              </div>
            ) : detail ? (
              <LogDetailStatic log={detail} />
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">无数据</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
