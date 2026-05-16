import { useEffect, useState, useMemo } from 'react'
import { usePlayersStore } from '@/store/playersStore'
import { Button, Modal, Input, Select, Tag } from '@/components/ui'
import { Pencil, Trash2, Plus, Search, Upload, Download, ChevronsUpDown, ChevronUp, ChevronDown } from 'lucide-react'
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

// Groupe de niveau pour l'affichage compact et les stats
function levelGroup(level: string): 'AV.' | 'INT.' | 'DÉB.' {
  if (['R3','R2','R1','N3','N2','N1'].includes(level)) return 'AV.'
  if (['D7','R6','R5','R4'].includes(level)) return 'INT.'
  return 'DÉB.'
}

// ─── Formulaire joueur ────────────────────────────────────────────────────────

type PlayerFormData = Omit<Player, 'id' | 'createdAt' | 'tournamentCount'>

const EMPTY_PLAYER: PlayerFormData = {
  firstName: '',
  lastName: '',
  pseudo: '',
  gender: 'M',
  level: 'D7',
  club: '',
  elo: undefined,
  playerNumber: undefined,
  status: 'active',
}

function PlayerForm({
  initial,
  existingClubs,
  onSave,
  onCancel,
}: {
  initial: PlayerFormData
  existingClubs: string[]
  onSave: (data: PlayerFormData) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState<PlayerFormData>(initial)
  const set = <K extends keyof PlayerFormData>(key: K, val: PlayerFormData[K]) =>
    setForm((f) => ({ ...f, [key]: val }))

  const valid = form.firstName.trim().length > 0 && form.lastName.trim().length > 0

  return (
    <div className="flex flex-col gap-4">
      {/* Informations club */}
      <div className="border-b-2 border-line-soft pb-4 mb-1">
        <p className="text-[11px] font-mono font-bold uppercase tracking-[0.08em] text-ink-3 mb-3">Club</p>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-mono font-bold uppercase tracking-[0.08em] text-ink-3">Nom du club</label>
            <input
              list="clubs-list"
              placeholder="BC Versailles…"
              value={form.club ?? ''}
              onChange={(e) => set('club', e.target.value)}
              className="bg-bg border-2 border-line px-3 py-2 font-sans text-[14px] text-ink min-h-[44px] focus:border-blue outline-none"
            />
            <datalist id="clubs-list">
              {existingClubs.map((c) => <option key={c} value={c} />)}
            </datalist>
          </div>
          <Input
            label="N° dossard (optionnel)"
            placeholder="07"
            type="number"
            value={form.playerNumber !== undefined ? String(form.playerNumber) : ''}
            onChange={(e) => set('playerNumber', e.target.value ? Number(e.target.value) : undefined)}
          />
        </div>
      </div>

      {/* Identité */}
      <div className="grid grid-cols-2 gap-4">
        <Input label="Prénom *" placeholder="Alice" value={form.firstName}
          onChange={(e) => set('firstName', e.target.value)} />
        <Input label="Nom *" placeholder="DUPONT" value={form.lastName}
          onChange={(e) => set('lastName', e.target.value)} />
      </div>
      <Input label="Pseudo (optionnel)" placeholder="Ace" value={form.pseudo ?? ''}
        onChange={(e) => set('pseudo', e.target.value)} />

      {/* Caractéristiques */}
      <div className="grid grid-cols-3 gap-4">
        <Select label="Genre" value={form.gender}
          onChange={(e) => set('gender', e.target.value as Gender)}
          options={GENDER_OPTIONS} />
        <Select label="Classement" value={form.level}
          onChange={(e) => set('level', e.target.value)}
          options={LEVEL_OPTIONS} />
        <Input
          label="ELO (optionnel)"
          placeholder="1000"
          type="number"
          value={form.elo !== undefined ? String(form.elo) : ''}
          onChange={(e) => set('elo', e.target.value ? Number(e.target.value) : undefined)}
        />
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
  // Ignore la ligne d'en-tête si présente
  const hasHeader = /prenom|firstname|nom|name|genre|gender/i.test(lines[0] ?? '')
  const start = hasHeader ? 1 : 0
  return lines.slice(start).map((line) => {
    const cols = line.split(/[,;]/).map((s) => s.trim().replace(/^"|"$/g, ''))
    const [firstName, lastName, gender, level, pseudo, club, elo, playerNumber] = cols
    // Normalise 'H'/'h' → 'M' pour les fichiers issus de logiciels français
    const g = gender?.toUpperCase()
    const normalizedGender: Gender = g === 'H' ? 'M' : g === 'F' ? 'F' : 'M'
    return {
      firstName,
      lastName,
      gender: normalizedGender,
      level: level || 'D7',
      pseudo:       pseudo       || undefined,
      club:         club         || undefined,
      elo:          elo          ? (isNaN(Number(elo))          ? undefined : Number(elo))          : undefined,
      playerNumber: playerNumber ? (isNaN(Number(playerNumber)) ? undefined : Number(playerNumber)) : undefined,
    }
  }).filter((p) => p.firstName && p.lastName)
}

// ─── Bloc statistique ─────────────────────────────────────────────────────────

function StatBlock({ label, value }: { label: string; value: number | string }) {
  return (
    <div
      className="flex flex-col flex-1 items-start border-r-2 border-line last:border-r-0"
      style={{ padding: '16px 24px' }}
    >
      <span
        className="font-black text-ink leading-none tabular-nums"
        style={{ fontFamily: 'Inter, system-ui, sans-serif', fontSize: '42px', letterSpacing: '-0.03em' }}
      >
        {value}
      </span>
      <span
        className="font-mono font-bold uppercase text-ink-3"
        style={{ fontSize: '10px', letterSpacing: '0.08em', marginTop: '4px' }}
      >
        {label}
      </span>
    </div>
  )
}

// ─── Page principale ──────────────────────────────────────────────────────────

type SortKey = 'playerNumber' | 'lastName' | 'firstName' | 'pseudo' | 'gender' | 'level' | 'club' | 'tournamentCount' | 'elo'

const LEVEL_ORDER: Record<string, number> = { 'Avancé': 0, 'Intermédiaire': 1, 'Débutant': 2 }

export function PlayersPage() {
  const { players, isLoading, fetchPlayers, createPlayer, updatePlayer, deletePlayer } = usePlayersStore()
  const [search, setSearch] = useState('')
  const [filterGender, setFilterGender] = useState<'all' | 'M' | 'F'>('all')
  const [filterLevel, setFilterLevel] = useState<'all' | 'AV.' | 'INT.' | 'DÉB.'>('all')
  const [filterClub, setFilterClub] = useState<string>('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [editPlayer, setEditPlayer] = useState<Player | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Player | null>(null)
  const [csvPreview, setCsvPreview] = useState<Partial<PlayerFormData>[] | null>(null)
  const [csvImporting, setCsvImporting] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  useEffect(() => { void fetchPlayers() }, [fetchPlayers])

  // Clubs distincts
  const clubs = useMemo(() => {
    const set = new Set(players.map((p) => p.club).filter(Boolean) as string[])
    return Array.from(set).sort()
  }, [players])

  // Statistiques globales
  const stats = useMemo(() => ({
    total: players.length,
    hommes: players.filter((p) => p.gender === 'M').length,
    femmes: players.filter((p) => p.gender === 'F').length,
    avances: players.filter((p) => levelGroup(p.level) === 'AV.').length,
    inter: players.filter((p) => levelGroup(p.level) === 'INT.').length,
    deb: players.filter((p) => levelGroup(p.level) === 'DÉB.').length,
    clubs: clubs.length,
  }), [players, clubs])

  // Filtrage
  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return players.filter((p) => {
      if (filterGender !== 'all' && p.gender !== filterGender) return false
      if (filterLevel !== 'all' && levelGroup(p.level) !== filterLevel) return false
      if (filterClub !== 'all' && p.club !== filterClub) return false
      if (q) {
        const name = `${p.lastName} ${p.firstName} ${p.pseudo ?? ''} ${p.club ?? ''}`.toLowerCase()
        if (!name.includes(q) && !p.level.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [players, search, filterGender, filterLevel, filterClub])

  // Tri
  const sortedFiltered = useMemo(() => {
    if (!sortKey) return filtered
    return [...filtered].sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'playerNumber': cmp = (a.playerNumber ?? 9999) - (b.playerNumber ?? 9999); break
        case 'lastName':     cmp = a.lastName.localeCompare(b.lastName, 'fr'); break
        case 'firstName':    cmp = a.firstName.localeCompare(b.firstName, 'fr'); break
        case 'pseudo':       cmp = (a.pseudo ?? '').localeCompare(b.pseudo ?? '', 'fr'); break
        case 'gender':       cmp = a.gender.localeCompare(b.gender); break
        case 'level':        cmp = (LEVEL_ORDER[a.level] ?? 9) - (LEVEL_ORDER[b.level] ?? 9); break
        case 'club':         cmp = (a.club ?? '').localeCompare(b.club ?? '', 'fr'); break
        case 'tournamentCount': cmp = (a.tournamentCount ?? 0) - (b.tournamentCount ?? 0); break
        case 'elo':          cmp = (a.elo ?? 0) - (b.elo ?? 0); break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filtered, sortKey, sortDir])

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

  const handleExport = () => {
    const header = 'Prenom,Nom,Genre,Classement,Pseudo,Club,ELO,N_Dossard'
    const rows = filtered.map((p) =>
      [p.firstName, p.lastName, p.gender, p.level, p.pseudo ?? '', p.club ?? '', p.elo ?? '', p.playerNumber ?? ''].join(',')
    )
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = `joueurs-${new Date().toISOString().slice(0, 10)}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => { setCsvPreview(parseCSV(ev.target?.result as string)) }
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
    <div className="flex flex-col h-full">
      {/* Bandeau en-tête */}
      <div className="border-b-2 border-line bg-bg shrink-0">
        <div className="px-8 pt-8 pb-5 flex items-start justify-between gap-4">
          <div>
            <h1 className="font-sans font-black uppercase text-[42px] tracking-[-0.03em] text-ink leading-none">
              Joueurs
            </h1>
            <p className="font-sans text-[14px] text-ink-3 mt-2">
              {players.length} joueur{players.length !== 1 ? 's' : ''} au total
            </p>
          </div>
          <div className="flex gap-2 shrink-0 mt-1">
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
              Joueur
            </Button>
          </div>
        </div>

        {/* Barre de stats — pleine largeur sans padding */}
        <div className="flex border-t-2 border-line bg-bg-strong">
          <StatBlock label="Total" value={stats.total} />
          <StatBlock label="Hommes" value={stats.hommes} />
          <StatBlock label="Femmes" value={stats.femmes} />
          <StatBlock label="Avancés" value={stats.avances} />
          <StatBlock label="Inter." value={stats.inter} />
          <StatBlock label="Déb." value={stats.deb} />
          <StatBlock label="Clubs" value={stats.clubs} />
        </div>
      </div>

      {/* Filtres */}
      <div className="flex gap-2 px-8 py-4 items-center flex-wrap shrink-0 border-b border-line-soft bg-bg">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
          <input
            type="text"
            placeholder="Rechercher un joueur…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-bg border-2 border-line hover:border-blue focus:border-blue
              pl-9 pr-3 py-2 w-full min-h-[44px] font-sans text-[14px] text-ink
              outline-none transition-colors placeholder:text-ink-3"
          />
        </div>

        {/* Filtre genre */}
        <div className="flex border-2 border-line">
          {([['all', 'Genre'], ['M', 'Hommes'], ['F', 'Femmes']] as const).map(([v, label]) => (
            <button
              key={v}
              onClick={() => setFilterGender(v)}
              className={`px-3 py-2 min-h-[44px] font-mono font-bold uppercase text-[11px] tracking-[0.06em] transition-colors border-r border-line last:border-r-0
                ${filterGender === v ? 'bg-ink text-green-fluo' : 'bg-bg text-ink hover:bg-bg-strong'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Filtre niveau */}
        <div className="flex border-2 border-line">
          {([['all', 'Niveau'], ['AV.', 'Avancé'], ['INT.', 'Inter.'], ['DÉB.', 'Déb.']] as const).map(([v, label]) => (
            <button
              key={v}
              onClick={() => setFilterLevel(v)}
              className={`px-3 py-2 min-h-[44px] font-mono font-bold uppercase text-[11px] tracking-[0.06em] transition-colors border-r border-line last:border-r-0
                ${filterLevel === v ? 'bg-ink text-green-fluo' : 'bg-bg text-ink hover:bg-bg-strong'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Filtre club */}
        {clubs.length > 0 && (
          <div className="relative border-2 border-line min-h-[44px]">
            <select
              value={filterClub}
              onChange={(e) => setFilterClub(e.target.value)}
              className="appearance-none w-full h-full min-h-[44px] px-3 pr-8 bg-bg font-mono font-bold text-[11px] uppercase tracking-[0.06em] text-ink cursor-pointer outline-none"
            >
              <option value="all">Tous les clubs</option>
              {clubs.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-ink-3 text-[10px]">▼</span>
          </div>
        )}
      </div>

      {/* Tableau */}
      <div className="flex-1 overflow-y-auto scrollbar-light px-8 py-6">
        {isLoading ? (
          <p className="font-sans text-[14px] text-ink-3">Chargement…</p>
        ) : (
          <div className="border-2 border-line">
            {/* En-têtes avec tri */}
            <div className="grid grid-cols-[48px_140px_120px_120px_44px_120px_1fr_60px_80px_80px] bg-ink">
              {([
                ['N° Doss.',  'playerNumber'],
                ['Nom',     'lastName'],
                ['Prénom',  'firstName'],
                ['Pseudo',  'pseudo'],
                ['G.',      'gender'],
                ['Niveau',  'level'],
                ['Club',    'club'],
                ['Trn.',    'tournamentCount'],
                ['ELO',     'elo'],
                ['',        null],
              ] as [string, SortKey | null][]).map(([label, key]) => (
                key ? (
                  <button
                    key={label}
                    onClick={() => handleSort(key)}
                    className="flex items-center gap-1 px-4 py-3 text-left text-[11px] font-mono font-bold uppercase tracking-[0.08em]
                      text-green-fluo hover:text-white transition-colors group"
                  >
                    {label}
                    <span className="text-green-fluo/60 group-hover:text-white/60">
                      {sortKey === key
                        ? sortDir === 'asc'
                          ? <ChevronUp size={11} />
                          : <ChevronDown size={11} />
                        : <ChevronsUpDown size={11} />}
                    </span>
                  </button>
                ) : (
                  <span key={label} className="px-4 py-3" />
                )
              ))}
            </div>

            {filtered.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <p className="font-sans text-[14px] text-ink-3">
                  {search || filterGender !== 'all' || filterLevel !== 'all' || filterClub !== 'all'
                    ? 'Aucun joueur ne correspond aux filtres'
                    : 'Aucun joueur — cliquez sur « + Joueur » pour commencer'}
                </p>
              </div>
            ) : (
              sortedFiltered.map((player, i) => (
                <div
                  key={player.id}
                  className={`grid grid-cols-[48px_140px_120px_120px_44px_120px_1fr_60px_80px_80px] items-center px-4 py-3
                    border-b border-line-soft transition-colors hover:bg-bg-strong group
                    ${i % 2 === 0 ? 'bg-bg' : 'bg-bg-alt'}`}
                >
                  {/* # dossard */}
                  <span className="font-mono font-bold text-[13px] text-ink-3">
                    {player.playerNumber !== undefined && player.playerNumber !== null
                      ? String(player.playerNumber).padStart(2, '0')
                      : '—'}
                  </span>
                  {/* Nom */}
                  <span className="font-sans font-black text-[14px] text-ink uppercase tracking-[-0.01em]">
                    {player.lastName.toUpperCase()}
                  </span>
                  {/* Prénom */}
                  <span className="font-sans text-[14px] text-ink-2">
                    {player.firstName}
                  </span>
                  {/* Pseudo */}
                  <span className="font-mono text-[12px] text-ink-3 truncate">
                    {player.pseudo ? `"${player.pseudo}"` : <span className="text-ink-3/40">—</span>}
                  </span>
                  {/* Genre */}
                  <Tag label={player.gender === 'M' ? 'H' : 'F'} color={player.gender === 'M' ? 'H' : 'F'} className="w-7 h-7 justify-center px-0 py-0" />
                  {/* Niveau */}
                  <span className="text-[11px] font-mono font-bold text-ink-2 uppercase">
                    {levelGroup(player.level)}
                    <span className="ml-1 text-ink-3 font-normal normal-case">{player.level}</span>
                  </span>
                  {/* Club */}
                  <span className="font-sans text-[13px] text-ink-2 truncate">
                    {player.club || <span className="text-ink-3">—</span>}
                  </span>
                  {/* Tournois joués */}
                  <span className="font-mono font-bold text-[14px] text-ink-3 text-center">
                    {player.tournamentCount ?? 0}
                  </span>
                  {/* ELO */}
                  <span className={`font-mono font-bold text-[15px] text-right
                    ${(player.elo ?? 0) >= 1200 ? 'text-blue' : (player.elo ?? 0) >= 1000 ? 'text-ink' : 'text-ink-3'}`}>
                    {player.elo != null ? player.elo : <span className="text-ink-3">—</span>}
                  </span>
                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 justify-end">
                    <button
                      onClick={() => openEdit(player)}
                      className="p-2 text-ink-3 hover:text-blue transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(player)}
                      className="p-2 text-ink-3 hover:text-red transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Modal création / édition */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editPlayer ? 'Modifier le joueur' : 'Nouveau joueur'}
        size="lg"
      >
        <PlayerForm
          existingClubs={clubs}
          initial={editPlayer
            ? {
                firstName: editPlayer.firstName,
                lastName: editPlayer.lastName,
                pseudo: editPlayer.pseudo,
                gender: editPlayer.gender,
                level: editPlayer.level,
                club: editPlayer.club,
                elo: editPlayer.elo,
                playerNumber: editPlayer.playerNumber,
                status: editPlayer.status,
              }
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
            <Button variant="danger" size="sm" onClick={() => void handleDelete()}>Supprimer</Button>
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
            <Button size="sm" disabled={csvImporting} onClick={() => void handleConfirmImport()}>
              {csvImporting ? 'Import en cours…' : `Importer ${csvPreview?.length ?? 0} joueur(s)`}
            </Button>
          </>
        }
      >
        <div className="max-h-64 overflow-y-auto scrollbar-light">
          <div className="grid grid-cols-[1fr_50px_80px_100px_60px_70px] bg-ink px-3 py-2 sticky top-0">
            {['Nom', 'G.', 'Niveau', 'Club', 'ELO', 'Dossard'].map((h) => (
              <span key={h} className="text-[11px] font-mono font-bold uppercase tracking-[0.08em] text-green-fluo">{h}</span>
            ))}
          </div>
          {csvPreview?.map((p, i) => (
            <div key={i} className={`grid grid-cols-[1fr_50px_80px_100px_60px_70px] px-3 py-2 border-b border-line-soft
              ${i % 2 === 0 ? 'bg-bg' : 'bg-bg-alt'}`}>
              <span className="font-sans text-[14px] text-ink">{p.firstName} {p.lastName}</span>
              <span className="text-[11px] font-mono text-ink">{p.gender}</span>
              <span className="text-[11px] font-mono text-ink">{p.level}</span>
              <span className="text-[11px] font-mono text-ink">{p.club ?? '—'}</span>
              <span className="text-[11px] font-mono text-ink">{p.elo ?? '—'}</span>
              <span className="text-[11px] font-mono text-ink">{p.playerNumber ?? '—'}</span>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  )
}
