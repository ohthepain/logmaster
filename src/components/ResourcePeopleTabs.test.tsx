// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { ResourceMembersTab } from './ResourceMembersTab'
import { ResourceContactsTab } from './ResourceContactsTab'
import type { ResourceMember } from '../domain/member-invite'

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
  Link: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}))
vi.mock('../lib/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key, language: 'en' }),
}))
vi.mock('./MessagesButton', () => ({
  MessagesButton: () => <a href="/messages">Chat</a>,
}))
vi.mock('./NotificationBellToggle', () => ({
  NotificationBellToggle: () => <button>Notifications</button>,
  ResourceAddButton: ({
    label,
    onClick,
  }: {
    label: string
    onClick: () => void
  }) => <button onClick={onClick}>{label}</button>,
  ResourceRefreshButton: ({ onRefresh }: { onRefresh: () => void }) => (
    <button onClick={onRefresh}>refresh</button>
  ),
  ResourceSectionHeader: () => <div />,
}))
afterEach(cleanup)

const members: ResourceMember[] = [
  {
    id: 'owner',
    userId: 'owner',
    role: 'OWNER',
    isOwner: true,
    createdAt: '',
    updatedAt: '',
    user: {
      id: 'owner',
      name: 'Boat Owner',
      email: 'owner@example.com',
      image: null,
    },
  },
  {
    id: 'crew',
    userId: 'crew',
    role: 'MEMBER',
    createdAt: '',
    updatedAt: '',
    user: {
      id: 'crew',
      name: 'Crew Member',
      email: 'crew@example.com',
      image: null,
    },
  },
]
const memberProps = () => ({
  members,
  pendingInvites: [],
  onInvite: vi.fn(),
  onRoleChange: vi.fn(),
  onRemove: vi.fn(),
  onCancelInvite: vi.fn(),
  onRefresh: vi.fn(),
})

it('keeps member management behind edit mode and never makes the owner removable', () => {
  const props = memberProps()
  render(<ResourceMembersTab compact {...props} />)
  expect(screen.queryByRole('combobox')).toBeNull()
  expect(screen.queryByRole('button', { name: 'remove' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'inviteLink' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'invite' }))
  fireEvent.click(screen.getByRole('button', { name: 'refresh' }))
  expect(props.onInvite).toHaveBeenCalledOnce()
  expect(props.onRefresh).toHaveBeenCalledOnce()
  fireEvent.click(screen.getByRole('button', { name: 'edit' }))
  const rows = screen.getAllByRole('listitem')
  expect(within(rows[0]).queryByRole('combobox')).toBeNull()
  expect(within(rows[0]).queryByRole('button', { name: 'remove' })).toBeNull()
  fireEvent.change(within(rows[1]).getByRole('combobox'), {
    target: { value: 'ADMIN' },
  })
  expect(props.onRoleChange).toHaveBeenCalledWith(members[1], 'ADMIN')
  fireEvent.click(within(rows[1]).getByRole('button', { name: 'remove' }))
  expect(props.onRemove).toHaveBeenCalledWith(members[1])
  fireEvent.click(screen.getByRole('button', { name: 'done' }))
  expect(screen.queryByRole('combobox')).toBeNull()
})

it('does not expose edit or invite actions to viewers, including after permission loss', () => {
  const props = memberProps()
  const { rerender } = render(<ResourceMembersTab compact {...props} />)
  fireEvent.click(screen.getByRole('button', { name: 'edit' }))
  rerender(<ResourceMembersTab compact {...props} canManageMembers={false} />)
  expect(screen.queryByRole('button', { name: 'done' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'invite' })).toBeNull()
  expect(screen.queryByRole('combobox')).toBeNull()
  expect(screen.queryByRole('button', { name: 'remove' })).toBeNull()
})

it('keeps organisation member management available in its existing layout', () => {
  render(<ResourceMembersTab {...memberProps()} onCreateLink={vi.fn()} />)
  expect(screen.getByRole('combobox')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'inviteLink' })).toBeTruthy()
})

it('keeps contact navigation available and gates deletion behind edit mode and permission', () => {
  const contact = {
    id: 'contact',
    displayName: 'Harbour Office',
    email: 'harbour@example.com',
    phone: null,
    whatsapp: null,
    notes: null,
    grants: [],
    userId: null,
    createdAt: '',
    updatedAt: '',
  }
  const onDelete = vi.fn()
  const props = {
    compact: true,
    contacts: [contact],
    canManage: true,
    onDelete,
    onAdd: vi.fn(),
    getContactLink: () => ({ to: '/contacts/contact', params: {} }),
  }
  const { rerender } = render(<ResourceContactsTab {...props} />)
  expect(
    screen.getByRole('link', { name: /Harbour Office/ }).getAttribute('href'),
  ).toBe('/contacts/contact')
  expect(screen.queryByRole('button', { name: 'delete' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'edit' }))
  fireEvent.click(screen.getByRole('button', { name: 'delete' }))
  expect(onDelete).toHaveBeenCalledWith(contact)
  rerender(<ResourceContactsTab {...props} canManage={false} />)
  expect(screen.queryByRole('button', { name: 'delete' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'addContact' })).toBeNull()
})
