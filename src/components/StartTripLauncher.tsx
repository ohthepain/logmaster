import { useNavigate } from '@tanstack/react-router'
import { Loader2, Sailboat } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { toast } from 'sonner'
import { AddBoatModal } from './AddBoatModal'
import { Modal } from './Modal'
import { SkipperSelect } from './SkipperSelect'
import { TripCrewPickerModal, TripCrewSection } from './TripCrewPickerModal'
import type { CrewMember } from '../domain/crew'
import type { Boat } from '../domain/boat'
import { defaultBoatPhoto } from '../domain/boat'
import { useSession } from '../lib/auth-client'
import { fetchBoats } from '../lib/boats-api'
import { fetchCrew } from '../lib/crew-api'
import {
  buildSkipperOptions,
  resolveTripPersonOption,
  userTripPersonKey,
} from '../lib/trip-people'
import { tripDisplayName, resolveDefaultBoatIdForNewTrip } from '../lib/trip-display'
import { useAppOptionsStore } from '../stores/app-options'
import { useLogbookStore, triggerLogbookSyncRetry } from '../stores/logbook'

type StartTripLauncherProps = {
  open: boolean
  onClose: () => void
}

export function StartTripLauncher({ open, onClose }: StartTripLauncherProps) {
  const store = useLogbookStore()
  const setLastTripBoatId = useAppOptionsStore((state) => state.setLastTripBoatId)
  const session = useSession()
  const navigate = useNavigate()
  const [addBoatOpen, setAddBoatOpen] = useState(false)
  const [startForm, setStartForm] = useState({
    boatName: '',
    registration: '',
    skipperKey: '',
  })
  const [tripCrewMemberIds, setTripCrewMemberIds] = useState<string[]>([])
  const [crewMembers, setCrewMembers] = useState<CrewMember[]>([])
  const [crewLoading, setCrewLoading] = useState(false)
  const [crewPickerOpen, setCrewPickerOpen] = useState(false)
  const [creatingTrip, setCreatingTrip] = useState(false)
  const [selectedBoatId, setSelectedBoatId] = useState('')
  const [boats, setBoats] = useState<Boat[]>([])
  const [boatsLoading, setBoatsLoading] = useState(false)
  const startFormInitializedRef = useRef(false)

  const user = session.data?.user
  const skipperOptions = useMemo(
    () =>
      user
        ? buildSkipperOptions({
            userId: user.id,
            userName: user.name,
            userImage: user.image,
            crewMembers,
          })
        : [],
    [user, crewMembers],
  )

  const applyDefaultBoatSelection = (items: Boat[]) => {
    const defaultBoatId = resolveDefaultBoatIdForNewTrip(
      useLogbookStore.getState().trips,
      items,
      useAppOptionsStore.getState().lastTripBoatId,
    )
    if (defaultBoatId) {
      const boat = items.find((item) => item.id === defaultBoatId)
      setSelectedBoatId(defaultBoatId)
      setStartForm((current) => ({
        ...current,
        boatName: boat?.name ?? current.boatName,
      }))
      return
    }
    setSelectedBoatId('')
    setStartForm((current) => ({ ...current, boatName: '' }))
  }

  useEffect(() => {
    if (!user) {
      setBoats([])
      return
    }

    let cancelled = false
    setBoatsLoading(true)
    void fetchBoats()
      .then((items) => {
        if (cancelled) return
        setBoats(items)
        triggerLogbookSyncRetry()
      })
      .catch(() => toast.error('Could not load your boats'))
      .finally(() => {
        if (!cancelled) setBoatsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [user])

  useEffect(() => {
    if (!open || !user) {
      startFormInitializedRef.current = false
      return
    }

    if (!startFormInitializedRef.current && boats.length > 0) {
      startFormInitializedRef.current = true
      applyDefaultBoatSelection(boats)
    }
  }, [open, user, boats])

  useEffect(() => {
    if (!open || !store.booted || boats.length === 0 || selectedBoatId) return
    applyDefaultBoatSelection(boats)
  }, [open, store.booted, store.trips, boats, selectedBoatId])

  useEffect(() => {
    if (!user) {
      setCrewMembers([])
      return
    }
    setCrewLoading(true)
    void fetchCrew()
      .then((payload) => {
        setCrewMembers(payload.members)
        triggerLogbookSyncRetry()
      })
      .catch(() => toast.error('Could not load your crew'))
      .finally(() => setCrewLoading(false))
  }, [user])

  useEffect(() => {
    if (!open || !user) return
    setStartForm((current) => ({
      ...current,
      skipperKey: userTripPersonKey(user.id),
    }))
    setTripCrewMemberIds([])
  }, [open, user?.id])

  useEffect(() => {
    if (!open || user) return
    onClose()
    void navigate({ to: '/sign-in', search: { redirect: '/trips?startTrip=1' } })
  }, [open, user, navigate, onClose])

  const defaultSkipperKey = user ? userTripPersonKey(user.id) : ''
  const effectiveSkipperKey = startForm.skipperKey || defaultSkipperKey

  const handleClose = () => {
    onClose()
    setStartForm({ boatName: '', registration: '', skipperKey: '' })
    setTripCrewMemberIds([])
    setSelectedBoatId('')
  }

  const handleStartTrip = async (event: FormEvent) => {
    event.preventDefault()
    if (!user) {
      toast.error('Sign in to start a trip')
      handleClose()
      void navigate({ to: '/sign-in', search: { redirect: '/trips?startTrip=1' } })
      return
    }
    if (!selectedBoatId || !startForm.boatName.trim()) {
      toast.error('Select a boat')
      return
    }
    const selectedBoat = boats.find((boat) => boat.id === selectedBoatId)
    const boatPhoto = selectedBoat ? defaultBoatPhoto(selectedBoat.photos) : null
    const skipper = resolveTripPersonOption(effectiveSkipperKey, skipperOptions)
    setCreatingTrip(true)
    try {
      const trip = await store.startTrip({
        boatName: startForm.boatName,
        boatId: selectedBoatId,
        boatPhotoUrl: boatPhoto?.imageUrl ?? null,
        registration: startForm.registration,
        skipper: skipper?.name,
        skipperKey: effectiveSkipperKey || null,
        crewMemberIds: tripCrewMemberIds,
      })
      if (trip) {
        setLastTripBoatId(selectedBoatId)
        toast.success(`${tripDisplayName(trip)} created`)
        handleClose()
        void navigate({ to: '/trips/$tripId', params: { tripId: trip.id } })
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create trip')
    } finally {
      setCreatingTrip(false)
    }
  }

  if (!open || !user) return null

  return (
    <>
      <Modal title="Create Trip" onClose={handleClose}>
        <form className="space-y-4" onSubmit={(e) => void handleStartTrip(e)}>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-[var(--sea-ink)]">
              Boat
            </span>
            <select
              value={selectedBoatId}
              onChange={(e) => {
                const value = e.target.value
                if (value === '__add__') {
                  setAddBoatOpen(true)
                  return
                }
                setSelectedBoatId(value)
                const boat = boats.find((item) => item.id === value)
                setStartForm((current) => ({
                  ...current,
                  boatName: boat?.name ?? '',
                }))
              }}
              className="w-full rounded-2xl border border-[var(--line)] bg-[var(--chip-bg)] px-4 py-3 text-[var(--sea-ink)] outline-none focus:ring-2 focus:ring-[var(--sea-ink)]/20"
            >
              <option value="">
                {boatsLoading ? 'Loading boats…' : 'Select boat…'}
              </option>
              {boats.map((boat) => (
                <option key={boat.id} value={boat.id}>
                  {boat.name}
                </option>
              ))}
              <option value="__add__">Add boat…</option>
            </select>
          </label>

          <div className="block">
            <span className="mb-1.5 block text-sm font-medium text-[var(--sea-ink)]">
              Skipper
            </span>
            <SkipperSelect
              value={effectiveSkipperKey}
              options={skipperOptions}
              onChange={(skipperKey) =>
                setStartForm((current) => ({
                  ...current,
                  skipperKey,
                }))
              }
            />
          </div>

          <TripCrewSection
            crewMembers={crewMembers}
            selectedIds={tripCrewMemberIds}
            onAddClick={() => setCrewPickerOpen(true)}
          />
          {crewLoading && (
            <p className="m-0 text-xs text-[var(--sea-ink-soft)]">
              Refreshing crew list…
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={creatingTrip}
              className="inline-flex items-center gap-2 rounded-full bg-[var(--btn-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--btn-text)] disabled:opacity-60"
            >
              {creatingTrip ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sailboat className="size-4" />
              )}
              {creatingTrip ? 'Creating trip…' : 'Create trip'}
            </button>
            <button
              type="button"
              onClick={handleClose}
              disabled={creatingTrip}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--sea-ink)] disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>

      <TripCrewPickerModal
        open={crewPickerOpen}
        crewMembers={crewMembers}
        selectedIds={tripCrewMemberIds}
        onClose={() => setCrewPickerOpen(false)}
        onChange={setTripCrewMemberIds}
      />

      <AddBoatModal
        open={addBoatOpen}
        onClose={() => setAddBoatOpen(false)}
        onCreated={(boat) => {
          setBoats((current) => [...current, boat])
          setSelectedBoatId(boat.id)
          setStartForm((current) => ({
            ...current,
            boatName: boat.name,
          }))
        }}
      />
    </>
  )
}
