import { useEffect, useState, useMemo } from 'react'
import { usePlayersStore } from '@/store/playersStore'
import { Button, Badge, Modal, Input, Select, Tag } from '@/components/ui'
import { Pencil, Trash2, Plus, Search, Upload, Download } from 'lucide-react'
import { playerDisplayName } from '@/types/domain'
import type { Player, Gender } from '@/types/domain'

// ─── Constantes ───────────────────────────────────────────────────────────────

const LEVEL_OPTIONS = [
  { value: 'P12', label: 'P12 — Débutant' },
  { value: 'P11', label: 'P11' },
  { value: 'P10', label: 'P10' },
  { value: 'D9',  label: 'D9' },
  { value: 'D8',  label: 'D8' },
  { value: 'D7',  label: 'D7 — Intermédiaire' },
  { value: 'R6',  label: 'R6' },
  { value: 'R5',  label: 'R5' },
  { value: 'R4',  label: 'R4' },
  { value: 'R3',  label: 'R3 — Confirmé' },
  { value: 'R2',  label: 'R2' },
  { value: 'R1',  label: 'R1' },
  { value: 'N3',  label: 'N3 — National' },
  { value: 'N2',  label: 'N2' },
  { value: 'N1',  label: 'N1' },
]

const GENDER_OPTIONS = [
  { value: 'M', label: 'Homme' },
  { value: 'F', label: 'Femme' },
]

// ─── Formulaire joueur ────────────────────────────────────────────────────────

type PlayerFormData = Omit<Player, 'id' | 'createdAt'>

const EMPTY_PLAYER: PlayerFormData = {
  firstName: '',
  lastName: '',
  pseudo: '',
  gender: 'M',
  level: 'D7',
  status: 'active',
}

function PlayerForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: PlayerFormData
  onSave: (data: PlayerFormData) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState<PlayerFormData>(initial)
  const set = <K extends keyof PlayerFormData>(key: K, val: PlayerFormData[K]) =>
    setForm((f) => ({ ...f, [key]: val }))

  const valid = form.firstName.trim().length > 0 && form.lastName.trim().length > 0

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <Input label="Prénom *" placeholder="Alice" value={form.firstName}
          onChange={(e) => set('firstName', e.target.value)} />
        <Input label="Nom *" placeholder="Dupont" value={form.lastName}
          onChange={(e) => set('lastName', e.target.value)} />
      </div>
      <Input label="Pseudo (optionnel)" placeholder="Ace" value={form.pseudo ?? ''}
        onChange={(e) => set('pseudo', e.target.value)} />
      <div className="grid grid-cols-2 gap-4">
        <Select label="Genre" value={form.gender}
          onChange={(e) => set('gender', e.target.value as Gender)}
          options={GENDER_OPTIONS} />
        <Select label="Classement" value={form.level}
          onChange={(e) => set('level', e.target.value)}
          options={LEVEL_OPTIONS} />
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <Button variant="secondary" size="sm" onClick={onCancel}>Annuler</Button>
        <Button size="sm" disabled={!valid} onClick={() => onSave(form)}>Enregistrer</Button>
      </div>
    </div>
  )
}

// ─── Import CSV ───────────────────────────────────────────────────────────────

function parseCSV(text: string): Partial<PlayerFormData>[] {
  const lines = text.trim().split('\n').filter(Boolean)
  // Ignore la ligne d'en-tête si elle contient 'prenom' ou 'firstName'
  const start = lines[0]?.toLowerCase().includes('prenom') ||
                lines[0]?.toLowerCase().includes('firstname') ? 1 : 0
  return lines.slice(start).map((line) => {
    const [firstName, lastName, gender, level, pseudo] = line.split(/[,;]/).map((s) => s.trim())
    return { firstName, lastName, gender: gender as Gender, level: level ?? 'D7', pseudo }
  }).filter((p) => p.firstName && p.lastName)
}

// ─── Page principale ──────────────────────────────────────────────────────────

export function PlayersPage() {
  const { players, isLoading, fetchPlayers, createPlayer, updatePlayer, deletePlayer } = usePlayersStore()
  const [search, setSearch] = useState('')
  const [filterGender, setFilterGender] = useState<'all' | 'M' | 'F'>('all')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [editPlayer, setEditPlayer] = useState<Player | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Player | null>(null)
  const [csvPreview, setCsvPreview] = useState<Partial<PlayerFormData>[] | null>(null)
  const [csvImporting, setCsvImporting] = useState(false)

  useEffect(() => { void fetchPlayers() }, [fetchPlayers])

  // Filtrage
  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return players.filter((p) => {
      if (filterGender !== 'all' && p.gender !== filterGender) return false
      if (filterStatus !== 'all' && p.status !== filterStatus) return false
      if (q) {
        const name = playerDisplayName(p).toLowerCase()
        if (!name.includes(q) && !p.level.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [players, search, filterGender, filterStatus])

  const openCreate = () => { setEditPlayer(null); setModalOpen(true) }
  const openEdit = (p: Player) => { setEditPlayer(p); setModalOpen(true) }

  const handleSave = async (data: PlayerFormData) => {
    if (editPlayer) {
      await updatePlayer(editPlayer.id, data)
    } else {
      await createPlayer(data)
    }
    setModalOpen(false)
  }

  const handleDelete = async () => {
    if (deleteTarget) { await deletePlayer(deleteTarget.id); setDeleteTarget(null) }
  }

  // Export CSV
  const handleExport = () => {
    const header = 'Prenom,Nom,Genre,Classement,Pseudo'
    const rows = filtered.map((p) =>
      [p.firstName, p.lastName, p.gender, p.level, p.pseudo ?? ''].join(',')
    )
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = `joueurs-${new Date().toISOString().slice(0, 10)}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  // Import CSV
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      setCsvPreview(parseCSV(text))
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleConfirmImport = async () => {
    if (!csvPreview) return
    setCsvImporting(true)
    for (const p of csvPreview) {
      if (p.firstName && p.lastName) {
        await createPlayer({ ...EMPTY_PLAYER, ...p } as PlayerFormData)
      }
    }
    setCsvImporting(false)
    setCsvPreview(null)
  }

  return (
    <div className="p-8 max-w-5xl">
      {/* En-tête */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-sans font-black uppercase text-[42px] tracking-[-0.03em] text-ink leading-none">
            Joueurs
          </h1>
          <p className="font-sans text-[14px] text-ink-3 mt-2">
            {players.length} joueur{players.length !== 1 ? 's' : ''} enregistré{players.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex gap-2 mt-1 shrink-0">
          {/* Import CSV */}
          <label className="cursor-pointer">
            <input type="file" accept=".csv,.txt" className="sr-only" onChange={handleImportFile} />
            <span className="flex items-center gap-2 px-4 py-2 min-h-[44px] bg-bg border-2 border-line
              font-sans font-black uppercase text-[12px] tracking-[0.05em] text-ink
              hover:bg-bg-strong transition-colors cursor-pointer">
              <Upload size={13} />
              Import CSV
            </span>
          </label>
          <Button variant="secondary" size="sm" onClick={handleExport}>
            <Download size={13} className="mr-1 inline" />
            Export
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus size={13} className="mr-1 inline" />
            Nouveau
          </Button>
        </div>
      </div>

      {/* Filtres */}
      <div className="flex gap-3 mb-6 items-center flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
          <input
            type="text"
            placeholder="Rechercher…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-bg border border-line hover:border-blue focus:border-blue
              pl-9 pr-3 py-2 w-full min-h-[44px] font-sans text-[14px] text-ink
              outline-none transition-colors placeholder:text-ink-3"
          />
        </div>
        {(['all', 'M', 'F'] as const).map((g) => (
          <button
            key={g}
            onClick={() => setFilterGender(g)}
            className={`px-4 py-2 min-h-[44px] font-sans font-bold uppercase text-[12px] tracking-[0.05em]
              border-2 transition-colors
              ${filterGender === g ? 'bg-ink text-green-fluo border-ink' : 'bg-bg text-ink border-line hover:bg-bg-strong'}`}
          >
            {g === 'all' ? 'Tous' : g === 'M' ? 'Hommes' : 'Femmes'}
          </button>
        ))}
        {(['all', 'active', 'inactive'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-4 py-2 min-h-[44px] font-sans font-bold uppercase text-[12px] tracking-[0.05em]
              border-2 transition-colors
              ${filterStatus === s ? 'bg-ink text-green-fluo border-ink' : 'bg-bg text-ink border-line hover:bg-bg-strong'}`}
          >
            {s === 'all' ? 'Tous statuts' : s === 'active' ? 'Actifs' : 'Inactifs'}
          </button>
        ))}
      </div>

      {/* Tableau */}
      {isLoading ? (
        <p className="font-sans text-[14px] text-ink-3">Chargement…</p>
      ) : (
        <div className="border-2 border-line">
          {/* Header */}
          <div className="grid grid-cols-[1fr_80px_100px_100px_80px] bg-ink px-4 py-3">
            {['Joueur', 'Genre', 'Classement', 'Statut', ''].map((h) => (
              <span key={h} className="text-[11px] font-mono font-bold uppercase tracking-[0.08em] text-green-fluo">
                {h}
              </span>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <p className="font-sans text-[14px] text-ink-3">
                {search || filterGender !== 'all' || filterStatus !== 'all'
                  ? 'Aucun joueur ne correspond aux filtres'
                  : 'Aucun joueur — cliquez sur « Nouveau » pour commencer'}
              </p>
            </div>
          ) : (
            filtered.map((player, i) => (
              <div
                key={player.id}
                className={`grid grid-cols-[1fr_80px_100px_100px_80px] items-center px-4 py-3
                  border-b border-line-soft transition-colors hover:bg-bg-strong group
                  ${i % 2 === 0 ? 'bg-bg' : 'bg-bg-alt'}`}
              >
                <div>
                  <p className="font-sans font-bold text-[14px] text-ink">
                    {playerDisplayName(player)}
                  </p>
                  {player.pseudo && (player.firstName || player.lastName) && (
                    <p className="font-sans text-[12px] text-ink-3">
                      {player.firstName} {player.lastName}
                    </p>
                  )}
                </div>
                <div>
                  <Tag label={player.gender} color={player.gender === 'M' ? 'H' : 'F'} />
                </div>
                <div>
                  <span className="text-[11px] font-mono font-bold text-ink">{player.level}</span>
                </div>
                <div>
                  <Badge variant={player.status === 'active' ? 'success' : 'default'}>
                    {player.status === 'active' ? 'Actif' : 'Inactif'}
                  </Badge>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 justify-end">
                  <button
                    onClick={() => openEdit(player)}
                    className="p-2 text-ink-3 hover:text-blue transition-colors min-h-[36px] min-w-[36px]
                      flex items-center justify-center"
                    aria-label="Modifier"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(player)}
                    className="p-2 text-ink-3 hover:text-red transition-colors min-h-[36px] min-w-[36px]
                      flex items-center justify-center"
                    aria-label="Supprimer"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Modal création / édition */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editPlayer ? 'Modifier le joueur' : 'Nouveau joueur'}
        size="md"
      >
        <PlayerForm
          initial={editPlayer
            ? { firstName: editPlayer.firstName, lastName: editPlayer.lastName,
                pseudo: editPlayer.pseudo, gender: editPlayer.gender,
                level: editPlayer.level, status: editPlayer.status }
            : EMPTY_PLAYER}
          onSave={handleSave}
          onCancel={() => setModalOpen(false)}
        />
      </Modal>

      {/* Modal confirmation suppression */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Supprimer le joueur"
        size="sm"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setDeleteTarget(null)}>Annuler</Button>
            <Button variant="danger" size="sm" onClick={handleDelete}>Supprimer</Button>
          </>
        }
      >
        <p className="font-sans text-[14px] text-ink">
          Supprimer <strong>{deleteTarget ? playerDisplayName(deleteTarget) : ''}</strong> ?
          Cette action est irréversible.
        </p>
      </Modal>

      {/* Modal prévisualisation import CSV */}
      <Modal
        isOpen={!!csvPreview}
        onClose={() => setCsvPreview(null)}
        title="Import CSV — vérification"
        size="lg"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setCsvPreview(null)}>Annuler</Button>
            <Button size="sm" disabled={csvImporting} onClick={handleConfirmImport}>
              {csvImporting ? 'Import en cours…' : `Importer ${csvPreview?.length ?? 0} joueur(s)`}
            </Button>
          </>
        }
      >
        <div className="max-h-64 overflow-y-auto scrollbar-light">
          <div className="grid grid-cols-[1fr_60px_80px] bg-ink px-3 py-2 sticky top-0">
            {['Nom', 'Genre', 'Niveau'].map((h) => (
              <span key={h} className="text-[11px] font-mono font-bold uppercase tracking-[0.08em] text-green-fluo">{h}</span>
            ))}
          </div>
          {csvPreview?.map((p, i) => (
            <div key={i} className={`grid grid-cols-[1fr_60px_80px] px-3 py-2 border-b border-line-soft
              ${i % 2 === 0 ? 'bg-bg' : 'bg-bg-alt'}`}>
              <span className="font-sans text-[14px] text-ink">{p.firstName} {p.lastName}</span>
              <span className="text-[11px] font-mono text-ink">{p.gender}</span>
              <span className="text-[11px] font-mono text-ink">{p.level}</span>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  )
}
