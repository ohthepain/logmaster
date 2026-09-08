import { Link } from "@tanstack/react-router";
import { Plus, Wrench } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { toast } from "sonner";
import { AssetDocumentsSection } from "./AssetDocumentsSection";
import type { AssetOwnership, AssetWork, AssetWorkType, BoatAsset, DocumentPurpose } from "../domain/boat-assets";
import { ASSET_WORK_TYPE_LABELS } from "../domain/boat-assets";
import type { ResourceMember } from "../domain/member-invite";
import {
  createAssetWork,
  createBoatAsset,
  deleteBoatAsset,
  fetchAssetWork,
  fetchBoatAssets,
  updateBoatAsset,
  addAndLinkAssetDocumentLink,
  uploadAndLinkAssetDocument,
} from "../lib/boat-assets-api";
import { cn } from "../lib/cn";
import { ResourceSectionHeader } from "./NotificationBellToggle";
import { Modal } from "./Modal";

type BoatAssetsTabProps = {
  boatId: string;
  boatName: string;
  orgName: string | null;
  members: ResourceMember[];
};

type AssetModalState = { mode: "closed" } | { mode: "create" } | { mode: "edit"; asset: BoatAsset };

type WorkModalState = { mode: "closed" } | { mode: "create"; asset: BoatAsset };

const OWNERSHIP_OPTIONS: AssetOwnership[] = ["BOAT", "ORG", "USER", "EXTERNAL"];
const WORK_TYPES: AssetWorkType[] = ["install", "service", "repair", "other"];

export function BoatAssetsTab({ boatId, boatName, orgName, members }: BoatAssetsTabProps) {
  const [assets, setAssets] = useState<BoatAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assetModal, setAssetModal] = useState<AssetModalState>({ mode: "closed" });
  const [workModal, setWorkModal] = useState<WorkModalState>({ mode: "closed" });
  const [uploadingDocForAssetId, setUploadingDocForAssetId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [workByAsset, setWorkByAsset] = useState<Record<string, AssetWork[]>>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchBoatAssets(boatId);
      setAssets(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load assets");
    } finally {
      setLoading(false);
    }
  }, [boatId]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadWork = useCallback(
    async (assetId: string) => {
      try {
        const records = await fetchAssetWork(boatId, assetId);
        setWorkByAsset((current) => ({ ...current, [assetId]: records }));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to load work records");
      }
    },
    [boatId],
  );

  const refreshAssetDocuments = useCallback(
    async (assetId: string) => {
      const refreshed = await fetchBoatAssets(boatId);
      setAssets(refreshed);
      return refreshed.find((item) => item.id === assetId) ?? null;
    },
    [boatId],
  );

  const handleAssetDocumentUpload = useCallback(
    async (assetId: string, file: File, purpose: DocumentPurpose) => {
      setUploadingDocForAssetId(assetId);
      try {
        await uploadAndLinkAssetDocument(boatId, assetId, file, purpose);
        await refreshAssetDocuments(assetId);
        toast.success(purpose === "receipt" ? "Receipt uploaded" : "Document uploaded");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Upload failed");
      } finally {
        setUploadingDocForAssetId(null);
      }
    },
    [boatId, refreshAssetDocuments],
  );

  const handleAssetDocumentLink = useCallback(
    async (
      assetId: string,
      input: { url: string; title?: string; purpose?: DocumentPurpose },
    ) => {
      setUploadingDocForAssetId(assetId);
      try {
        await addAndLinkAssetDocumentLink(boatId, assetId, input);
        await refreshAssetDocuments(assetId);
        toast.success("Link added");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to add link");
        throw e;
      } finally {
        setUploadingDocForAssetId(null);
      }
    },
    [boatId, refreshAssetDocuments],
  );

  const toggleExpanded = (asset: BoatAsset) => {
    if (expandedId === asset.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(asset.id);
    if (!workByAsset[asset.id]) void loadWork(asset.id);
  };

  if (loading) {
    return <p className="text-sm text-[var(--sea-ink-soft)]">Loading assets…</p>;
  }

  if (error) {
    return (
      <div>
        <p className="text-sm text-red-600">{error}</p>
        <button type="button" onClick={() => void load()} className="mt-2 text-sm font-semibold text-[var(--sea-ink)]">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      <ResourceSectionHeader
        title="Assets"
        topic="BOAT_ASSETS"
        boatId={boatId}
        actions={
          <button
            type="button"
            onClick={() => setAssetModal({ mode: "create" })}
            className="inline-flex items-center gap-2 rounded-full bg-[var(--btn-bg)] px-4 py-2 text-sm font-semibold text-[var(--btn-text)]"
          >
            <Plus className="h-4 w-4" />
            Add asset
          </button>
        }
      />

      {assets.length === 0 ? (
        <p className="text-sm text-[var(--sea-ink-soft)]">No assets recorded yet.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {assets.map((asset) => {
            const expanded = expandedId === asset.id;
            const workRecords = workByAsset[asset.id] ?? [];
            return (
              <li key={asset.id} className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-4">
                <button
                  type="button"
                  onClick={() => toggleExpanded(asset)}
                  className="flex w-full items-start justify-between gap-3 text-left"
                >
                  <div>
                    <p className="m-0 font-semibold text-[var(--sea-ink)]">
                      <Link
                        to="/boats/$boatId/assets/$assetId"
                        params={{ boatId, assetId: asset.id }}
                        onClick={(event) => event.stopPropagation()}
                        className="hover:underline"
                      >
                        {asset.name}
                      </Link>
                    </p>
                    <div className="mt-1 flex flex-wrap gap-2">
                      <span className="rounded-full bg-[var(--chip-bg)] px-2 py-0.5 text-xs font-semibold text-[var(--sea-ink-soft)]">
                        {asset.ownerLabel}
                      </span>
                      {asset.installedAt ? (
                        <span className="text-xs text-[var(--sea-ink-soft)]">
                          Installed {new Date(asset.installedAt).toLocaleDateString()}
                        </span>
                      ) : null}
                    </div>
                    {asset.description ? (
                      <p className="mt-2 mb-0 text-sm text-[var(--sea-ink-soft)]">{asset.description}</p>
                    ) : null}
                  </div>
                  <span className="text-xs text-[var(--sea-ink-soft)]">{expanded ? "▲" : "▼"}</span>
                </button>

                {expanded ? (
                  <div className="mt-4 border-t border-[var(--line)] pt-4">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setAssetModal({ mode: "edit", asset })}
                        className="rounded-full border border-[var(--chip-line)] px-3 py-1.5 text-xs font-semibold"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setWorkModal({ mode: "create", asset })}
                        className="inline-flex items-center gap-1 rounded-full border border-[var(--chip-line)] px-3 py-1.5 text-xs font-semibold"
                      >
                        <Wrench className="h-3 w-3" />
                        Add work
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!confirm(`Remove ${asset.name}?`)) return;
                          void (async () => {
                            try {
                              await deleteBoatAsset(boatId, asset.id);
                              setAssets((current) => current.filter((item) => item.id !== asset.id));
                              toast.success("Asset removed");
                            } catch (e) {
                              toast.error(e instanceof Error ? e.message : "Failed to remove asset");
                            }
                          })();
                        }}
                        className="rounded-full border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600"
                      >
                        Delete
                      </button>
                    </div>

                    <div className="mt-4">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <p className="m-0 text-xs font-semibold uppercase tracking-wide text-[var(--sea-ink-soft)]">
                          Documents
                        </p>
                        <Link
                          to="/boats/$boatId/assets/$assetId"
                          params={{ boatId, assetId: asset.id }}
                          className="text-xs font-semibold text-[var(--sea-ink-soft)] underline"
                        >
                          View asset page
                        </Link>
                      </div>
                      <AssetDocumentsSection
                        boatId={boatId}
                        assetId={asset.id}
                        documents={asset.documents}
                        uploading={uploadingDocForAssetId === asset.id}
                        onUpload={(file, purpose) => void handleAssetDocumentUpload(asset.id, file, purpose)}
                        onAddLink={(input) => handleAssetDocumentLink(asset.id, input)}
                        onLinked={() => void refreshAssetDocuments(asset.id)}
                      />
                    </div>

                    {workRecords.length > 0 ? (
                      <div className="mt-4">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--sea-ink-soft)]">
                          Work records
                        </p>
                        <ul className="m-0 list-none p-0 text-sm">
                          {workRecords.map((work) => (
                            <li key={work.id} className="border-t border-[var(--line)] py-2">
                              <span className="font-semibold">{ASSET_WORK_TYPE_LABELS[work.type]}</span>
                              {work.performedAt ? (
                                <span className="ml-2 text-[var(--sea-ink-soft)]">
                                  {new Date(work.performedAt).toLocaleDateString()}
                                </span>
                              ) : null}
                              {work.description ? (
                                <p className="m-0 mt-1 text-[var(--sea-ink-soft)]">{work.description}</p>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {assetModal.mode !== "closed" ? (
        <AssetModal
          boatId={boatId}
          boatName={boatName}
          orgName={orgName}
          members={members}
          initial={assetModal.mode === "edit" ? assetModal.asset : undefined}
          busy={busy}
          onClose={() => setAssetModal({ mode: "closed" })}
          onSave={async (input) => {
            setBusy(true);
            try {
              if (assetModal.mode === "edit") {
                const updated = await updateBoatAsset(boatId, assetModal.asset.id, input);
                setAssets((current) => current.map((item) => (item.id === updated.id ? updated : item)));
                toast.success("Asset updated");
              } else {
                const created = await createBoatAsset(boatId, {
                  name: input.name!,
                  description: input.description,
                  ownership: input.ownership!,
                  ownedByUserId: input.ownedByUserId,
                  installedAt: input.installedAt,
                });
                setAssets((current) => [...current, created]);
                toast.success("Asset added");
              }
              setAssetModal({ mode: "closed" });
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Failed to save asset");
            } finally {
              setBusy(false);
            }
          }}
        />
      ) : null}

      {workModal.mode === "create" ? (
        <WorkModal
          busy={busy}
          assetName={workModal.asset.name}
          onClose={() => setWorkModal({ mode: "closed" })}
          onSave={async (input) => {
            setBusy(true);
            try {
              const work = await createAssetWork(boatId, workModal.asset.id, input);
              setWorkByAsset((current) => ({
                ...current,
                [workModal.asset.id]: [work, ...(current[workModal.asset.id] ?? [])],
              }));
              toast.success("Work record added");
              setWorkModal({ mode: "closed" });
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Failed to add work record");
            } finally {
              setBusy(false);
            }
          }}
        />
      ) : null}
    </div>
  );
}

function AssetModal({
  boatName,
  orgName,
  members,
  initial,
  busy,
  onClose,
  onSave,
}: {
  boatId: string;
  boatName: string;
  orgName: string | null;
  members: ResourceMember[];
  initial?: BoatAsset;
  busy: boolean;
  onClose: () => void;
  onSave: (input: {
    name?: string;
    description?: string | null;
    ownership?: AssetOwnership;
    ownedByUserId?: string | null;
    installedAt?: string | null;
  }) => Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [ownership, setOwnership] = useState<AssetOwnership>(initial?.ownership ?? "BOAT");
  const [ownedByUserId, setOwnedByUserId] = useState(initial?.ownedByUserId ?? initial?.onLoanFromUserId ?? "");
  const [installedAt, setInstalledAt] = useState(initial?.installedAt?.slice(0, 10) ?? "");

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void onSave({
      name: name.trim(),
      description: description.trim() || null,
      ownership,
      ownedByUserId: ownership === "USER" ? ownedByUserId || null : null,
      installedAt: installedAt ? `${installedAt}T12:00:00.000Z` : null,
    });
  };

  return (
    <Modal title={initial ? "Edit asset" : "Add asset"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="rounded-xl border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold">Description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="rounded-xl border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold">Ownership</span>
          <select
            value={ownership}
            onChange={(e) => setOwnership(e.target.value as AssetOwnership)}
            className="rounded-xl border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-2"
          >
            {OWNERSHIP_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option === "BOAT"
                  ? boatName
                  : option === "ORG"
                    ? (orgName ?? "Org")
                    : option === "USER"
                      ? "User"
                      : "External"}
              </option>
            ))}
          </select>
        </label>
        {ownership === "USER" ? (
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold">Owned by</span>
            <select
              value={ownedByUserId}
              onChange={(e) => setOwnedByUserId(e.target.value)}
              className="rounded-xl border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-2"
            >
              <option value="">Select member</option>
              {members.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.user.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold">Installed date</span>
          <input
            type="date"
            value={installedAt}
            onChange={(e) => setInstalledAt(e.target.value)}
            className="rounded-xl border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-2"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className={cn(
            "rounded-full bg-[var(--btn-bg)] px-4 py-2 text-sm font-semibold text-[var(--btn-text)]",
            busy && "opacity-60",
          )}
        >
          {busy ? "Saving…" : initial ? "Save changes" : "Add asset"}
        </button>
      </form>
    </Modal>
  );
}

function WorkModal({
  assetName,
  busy,
  onClose,
  onSave,
}: {
  assetName: string;
  busy: boolean;
  onClose: () => void;
  onSave: (input: {
    type: AssetWorkType;
    performedAt?: string | null;
    description?: string | null;
    costAmount?: number | null;
    costCurrency?: string | null;
  }) => Promise<void>;
}) {
  const [type, setType] = useState<AssetWorkType>("install");
  const [performedAt, setPerformedAt] = useState("");
  const [description, setDescription] = useState("");
  const [costAmount, setCostAmount] = useState("");
  const [costCurrency, setCostCurrency] = useState("EUR");

  return (
    <Modal title={`Work on ${assetName}`} onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void onSave({
            type,
            performedAt: performedAt ? `${performedAt}T12:00:00.000Z` : null,
            description: description.trim() || null,
            costAmount: costAmount ? Number.parseFloat(costAmount) : null,
            costCurrency: costAmount ? costCurrency : null,
          });
        }}
        className="flex flex-col gap-4"
      >
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold">Type</span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as AssetWorkType)}
            className="rounded-xl border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-2"
          >
            {WORK_TYPES.map((option) => (
              <option key={option} value={option}>
                {ASSET_WORK_TYPE_LABELS[option]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold">Date</span>
          <input
            type="date"
            value={performedAt}
            onChange={(e) => setPerformedAt(e.target.value)}
            className="rounded-xl border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold">Description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="rounded-xl border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-2"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold">Cost (optional)</span>
            <input
              type="number"
              step="0.01"
              value={costAmount}
              onChange={(e) => setCostAmount(e.target.value)}
              className="rounded-xl border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold">Currency</span>
            <input
              value={costCurrency}
              onChange={(e) => setCostCurrency(e.target.value)}
              className="rounded-xl border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-2"
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-[var(--btn-bg)] px-4 py-2 text-sm font-semibold text-[var(--btn-text)]"
        >
          {busy ? "Saving…" : "Add work record"}
        </button>
      </form>
    </Modal>
  );
}
