'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import {
  DEAL_STAGE_LABELS,
  DEAL_STAGES,
} from '@/lib/constants/property-defaults'
import type { DealTask, DealStage } from '@/lib/types/property-lifecycle'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Calendar, Flag, Plus, Trash2, Loader2 } from 'lucide-react'
import { format, isPast, isToday } from 'date-fns'

interface TaskListProps {
  propertyId: number
  /** If provided, only show tasks belonging to these stages (plus untagged tasks). */
  filterStages?: DealStage[]
  /** Show the Add Task form inline. */
  showAddTask?: boolean
  /** Whether to show all tasks regardless of stage filter. */
  showAll?: boolean
}

export function TaskList({ propertyId, filterStages, showAddTask = false, showAll = false }: TaskListProps) {
  const supabase = createClient()
  const [tasks, setTasks] = useState<DealTask[]>([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  // New task form state
  const [newTitle, setNewTitle] = useState('')
  const [newStage, setNewStage] = useState<DealStage | 'none'>('none')
  const [newKind, setNewKind] = useState<'task' | 'milestone'>('task')
  const [newDue, setNewDue] = useState('')

  async function load() {
    setLoading(true)
    const query = supabase
      .from('pi_deal_tasks')
      .select('*')
      .eq('property_id', propertyId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })

    const { data } = await query
    let list = (data as DealTask[]) ?? []

    if (!showAll && filterStages && filterStages.length > 0) {
      list = list.filter((t) => !t.stage || filterStages.includes(t.stage))
    }

    setTasks(list)
    setLoading(false)
  }

  useEffect(() => { load() }, [propertyId])

  async function toggleComplete(task: DealTask) {
    const nowCompleted = !task.completed
    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id
          ? { ...t, completed: nowCompleted, completed_at: nowCompleted ? new Date().toISOString() : null }
          : t
      )
    )
    await supabase
      .from('pi_deal_tasks')
      .update({
        completed: nowCompleted,
        completed_at: nowCompleted ? new Date().toISOString() : null,
      })
      .eq('id', task.id)
  }

  async function deleteTask(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id))
    await supabase.from('pi_deal_tasks').delete().eq('id', id)
  }

  async function addTask() {
    if (!newTitle.trim()) return
    setSaving(true)
    const { data: authData } = await supabase.auth.getUser()
    if (!authData?.user) { setSaving(false); return }

    const row = {
      property_id: propertyId,
      user_id: authData.user.id,
      title: newTitle.trim(),
      kind: newKind,
      stage: newStage === 'none' ? null : newStage,
      due_date: newDue || null,
      sort_order: tasks.length,
    }
    const { data: inserted } = await supabase
      .from('pi_deal_tasks')
      .insert([row])
      .select()
      .single()
    if (inserted) setTasks((prev) => [...prev, inserted as DealTask])
    setNewTitle('')
    setNewStage('none')
    setNewKind('task')
    setNewDue('')
    setAddOpen(false)
    setSaving(false)
  }

  if (loading) {
    return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
  }

  const pending = tasks.filter((t) => !t.completed)
  const done = tasks.filter((t) => t.completed)

  return (
    <div className="space-y-2">
      {tasks.length === 0 && !addOpen && (
        <p className="text-sm text-muted-foreground py-2">No tasks yet.</p>
      )}

      {/* Pending tasks */}
      {pending.map((task) => (
        <TaskRow key={task.id} task={task} onToggle={toggleComplete} onDelete={deleteTask} />
      ))}

      {/* Add task form */}
      {addOpen && (
        <div className="rounded-lg border border-dashed border-border p-3 space-y-2">
          <Input
            placeholder="Task title..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addTask()}
            autoFocus
          />
          <div className="flex gap-2 flex-wrap">
            <Select value={newKind} onValueChange={(v) => setNewKind(v as 'task' | 'milestone')}>
              <SelectTrigger className="w-32 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="task">Task</SelectItem>
                <SelectItem value="milestone">Milestone</SelectItem>
              </SelectContent>
            </Select>
            <Select value={newStage} onValueChange={(v) => setNewStage(v as DealStage | 'none')}>
              <SelectTrigger className="w-40 h-8 text-xs">
                <SelectValue placeholder="Stage (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No stage</SelectItem>
                {DEAL_STAGES.map((s) => (
                  <SelectItem key={s} value={s}>{DEAL_STAGE_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={newDue}
              onChange={(e) => setNewDue(e.target.value)}
              className="h-8 text-xs w-36"
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={addTask} disabled={saving || !newTitle.trim()}>
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Add'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAddOpen(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {showAddTask && !addOpen && (
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs gap-1 text-muted-foreground"
          onClick={() => setAddOpen(true)}
        >
          <Plus className="h-3 w-3" />
          Add task
        </Button>
      )}

      {/* Completed tasks (collapsed) */}
      {done.length > 0 && (
        <details className="mt-2">
          <summary className="text-xs text-muted-foreground cursor-pointer select-none">
            {done.length} completed
          </summary>
          <div className="mt-1 space-y-1 opacity-60">
            {done.map((task) => (
              <TaskRow key={task.id} task={task} onToggle={toggleComplete} onDelete={deleteTask} />
            ))}
          </div>
        </details>
      )}
    </div>
  )
}

function TaskRow({
  task, onToggle, onDelete,
}: {
  task: DealTask
  onToggle: (t: DealTask) => void
  onDelete: (id: string) => void
}) {
  const overdue =
    !task.completed && task.due_date && isPast(new Date(task.due_date + 'T23:59:59'))
  const dueToday = !task.completed && task.due_date && isToday(new Date(task.due_date))

  return (
    <div className="flex items-start gap-2 py-1 group">
      <Checkbox
        id={task.id}
        checked={task.completed}
        onCheckedChange={() => onToggle(task)}
        className="mt-0.5 shrink-0"
      />
      <div className="flex-1 min-w-0">
        <label
          htmlFor={task.id}
          className={cn(
            'text-sm cursor-pointer leading-tight',
            task.completed && 'line-through text-muted-foreground'
          )}
        >
          {task.kind === 'milestone' && (
            <Flag className="inline h-3 w-3 mr-1 text-amber-500 shrink-0" />
          )}
          {task.title}
        </label>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {task.due_date && (
            <span
              className={cn(
                'flex items-center gap-0.5 text-xs',
                overdue ? 'text-destructive' : dueToday ? 'text-amber-600' : 'text-muted-foreground'
              )}
            >
              <Calendar className="h-3 w-3" />
              {format(new Date(task.due_date), 'MMM d')}
            </span>
          )}
          {task.stage && (
            <Badge variant="outline" className="text-[10px] h-4 px-1">
              {DEAL_STAGE_LABELS[task.stage]}
            </Badge>
          )}
        </div>
      </div>
      <button
        onClick={() => onDelete(task.id)}
        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all p-0.5 shrink-0"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
