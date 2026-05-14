import { useState } from 'react'
import { Button, Input, Select, Table, Badge, Tag, Modal } from '@/components/ui'
import type { Column } from '@/components/ui'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-14">
      <h2 className="font-sans font-black uppercase text-[13px] tracking-[0.08em] text-ink border-b-2 border-line pb-2 mb-6">
        {title}
      </h2>
      {children}
    </section>
  )
}

function Subsection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <p className="text-[11px] font-mono font-bold uppercase tracking-[0.08em] text-ink-3 mb-3">{title}</p>
      {children}
    </div>
  )
}

interface SamplePlayer {
  id: number
  name: string
  level: string
  gender: 'H' | 'F'
  status: 'active' | 'inactive'
  score: number
}

const samplePlayers: SamplePlayer[] = [
  { id: 1, name: 'Alice Dupont',  level: 'R3', gender: 'F', status: 'active',   score: 18 },
  { id: 2, name: 'Bob Martin',    level: 'D7', gender: 'H', status: 'inactive', score: 12 },
  { id: 3, name: 'Charlie Lee',   level: 'N2', gender: 'H', status: 'active',   score: 21 },
  { id: 4, name: 'Diana Morel',   level: 'R1', gender: 'F', status: 'active',   score: 15 },
]

const playerColumns: Column<SamplePlayer>[] = [
  { key: 'name', header: 'Joueur' },
  {
    key: 'level',
    header: 'Niveau',
    width: '80px',
    align: 'center',
    render: (r) => <Badge variant="info">{r.level}</Badge>,
  },
  {
    key: 'gender',
    header: 'Genre',
    width: '70px',
    align: 'center',
    render: (r) => <Tag label={r.gender} color={r.gender} />,
  },
  {
    key: 'status',
    header: 'Statut',
    width: '100px',
    render: (r) => (
      <Badge variant={r.status === 'active' ? 'success' : 'default'}>
        {r.status === 'active' ? 'Actif' : 'Inactif'}
      </Badge>
    ),
  },
  {
    key: 'score',
    header: 'Score',
    width: '80px',
    align: 'right',
    render: (r) => (
      <span className="font-mono font-bold text-[18px] text-green">{r.score}</span>
    ),
  },
]

export function DevUI() {
  const [modalOpen, setModalOpen] = useState(false)
  const [confirmModalOpen, setConfirmModalOpen] = useState(false)
  const [resetModalOpen, setResetModalOpen] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [tags, setTags] = useState(['Round Robin', 'Simple Hommes', 'BWF Standard'])

  return (
    <div className="p-8 max-w-5xl">
      {/* En-tête */}
      <div className="mb-10">
        <h1 className="font-sans font-black uppercase text-[42px] tracking-[-0.03em] text-ink leading-none">
          Dev UI
        </h1>
        <p className="font-sans text-[14px] text-ink-3 mt-2">
          ShuttleCup — Showcase du design system
        </p>
      </div>

      {/* Palette de couleurs */}
      <Section title="Palette de couleurs">
        <div className="flex flex-wrap gap-3">
          {[
            { name: 'bg',         bg: '#fafaf7', text: '#0a0a0a', border: true },
            { name: 'bg-alt',     bg: '#f1efe9', text: '#0a0a0a', border: true },
            { name: 'bg-strong',  bg: '#e6e3da', text: '#0a0a0a' },
            { name: 'ink',        bg: '#0a0a0a', text: '#ffffff' },
            { name: 'ink-2',      bg: '#4a4a4a', text: '#ffffff' },
            { name: 'ink-3',      bg: '#8a8a82', text: '#ffffff' },
            { name: 'line',       bg: '#1a1a1a', text: '#ffffff' },
            { name: 'line-soft',  bg: '#cfcdc4', text: '#0a0a0a' },
            { name: 'blue',       bg: '#0047FF', text: '#ffffff' },
            { name: 'green',      bg: '#00C24A', text: '#ffffff' },
            { name: 'green-fluo', bg: '#00FF66', text: '#0a0a0a' },
            { name: 'warn',       bg: '#D97500', text: '#ffffff' },
            { name: 'red',        bg: '#E60022', text: '#ffffff' },
          ].map((c) => (
            <div
              key={c.name}
              style={{ backgroundColor: c.bg, color: c.text }}
              className={`px-4 py-3 text-[11px] font-mono font-bold uppercase tracking-[0.08em] ${c.border ? 'border border-line-soft' : ''}`}
            >
              <div>{c.name}</div>
              <div className="opacity-50 text-[10px] mt-0.5">{c.bg}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* Typographie */}
      <Section title="Typographie">
          <div className="flex flex-col gap-4 bg-white border border-electric-blue/20 p-6">
          <p className="font-condensed font-extrabold uppercase text-5xl text-electric-blue tracking-widest leading-none">
            Barlow Condensed ExtraBold — TITRE PRINCIPAL
          </p>
          <p className="font-condensed font-bold uppercase text-3xl text-electric-blue tracking-wide">
            Barlow Condensed Bold — Sous-titre
          </p>
          <p className="font-condensed text-2xl text-black tracking-wide">
            Barlow Condensed Regular — Labels et noms de joueurs
          </p>
          <div className="w-full h-px bg-electric-blue/30 my-2" />
          <p className="font-sans text-base text-black">
            Inter Regular 16px — Texte de corps. Application de gestion de tournois de badminton pour clubs.
          </p>
          <p className="font-sans text-sm text-black/60">
            Inter Regular 14px — Texte secondaire et descriptions plus détaillées.
          </p>
          <p className="font-sans text-xs text-black/40 uppercase tracking-widest">
            Inter 12px Uppercase — Labels, métadonnées, catégories
          </p>
          <div className="flex gap-6 mt-2">
            <span className="font-condensed font-black text-5xl text-fluo-green">21</span>
            <span className="font-condensed font-black text-3xl text-black/40">18</span>
          </div>
          <p className="font-sans text-xs text-black/40">Scores : fluo-green (gagnant) / noir à 40% (perdant)</p>
        </div>
      </Section>

      {/* Boutons */}
      <Section title="Boutons">
        <Subsection title="Variantes">
          <div className="flex flex-wrap gap-4 items-center">
            <Button variant="primary">Action principale</Button>
            <Button variant="secondary">Secondaire</Button>
            <Button variant="danger">Danger / Supprimer</Button>
            <Button variant="ghost">Tertiaire</Button>
          </div>
        </Subsection>

        <Subsection title="Tailles">
          <div className="flex flex-wrap gap-4 items-center">
            <Button size="sm">Petit (36px)</Button>
            <Button size="md">Moyen (44px)</Button>
            <Button size="lg">Grand (56px)</Button>
          </div>
        </Subsection>

        <Subsection title="États désactivés">
          <div className="flex flex-wrap gap-4 items-center">
            <Button disabled>Désactivé</Button>
            <Button variant="secondary" disabled>Désactivé secondaire</Button>
          </div>
        </Subsection>
      </Section>

      {/* Champs de saisie */}
      <Section title="Champs de saisie">
        <div className="grid grid-cols-2 gap-6 max-w-2xl">
          <Input
            label="Prénom du joueur"
            placeholder="Ex : Alice"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
          />
          <Input
            label="Avec erreur de validation"
            placeholder="Nom du tournoi"
            error="Ce champ est obligatoire"
          />
          <Input
            label="Champ désactivé"
            placeholder="Non modifiable"
            disabled
          />
          <Select
            label="Format de tournoi"
            options={[
              { value: 'round-robin', label: 'Poules (Round Robin)' },
              { value: 'knockout', label: 'Élimination directe' },
              { value: 'pool+knockout', label: 'Poules + Élimination' },
            ]}
          />
        </div>
      </Section>

      {/* Badges */}
      <Section title="Badges">
        <div className="flex flex-wrap gap-3">
          <Badge variant="default">Par défaut</Badge>
          <Badge variant="success">Terminé</Badge>
          <Badge variant="active">En cours</Badge>
          <Badge variant="warning">Attention</Badge>
          <Badge variant="danger">Forfait</Badge>
          <Badge variant="info">R3</Badge>
        </div>
      </Section>

      {/* Tags catégories */}
      <Section title="Tags catégories">
        <Subsection title="Genres et disciplines">
          <div className="flex flex-wrap gap-3">
            <Tag label="H" color="H" />
            <Tag label="F" color="F" />
            <Tag label="SH" color="SH" />
            <Tag label="SD" color="SD" />
            <Tag label="DH" color="DH" />
            <Tag label="DD" color="DD" />
            <Tag label="DX" color="DX" />
          </div>
        </Subsection>

        <Subsection title="Supprimables">
          <div className="flex flex-wrap gap-3">
            {tags.map((tag) => (
              <Tag
                key={tag}
                label={tag}
                onRemove={() => setTags((prev) => prev.filter((t) => t !== tag))}
              />
            ))}
            {tags.length === 0 && (
              <button
                className="text-[12px] font-sans text-ink-3 hover:text-ink transition-colors"
                onClick={() => setTags(['Round Robin', 'Simple Hommes', 'BWF Standard'])}
              >
                Réinitialiser
              </button>
            )}
          </div>
        </Subsection>

        <Subsection title="Actif / inactif">
          <div className="flex flex-wrap gap-3">
            <Tag label="Poules" color="active" />
            <Tag label="Knockout" />
            <Tag label="Americano" />
            <Tag label="Swiss" color="active" />
          </div>
        </Subsection>
      </Section>

      {/* Tableau de données */}
      <Section title="Tableau de données">
        <Table<SamplePlayer>
          columns={playerColumns}
          data={samplePlayers}
          keyExtractor={(r) => r.id}
        />

        <div className="mt-6">
          <p className="text-[11px] font-mono font-bold uppercase tracking-[0.08em] text-ink-3 mb-3">Tableau vide</p>
          <Table<SamplePlayer>
            columns={playerColumns}
            data={[]}
            keyExtractor={(r) => r.id}
            emptyMessage="Aucun joueur inscrit à ce tournoi"
          />
        </div>
      </Section>

      {/* Modales */}
      <Section title="Modales">
        <div className="flex gap-4 flex-wrap">
          <Button onClick={() => setModalOpen(true)}>Ouvrir modale simple</Button>
          <Button variant="danger" onClick={() => setConfirmModalOpen(true)}>
            Modale de confirmation
          </Button>
        </div>

        <Modal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          title="Exemple de modale"
          size="md"
          footer={
            <>
              <Button variant="secondary" size="sm" onClick={() => setModalOpen(false)}>
                Annuler
              </Button>
              <Button size="sm" onClick={() => setModalOpen(false)}>
                Confirmer
              </Button>
            </>
          }
        >
          <p className="font-sans text-[14px] text-ink mb-4">
            Ceci est le contenu de la modale. Appuyez sur{' '}
            <kbd className="bg-bg-strong px-1.5 py-0.5 text-[11px] font-mono border border-line-soft">Échap</kbd>{' '}
            ou cliquez sur l'overlay pour fermer.
          </p>
          <Input label="Nom du joueur" placeholder="Saisir un nom…" />
        </Modal>

        <Modal
          isOpen={confirmModalOpen}
          onClose={() => setConfirmModalOpen(false)}
          title="À confirmer"
          size="sm"
          footer={
            <>
              <Button variant="secondary" size="sm" onClick={() => setConfirmModalOpen(false)}>
                Annuler
              </Button>
              <Button variant="danger" size="sm" onClick={() => setConfirmModalOpen(false)}>
                Supprimer
              </Button>
            </>
          }
        >
          <p className="font-sans text-[14px] text-ink">
            Cette action est irréversible. Voulez-vous vraiment supprimer cet élément ?
          </p>
        </Modal>
      </Section>

      {/* Géométrie — vérification aucun arrondi */}
      <Section title="Géométrie (zéro arrondi)">
        <div className="flex flex-wrap gap-4">
          <div className="bg-ink text-green-fluo px-6 py-3 font-sans font-black uppercase text-[13px] tracking-[0.05em]">
            Button primary
          </div>
          <div className="bg-bg border-2 border-line text-ink px-6 py-3 font-sans font-bold text-[13px]">
            Button secondary
          </div>
          <div className="bg-green-fluo text-ink px-6 py-3 font-sans font-black uppercase text-[13px]">
            Fill vert-fluo
          </div>
          <div className="bg-red text-white px-6 py-3 font-sans font-black uppercase text-[13px]">
            Danger
          </div>
          <div className="bg-blue text-white px-6 py-3 font-sans font-black uppercase text-[13px]">
            Équipe A (bleu)
          </div>
        </div>
        <p className="text-[11px] font-mono text-ink-3 mt-4">
          Aucun de ces éléments ne doit avoir de bords arrondis — vérifier visuellement.
        </p>
      </Section>

      {/* Outils dev */}
      <Section title="Outils de développement">
        <Subsection title="Base de données">
          <div className="flex items-center gap-4">
            <Button variant="danger" onClick={() => setResetModalOpen(true)}>
              Réinitialiser les données
            </Button>
            <span className="font-sans text-[13px] text-ink-3">
              Supprime tous les joueurs, tournois, matchs et scores. Les règles BWF sont conservées.
            </span>
          </div>
        </Subsection>

        <Modal
          isOpen={resetModalOpen}
          onClose={() => setResetModalOpen(false)}
          title="Réinitialiser la base de données"
          size="sm"
          footer={
            <>
              <Button variant="secondary" size="sm" onClick={() => setResetModalOpen(false)}>
                Annuler
              </Button>
              <Button variant="danger" size="sm" onClick={async () => {
                await window.db.clearAllData()
                setResetModalOpen(false)
                window.location.reload()
              }}>
                Tout supprimer
              </Button>
            </>
          }
        >
          <p className="font-sans text-[14px] text-ink">
            Cette action supprimera définitivement tous les joueurs, tournois, matchs et scores.
            Les règles de scoring prédéfinies seront conservées. Cette action est irréversible.
          </p>
        </Modal>
      </Section>
    </div>
  )
}
