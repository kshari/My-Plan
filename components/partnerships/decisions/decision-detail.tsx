"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Vote, MessageSquare, CheckCircle, Send, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import {
  DECISION_TYPE_LABELS,
  VOTING_METHOD_LABELS,
} from "@/lib/constants/partnerships"
import type {
  PartnershipDecision,
  DecisionOption,
  Vote as VoteType,
  DecisionComment,
  PartnershipMember,
} from "@/lib/types/partnerships"
import { cn } from "@/lib/utils"

interface DecisionDetailProps {
  entityId: string
  decision: PartnershipDecision
  options: DecisionOption[]
  votes: VoteType[]
  comments: DecisionComment[]
  members: PartnershipMember[]
  currentMemberId: string | null
  isAdmin: boolean
}

export function DecisionDetail({
  entityId,
  decision,
  options,
  votes,
  comments: initialComments,
  members,
  currentMemberId,
  isAdmin,
}: DecisionDetailProps) {
  const router = useRouter()
  const [selectedOption, setSelectedOption] = useState<string>("")
  const [voteComment, setVoteComment] = useState("")
  const [voting, setVoting] = useState(false)
  const [newComment, setNewComment] = useState("")
  const [commenting, setCommenting] = useState(false)
  const [comments, setComments] = useState(initialComments)
  const [outcome, setOutcome] = useState(decision.outcome ?? "")
  const [closingStatus, setClosingStatus] = useState<"approved" | "rejected" | "closed">("closed")

  const myVote = votes.find((v) => v.member_id === currentMemberId)
  const totalVotes = votes.length
  const totalMembers = members.filter((m) => m.status === "active").length
  const isOpen = decision.status === "open"

  // Vote tallies
  const tally = options.map((opt) => {
    const optVotes = votes.filter((v) => v.option_id === opt.id)
    return {
      option: opt,
      count: optVotes.length,
      pct: totalVotes > 0 ? (optVotes.length / totalVotes) * 100 : 0,
    }
  })

  async function handleVote(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedOption) return
    setVoting(true)
    try {
      const res = await fetch(`/api/partnerships/${entityId}/decisions/${decision.id}/votes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ option_id: selectedOption, comment: voteComment }),
      })
      if (!res.ok) throw new Error()
      toast.success("Vote recorded")
      router.refresh()
    } catch {
      toast.error("Failed to record vote")
    } finally {
      setVoting(false)
    }
  }

  async function handleComment(e: React.FormEvent) {
    e.preventDefault()
    if (!newComment.trim()) return
    setCommenting(true)
    try {
      const res = await fetch(`/api/partnerships/${entityId}/decisions/${decision.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newComment.trim() }),
      })
      if (!res.ok) throw new Error()
      const { comment } = await res.json()
      setComments((prev) => [...prev, comment])
      setNewComment("")
      toast.success("Comment added")
    } catch {
      toast.error("Failed to add comment")
    } finally {
      setCommenting(false)
    }
  }

  async function handleClose() {
    try {
      const res = await fetch(`/api/partnerships/${entityId}/decisions/${decision.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: closingStatus, outcome: outcome || null }),
      })
      if (!res.ok) throw new Error()
      toast.success("Decision closed")
      router.refresh()
    } catch {
      toast.error("Failed to close decision")
    }
  }

  const STATUS_BADGE: Record<string, string> = {
    draft: "bg-muted text-muted-foreground",
    open: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    closed: "bg-muted text-muted-foreground",
    approved: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    rejected: "bg-destructive/10 text-destructive",
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{decision.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", STATUS_BADGE[decision.status])}>
                {decision.status.charAt(0).toUpperCase() + decision.status.slice(1)}
              </span>
              <span className="text-xs text-muted-foreground">{DECISION_TYPE_LABELS[decision.decision_type]}</span>
              {decision.voting_method && (
                <span className="text-xs text-muted-foreground">· {VOTING_METHOD_LABELS[decision.voting_method]}</span>
              )}
              {decision.deadline && (
                <span className="text-xs text-muted-foreground">· Deadline: {new Date(decision.deadline).toLocaleDateString()}</span>
              )}
            </div>
          </div>
        </div>
        {decision.description && (
          <p className="mt-3 text-sm text-muted-foreground max-w-3xl">{decision.description}</p>
        )}
        {decision.outcome && (
          <div className="mt-3 rounded-lg bg-muted/50 p-3 text-sm">
            <span className="font-medium">Outcome: </span>
            {decision.outcome}
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Voting section */}
        {decision.decision_type === "vote" && (
          <div className="rounded-xl border bg-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Votes</h2>
              <span className="text-xs text-muted-foreground">
                {totalVotes}/{totalMembers} voted
              </span>
            </div>

            {/* Tally bars */}
            <div className="space-y-3">
              {tally.map(({ option, count, pct }) => (
                <div key={option.id}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm">{option.label}</span>
                    <span className="text-sm font-semibold tabular-nums">{count} ({pct.toFixed(0)}%)</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-blue-500 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Cast vote */}
            {isOpen && currentMemberId && (
              <div className="border-t pt-4">
                {myVote ? (
                  <div className="flex items-center gap-2 text-sm text-emerald-600">
                    <CheckCircle className="h-4 w-4" />
                    You voted: {options.find((o) => o.id === myVote.option_id)?.label}
                  </div>
                ) : (
                  <form onSubmit={handleVote} className="space-y-3">
                    <Label>Cast Your Vote</Label>
                    <Select value={selectedOption} onValueChange={setSelectedOption}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose an option..." />
                      </SelectTrigger>
                      <SelectContent>
                        {options.map((o) => (
                          <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Textarea
                      placeholder="Optional reasoning..."
                      value={voteComment}
                      onChange={(e) => setVoteComment(e.target.value)}
                      rows={2}
                    />
                    <Button type="submit" disabled={voting || !selectedOption} className="w-full">
                      {voting ? "Submitting..." : "Submit Vote"}
                    </Button>
                  </form>
                )}
              </div>
            )}

            {!isOpen && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground border-t pt-4">
                <Lock className="h-3.5 w-3.5" />
                Voting is closed
              </div>
            )}
          </div>
        )}

        {/* Close decision (admin only) */}
        {isAdmin && isOpen && (
          <div className="rounded-xl border bg-card p-6 space-y-4">
            <h2 className="text-base font-semibold">Close Decision</h2>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Result</Label>
                <Select value={closingStatus} onValueChange={(v) => setClosingStatus(v as "approved" | "rejected" | "closed")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="closed">Closed (no verdict)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="outcome">Outcome Summary</Label>
                <Textarea
                  id="outcome"
                  placeholder="Summarize the decision outcome..."
                  value={outcome}
                  onChange={(e) => setOutcome(e.target.value)}
                  rows={2}
                />
              </div>
              <Button onClick={handleClose} variant="outline" className="w-full">
                Close & Record Outcome
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Discussion */}
      <div className="rounded-xl border bg-card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-base font-semibold">Discussion</h2>
          <span className="text-xs text-muted-foreground">{comments.length} comments</span>
        </div>

        {comments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No comments yet. Be the first to comment.</p>
        ) : (
          <div className="space-y-4">
            {comments.map((c) => {
              const member = members.find((m) => m.id === c.member_id)
              return (
                <div key={c.id} className="flex items-start gap-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 text-[10px] font-semibold shrink-0">
                    {(member?.display_name ?? "?").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium">{member?.display_name ?? "Unknown"}</span>
                      <span className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{c.content}</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {currentMemberId && (
          <form onSubmit={handleComment} className="flex gap-2 border-t pt-4">
            <Input
              placeholder="Add a comment..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              className="flex-1"
            />
            <Button type="submit" disabled={commenting || !newComment.trim()} size="icon">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
