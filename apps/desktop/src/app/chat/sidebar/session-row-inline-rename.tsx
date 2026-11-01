import { useRef, useState } from 'react'
import type * as React from 'react'

import { useI18n } from '@/i18n'
import { isSubmitEnter } from '@/lib/ime'
import { cn } from '@/lib/utils'

import { commitSessionRename } from './session-actions-menu'

interface SessionRowInlineRenameProps {
  className?: string
  /** The title the row currently paints — seeds the editor and decides no-op. */
  currentTitle: string
  /** Called once the editor should unmount (committed, unchanged or cancelled). */
  onDone: () => void
  profile?: string
  sessionId: string
}

/** The sidebar row's in-place title editor (double-click the title, Codex /
 *  Claude style). Same contract as the Files tree's InlineRenameInput: seeded
 *  and fully selected, commits on Enter/blur, cancels on Esc. The write itself
 *  is the shared `commitSessionRename`, so it routes exactly like the Rename
 *  dialog. A failed write keeps the editor open (the error already toasted) so
 *  the typed title is not lost.
 *
 *  The input lives INSIDE the row's body, so every gesture it handles stops at
 *  the input: a click must not resume, a press must not lift the row onto the
 *  drag session, a right-click must not open the session menu over the
 *  browser's text menu, and keys must not reach row/tree shortcuts. */
export function SessionRowInlineRename({
  className,
  currentTitle,
  onDone,
  profile,
  sessionId
}: SessionRowInlineRenameProps) {
  const { t } = useI18n()
  const r = t.sidebar.row
  const [value, setValue] = useState(currentTitle)
  const [submitting, setSubmitting] = useState(false)
  // Enter then the resulting blur must not both commit; latch while a finish
  // is in flight (released again if the write fails and the editor stays).
  const finishing = useRef(false)
  // The double-click that opened the editor is still settling (the second
  // click's focus/selection churn, the row resuming its session): ignore blurs
  // in this window and take focus back instead of committing instantly.
  const mountedAt = useRef(Date.now())

  const finish = async (commit: boolean) => {
    if (finishing.current) {
      return
    }

    finishing.current = true

    if (!commit) {
      onDone()

      return
    }

    setSubmitting(true)
    const ok = await commitSessionRename({ copy: r, currentTitle, next: value, profile, sessionId })

    if (ok) {
      onDone()

      return
    }

    setSubmitting(false)
    finishing.current = false
  }

  const stop = (event: React.SyntheticEvent) => event.stopPropagation()

  return (
    <input
      aria-label={r.renameTitle}
      autoComplete="off"
      autoFocus
      className={cn(
        'block w-full min-w-0 rounded-sm border border-[color-mix(in_srgb,var(--dt-composer-ring)_55%,transparent)] bg-(--ui-bg-elevated) px-1 py-0 text-foreground outline-none',
        className
      )}
      data-session-inline-rename=""
      disabled={submitting}
      onAuxClick={stop}
      onBlur={event => {
        if (submitting) {
          return
        }

        if (Date.now() - mountedAt.current < 250) {
          event.currentTarget.focus()

          return
        }

        void finish(true)
      }}
      onChange={event => setValue(event.target.value)}
      onClick={stop}
      onContextMenu={stop}
      onDoubleClick={stop}
      onFocus={event => event.currentTarget.select()}
      onKeyDown={event => {
        event.stopPropagation()

        if (isSubmitEnter(event)) {
          event.preventDefault()
          void finish(true)
        } else if (event.key === 'Escape') {
          event.preventDefault()
          void finish(false)
        }
      }}
      onMouseDown={stop}
      onPointerDown={stop}
      placeholder={r.untitledPlaceholder}
      spellCheck={false}
      value={value}
    />
  )
}
