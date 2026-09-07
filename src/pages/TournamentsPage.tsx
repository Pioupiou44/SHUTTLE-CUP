import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTournamentsStore } from '@/store/tournamentsStore'
import { Button, Badge, Modal } from '@/components/ui'
import { Plus, Trash2, ChevronRight, Archive, Upload } from 'lucide-react'
import type { Tournament } from '@/types/domain'

const STATUS_LABELS: Record<Tournament['status'], string> = {
  draft:     'Brouillon',
  active:    'En cours',
  completed: 'Terminé',
  archived:  'Archivé',
}

const STATUS_BADGE: Record<Tournament['status'], 'default' | 'active' | 'success' | 'info'> = {
  draft:     'default',
  active:    'active',
  completed: 'success',
  archived:  'info',
}

const FORMAT_SHORT: Record<string, string> = {
  'round-robin':        'Poules',
  'knockout':           'Élim. directe',
  'double-elimination': 'Double élim.',
  'pool+knockout':      'Poules + Élim.',
  'americano':          'Américano',
  'swiss':              'Suisse',
  'king-of-court':      'Roi du court',
}

export function TournamentsPage() {
  const navigate = useNavigate()
  const { tournaments, isLoading, fetchTournaments, deleteTournament, updateTournament } = useTournamentsStore()
  const [deleteTarget, setDeleteTarget] = useState<Tournament | null>(null)
  const [archiveTarget, setArchiveTarget] = useState<Tournament | null>(null)
  const [filter, setFilter] = useState<Tournament['status'] | 'all'>('all')
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { void fetchTournaments() }, [fetchTournaments])

  const filtered = filter === 'all'
    ? tournaments
    : tournaments.filter((t) => t.status === filter)

  const handleDelete = async () => {
    if (deleteTarget) { await deleteTournament(deleteTarget.id); setDeleteTarget(null) }
  }

  const handleArchive = async () => {
    if (archiveTarget) { await updateTournament(archiveTarget.id, { status: 'archived' }); setArchiveTarget(null) }
  }

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setImportError(null)
    setImporting(true)
    try {
      const text = await file.text()
      const snapshot: unknown = JSON.parse(text)
      const result = await window.db.importTournament(snapshot)
      await fetchTournaments()
      navigate(`/tournaments/${result.tournamentId}`)
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Fichier invalide')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="p-8 max-w-5xl">
      {/* En-tête */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-sans font-black uppercase text-page-title tracking-[-0.03em] text-ink leading-none">
            Tournois
          </h1>
          <p className="font-sans text-[14px] text-ink-3 mt-2">
            {tournaments.length} tournoi{tournaments.length !== 1 ? 's' : ''} au total
          </p>
        </div>
        <div className="flex gap-2 mt-1 shrink-0">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={(e) => { void handleImportFile(e) }}
          />
          <Button variant="secondary" className="shrink-0" disabled={importing} onClick={() => fileInputRef.current?.click()}>
            <Upload size={13} className="mr-1 inline" />
            {importing ? 'Import…' : 'Restaurer'}
          </Button>
          <Button className="shrink-0" onClick={() => navigate('/tournaments/new')}>
            <Plus size={13} className="mr-1 inline" />
            Nouveau tournoi
          </Button>
        </div>
      </div>
      {importError && (
        <div className="mb-4 px-4 py-3 border-2 border-warn bg-bg font-sans text-[13px] text-warn">
          Restauration impossible : {importError}
        </div>
      )}

      {/* Filtres statut */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {(['all', 'draft', 'active', 'completed', 'archived'] as const).map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-4 py-2 min-h-[44px] font-sans font-bold uppercase text-[12px] tracking-[0.05em]
              border-2 transition-colors
              ${filter === s ? 'bg-ink text-green-fluo border-ink' : 'bg-bg text-ink border-line hover:bg-bg-strong'}`}>
            {s === 'all' ? 'Tous' : STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {/* Liste */}
      {isLoading ? (
        <p className="font-sans text-[14px] text-ink-3">Chargement…</p>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center border-2 border-line-soft border-dashed">
          <p className="font-sans font-black uppercase text-[18px] text-ink-3 mb-2">Aucun tournoi</p>
          <p className="font-sans text-[14px] text-ink-3 mb-6">
            {filter !== 'all' ? 'Aucun tournoi dans cette catégorie' : 'Créez votre premier tournoi'}
          </p>
          {filter === 'all' && (
            <Button onClick={() => navigate('/tournaments/new')}>Créer un tournoi</Button>
          )}
        </div>
      ) : (
        <div className="flex flex-col border-2 border-line">
          {filtered.map((t, i) => (
            <div key={t.id}
              className={`flex items-center justify-between px-5 py-4
                border-b border-line-soft hover:bg-bg-strong transition-colors cursor-pointer group
                ${i % 2 === 0 ? 'bg-bg' : 'bg-bg-alt'}`}
              onClick={() => navigate(`/tournaments/${t.id}`)}
            >
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <p className="font-sans font-bold text-[15px] text-ink group-hover:text-blue transition-colors">
                    {t.name}
                  </p>
                  <Badge variant={STATUS_BADGE[t.status]}>{STATUS_LABELS[t.status]}</Badge>
                </div>
                <p className="font-sans text-[12px] text-ink-3">
                  {new Date(t.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                  {t.location ? ` · ${t.location}` : ''}
                  {' · '}
                  <span className="font-mono">{FORMAT_SHORT[t.format] ?? t.format}</span>
                  {' · '}
                  {t.courtCount} terrain{t.courtCount !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {t.status === 'completed' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setArchiveTarget(t) }}
                    className="p-2 text-ink-3 hover:text-ink transition-colors min-h-[44px] min-w-[44px]
                      flex items-center justify-center opacity-0 group-hover:opacity-100"
                    aria-label="Archiver"
                    title="Archiver le tournoi"
                  >
                    <Archive size={14} />
                  </button>
                )}
                {t.status === 'draft' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget(t) }}
                    className="p-2 text-ink-3 hover:text-red transition-colors min-h-[44px] min-w-[44px]
                      flex items-center justify-center opacity-0 group-hover:opacity-100"
                    aria-label="Supprimer"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
                <ChevronRight size={16} className="text-ink-3 group-hover:text-blue transition-colors" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirmation suppression */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Supprimer le tournoi"
        size="sm"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setDeleteTarget(null)}>Annuler</Button>
            <Button variant="danger" size="sm" onClick={handleDelete}>Supprimer</Button>
          </>
        }
      >
        <p className="font-sans text-[14px] text-ink">
          Supprimer <strong>{deleteTarget?.name}</strong> ? Cette action est irréversible.
        </p>
      </Modal>

      {/* Confirmation archivage */}
      <Modal
        isOpen={!!archiveTarget}
        onClose={() => setArchiveTarget(null)}
        title="Archiver le tournoi"
        size="sm"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setArchiveTarget(null)}>Annuler</Button>
            <Button size="sm" onClick={handleArchive}>Archiver</Button>
          </>
        }
      >
        <p className="font-sans text-[14px] text-ink">
          Archiver <strong>{archiveTarget?.name}</strong> ? Le tournoi sera conservé en lecture seule.
        </p>
      </Modal>
    </div>
  )
}
