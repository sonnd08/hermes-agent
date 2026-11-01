import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { atom } from 'nanostores'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { startSessionDrag } from '@/app/chat/session-drag'
import type * as SessionDrag from '@/app/chat/session-drag'
import { renameSession, type SessionInfo } from '@/hermes'
import type * as ChatRuntime from '@/lib/chat-runtime'
import type * as GatewayStore from '@/store/gateway'
import type * as ProjectsStore from '@/store/projects'
import type * as SessionStore from '@/store/session'
import type * as SessionColorStore from '@/store/session-color'
import type * as SessionStatesStore from '@/store/session-states'
import type * as WindowsStore from '@/store/windows'

import { SidebarSessionRow } from './session-row'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

// Double-click a sidebar session title to rename it in place (Codex / Claude
// muscle memory). The editor renders INSIDE the row body, so these pin the two
// halves of the contract: the commit goes through the same rename path as the
// dialog, and the editor's own gestures never leak into the row (resume, drag).
vi.mock('@/app/chat/session-drag', async importOriginal => {
  const actual = await importOriginal<typeof SessionDrag>()

  // Spy-WRAPPER, not a stub: the assertions count the calls, while the real
  // session still runs so the engage chrome a user sees (the grabbing cursor,
  // the row's lifted look) is exercised rather than assumed.
  return { ...actual, startSessionDrag: vi.fn(actual.startSessionDrag) }
})
vi.mock('@/components/pane-shell/tree/store', async importOriginal => {
  const actual = await importOriginal<Record<string, unknown>>()

  return {
    ...actual,
    closeAllTreeTabs: vi.fn(),
    closeOtherTreeTabs: vi.fn(),
    closeTreeTabsToRight: vi.fn(),
    treeTabCloseTargets: vi.fn(() => null)
  }
})
vi.mock('@/hermes', async importOriginal => {
  const actual = await importOriginal<Record<string, unknown>>()

  return { ...actual, renameSession: vi.fn() }
})
vi.mock('@/i18n', () => {
  const t = {
    assistant: {
      thread: {
        today: (time: string) => `Today at ${time}`,
        yesterday: (time: string) => `Yesterday at ${time}`
      }
    },
    common: {
      cancel: 'Cancel',
      close: 'Close',
      confirm: 'Confirm',
      delete: 'Delete',
      done: 'Done',
      loading: 'Loading…',
      save: 'Save'
    },
    errors: { genericFailure: 'Something went wrong' },
    sidebar: {
      messageCount: (count: number) => `${count} messages`,
      projects: {
        home: 'Home',
        menuAppearance: 'Appearance',
        moveFailed: 'Could not move session',
        moveNoProjects: 'No other projects',
        movedTo: (name: string) => `Moved to ${name}`,
        moveToProject: 'Move to project',
        noColor: 'No color'
      },
      row: {
        ageMin: 'm',
        ageNow: 'now',
        archive: 'Archive',
        backgroundRunning: 'Running in background',
        branchFrom: 'Branch from here',
        copyId: 'Copy ID',
        copyIdFailed: 'Failed to copy ID',
        deleteDesc: (title: string) => `Delete ${title}?`,
        deleteTitle: 'Delete session?',
        deleted: 'Session deleted',
        deleting: 'Deleting…',
        export: 'Export',
        finishedUnread: 'Finished',
        handoffOrigin: (platform: string) => `Started on ${platform}`,
        hideTabBar: 'Hide tab bar',
        markRead: 'Mark as read',
        messageCount: (count: number) => `${count} messages`,
        needsInput: 'Needs input',
        pin: 'Pin',
        rename: 'Rename',
        renamed: 'Renamed',
        renameFailed: 'Rename failed',
        renameTitle: 'Rename session',
        sessionActions: 'Session actions',
        sessionRunning: 'Running',
        todoProgress: 'Tasks completed',
        unpin: 'Unpin',
        untitledPlaceholder: 'Untitled',
        waitingForAnswer: 'Waiting for answer'
      },
      toolCallCount: (count: number) => `${count} tool calls`
    },
    zones: { closeAll: 'Close all', closeOthers: 'Close others', closeToRight: 'Close to the right' }
  }

  return { useI18n: () => ({ t }) }
})
vi.mock('@/lib/haptics', async importOriginal => {
  const actual = await importOriginal<Record<string, unknown>>()

  return { ...actual, triggerHaptic: vi.fn() }
})
vi.mock('@/lib/profile-color', async importOriginal => {
  const actual = await importOriginal<Record<string, unknown>>()

  return { ...actual, PROFILE_SWATCHES: [] }
})
vi.mock('@/lib/session-export', async importOriginal => {
  const actual = await importOriginal<Record<string, unknown>>()

  return { ...actual, exportSession: vi.fn() }
})
vi.mock('@/lib/session-source', async importOriginal => {
  const actual = await importOriginal<Record<string, unknown>>()

  return {
    ...actual,
    handoffOriginSource: (state?: string, platform?: string) => (state && platform ? platform : null),
    sessionSourceLabel: (source: string) => source
  }
})
vi.mock('@/lib/time', async importOriginal => {
  const actual = await importOriginal<Record<string, unknown>>()

  return { ...actual, coarseElapsed: () => ({ unit: 'minute' as const, value: 5 }) }
})

// importOriginal + named overrides (never a wholesale replacement): both the
// row and the menu read more of these stores than this file names, and an
// unlisted export silently becomes `undefined` and crashes a nanostores
// `computed()` downstream.
vi.mock('@/lib/chat-runtime', async importOriginal => {
  const actual = await importOriginal<typeof ChatRuntime>()

  return { ...actual, sessionTitle: (s: SessionInfo) => (s as unknown as { title: string }).title }
})
vi.mock('@/store/gateway', async importOriginal => {
  const actual = await importOriginal<typeof GatewayStore>()

  return { ...actual, activeGateway: vi.fn(() => null) }
})
vi.mock('@/store/notifications', async importOriginal => {
  const actual = await importOriginal<Record<string, unknown>>()

  return { ...actual, notify: vi.fn(), notifyError: vi.fn() }
})
vi.mock('@/store/projects', async importOriginal => {
  const actual = await importOriginal<typeof ProjectsStore>()

  return { ...actual, $projectTree: atom<unknown[]>([]) }
})
vi.mock('@/store/session', async importOriginal => {
  const actual = await importOriginal<typeof SessionStore>()

  return { ...actual, $unreadFinishedSessionIds: atom<string[]>([]) }
})
vi.mock('@/store/session-color', async importOriginal => {
  const actual = await importOriginal<typeof SessionColorStore>()

  return { ...actual, $sessionColorOverrides: atom<Record<string, string>>({}) }
})
vi.mock('@/store/session-states', async importOriginal => {
  const actual = await importOriginal<typeof SessionStatesStore>()

  return {
    ...actual,
    $attentionSessionIds: atom<string[]>([]),
    $sessionTiles: atom<unknown[]>([]),
    $stalledSessionIds: atom<string[]>([]),
    openSessionTile: vi.fn()
  }
})
vi.mock('@/store/windows', async importOriginal => {
  const actual = await importOriginal<typeof WindowsStore>()

  return {
    ...actual,
    canOpenSessionInTerminal: () => false,
    canOpenSessionWindow: () => false,
    openSessionInNewWindow: vi.fn(),
    openSessionInTerminal: vi.fn()
  }
})

function makeSession(overrides: Partial<SessionInfo> & { title: string }): SessionInfo {
  return {
    handoff_platform: null,
    handoff_state: null,
    id: 's1',
    last_active: 0,
    profile: 'default',
    started_at: 0,
    ...overrides
  } as unknown as SessionInfo
}

function renderRow(overrides: { onResume?: () => void } = {}) {
  const onResume = overrides.onResume ?? vi.fn()

  render(
    <SidebarSessionRow
      isPinned={false}
      isSelected={false}
      onArchive={vi.fn()}
      onDelete={vi.fn()}
      onPin={vi.fn()}
      onResume={onResume}
      onToggleUnread={vi.fn()}
      session={makeSession({ title: 'Old title' })}
      unread={false}
    />
  )

  return { onResume, title: screen.getByText('Old title').closest('button')! }
}

const editor = () => screen.queryByRole('textbox', { name: 'Rename session' }) as HTMLInputElement | null

describe('SidebarSessionRow inline rename (double-click the title)', () => {
  it('commits through the shared rename path on Enter and closes the editor', async () => {
    vi.mocked(renameSession).mockResolvedValueOnce({ title: 'New title' } as never)
    const { title } = renderRow()

    fireEvent.doubleClick(title)

    const input = editor()!
    expect(input.value).toBe('Old title')

    fireEvent.change(input, { target: { value: '  New title  ' } })
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' })
    })

    expect(renameSession).toHaveBeenCalledWith('s1', 'New title', 'default')
    expect(editor()).toBeNull()
  })

  it('cancels on Escape without writing', () => {
    const { title } = renderRow()

    fireEvent.doubleClick(title)
    fireEvent.change(editor()!, { target: { value: 'Discarded' } })
    fireEvent.keyDown(editor()!, { key: 'Escape' })

    expect(renameSession).not.toHaveBeenCalled()
    expect(editor()).toBeNull()
    expect(screen.getByText('Old title')).toBeTruthy()
  })

  it('treats an unchanged title as a no-op (no write)', async () => {
    const { title } = renderRow()

    fireEvent.doubleClick(title)
    await act(async () => {
      fireEvent.keyDown(editor()!, { key: 'Enter' })
    })

    expect(renameSession).not.toHaveBeenCalled()
    expect(editor()).toBeNull()
  })

  it('keeps the editor and the typed text when the write fails', async () => {
    vi.mocked(renameSession).mockRejectedValueOnce(new Error('boom'))
    const { title } = renderRow()

    fireEvent.doubleClick(title)
    fireEvent.change(editor()!, { target: { value: 'Keep me' } })
    await act(async () => {
      fireEvent.keyDown(editor()!, { key: 'Enter' })
    })

    expect(renameSession).toHaveBeenCalledTimes(1)
    expect(editor()?.value).toBe('Keep me')
  })

  it("does not open on a modifier double-click (those clicks are the row's pin/tab/window gestures)", () => {
    const { title } = renderRow()

    fireEvent.doubleClick(title, { shiftKey: true })
    fireEvent.doubleClick(title, { metaKey: true })

    expect(editor()).toBeNull()
  })

  it("keeps the editor's own presses and clicks out of the row (no resume, no drag)", () => {
    const { onResume, title } = renderRow()

    fireEvent.doubleClick(title)
    const input = editor()!

    fireEvent.pointerDown(input, { button: 0, isPrimary: true, pointerId: 1, pointerType: 'mouse' })
    fireEvent.click(input)
    fireEvent.doubleClick(input)

    expect(onResume).not.toHaveBeenCalled()
    expect(startSessionDrag).not.toHaveBeenCalled()
    expect(editor()).not.toBeNull()
  })
})
