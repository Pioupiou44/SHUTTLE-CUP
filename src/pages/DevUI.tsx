import { useState } from 'react'
import { Button, Input, Select, Table, Badge, Tag, Modal } from '@/components/ui'
import type { Column } from '@/components/ui'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-14">
      <h2 className="font-condensed font-bold uppercase text-2xl text-electric-blue border-b-2 border-electric-blue pb-2 mb-6 tracking-widest">
        {title}
      </h2>
      {children}
    </section>
  )
}

function Subsection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <p className="font-sans text-xs text-light-grey/40 uppercase tracking-widest mb-3">{title}</p>
      {children}
    </div>
  )
}

interface SamplePlayer {
  id: number
  name: string
  level: string
  gender: string
  status: 'active' | 'inactive'
  score: number
}

const samplePlayers: SamplePlayer[] = [
  { id: 1, name: 'Alice Dupont', level: 'R3', gender: 'F', status: 'active', score: 18 },
  { id: 2, name: 'Bob Martin', level: 'D7', gender: 'M', status: 'inactive', score: 12 },
  { id: 3, name: 'Charlie Lee', level: 'N2', gender: 'M', status: 'active', score: 21 },
  { id: 4, name: 'Diana Morel', level: 'R1', gender: 'F', status: 'active', score: 15 },
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
  { key: 'gender', header: 'Genre', width: '70px', align: 'center' },
  {
    key: 'status',
    header: 'Statut',
    width: '100px',
    render: (r) => (
      <Badge variant={r.status === 'active' ? 'success' : 'danger'}>
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
      <span className="font-condensed font-bold text-fluo-green text-lg">{r.score}</span>
    ),
  },
]

export function DevUI() {
  const [modalOpen, setModalOpen] = useState(false)
  const [confirmModalOpen, setConfirmModalOpen] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [tags, setTags] = useState(['Round Robin', 'Simple Hommes', 'BWF Standard'])

  return (
    <div className="p-8 max-w-5xl">
      {/* En-tête */}
      <div className="mb-10">
        <h1 className="font-condensed font-bold uppercase text-5xl text-white tracking-widest leading-none">
          Dev UI
        </h1>
        <p className="font-sans text-light-grey/50 text-sm mt-2">
          ShuttleDesk — Showcase des composants Phase 1
        </p>
      </div>

      {/* Palette de couleurs */}
      <Section title="Palette de couleurs">
        <div className="flex flex-wrap gap-3">
          {[
            { name: 'electric-blue', bg: '#0047FF', text: '#FFFFFF' },
            { name: 'fluo-green', bg: '#39FF14', text: '#000000' },
            { name: 'dark-navy', bg: '#000A1F', text: '#FFFFFF', border: true },
            { name: 'mid-grey', bg: '#1A1A2E', text: '#FFFFFF' },
            { name: 'light-grey', bg: '#F0F0F0', text: '#000000' },
            { name: 'red-alert', bg: '#FF1744', text: '#FFFFFF' },
            { name: 'black', bg: '#000000', text: '#FFFFFF', border: true },
            { name: 'white', bg: '#FFFFFF', text: '#000000', border: true },
          ].map((c) => (
            <div
              key={c.name}
              style={{ backgroundColor: c.bg, color: c.text }}
              className={`px-4 py-3 font-condensed text-sm uppercase tracking-wide ${c.border ? 'border border-white/20' : ''}`}
            >
              <div className="font-bold">{c.name}</div>
              <div className="opacity-60 text-xs">{c.bg}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* Typographie */}
      <Section title="Typographie">
        <div className="flex flex-col gap-4 bg-mid-grey p-6">
          <p className="font-condensed font-bold uppercase text-5xl text-white tracking-widest leading-none">
            Barlow Condensed ExtraBold — TITRE PRINCIPAL
          </p>
          <p className="font-condensed font-bold uppercase text-3xl text-electric-blue tracking-wide">
            Barlow Condensed Bold — Sous-titre
          </p>
          <p className="font-condensed text-2xl text-light-grey tracking-wide">
            Barlow Condensed Regular — Labels et noms de joueurs
          </p>
          <div className="w-full h-px bg-electric-blue/30 my-2" />
          <p className="font-sans text-base text-light-grey">
            Inter Regular 16px — Texte de corps. Application de gestion de tournois de badminton pour clubs.
          </p>
          <p className="font-sans text-sm text-light-grey/60">
            Inter Regular 14px — Texte secondaire et descriptions plus détaillées.
          </p>
          <p className="font-sans text-xs text-light-grey/40 uppercase tracking-widest">
            Inter 12px Uppercase — Labels, métadonnées, catégories
          </p>
          <div className="flex gap-6 mt-2">
            <span className="font-condensed font-bold text-5xl text-fluo-green">21</span>
            <span className="font-condensed font-bold text-3xl text-white/40">18</span>
          </div>
          <p className="font-sans text-xs text-light-grey/40">Scores : fluo-green (gagnant) / blanc à 40% (perdant)</p>
        </div>
      </Section>

      {/* Boutons */}
      <Section title="Boutons">
        <Subsection title="Variantes">
          <div className="flex flex-wrap gap-4 items-center">
            <Button variant="primary">Action principale</Button>
            <Button variant="secondary">Secondaire</Button>
            <Button variant="danger">Danger / Supprimer</Button>
            <Button variant="ghost">Fantôme</Button>
          </div>
        </Subsection>

        <Subsection title="Tailles">
          <div className="flex flex-wrap gap-4 items-center">
            <Button size="sm">Petit</Button>
            <Button size="md">Moyen (défaut)</Button>
            <Button size="lg">Grand</Button>
          </div>
        </Subsection>

        <Subsection title="États">
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

      {/* Tags */}
      <Section title="Tags">
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
                className="text-xs font-sans text-light-grey/40 hover:text-white transition-colors"
                onClick={() => setTags(['Round Robin', 'Simple Hommes', 'BWF Standard'])}
              >
                Réinitialiser les tags
              </button>
            )}
          </div>
        </Subsection>

        <Subsection title="Sélectionnables">
          <div className="flex flex-wrap gap-3">
            <Tag label="Poules" active />
            <Tag label="Knockout" />
            <Tag label="Americano" />
            <Tag label="Swiss" active />
          </div>
        </Subsection>
      </Section>

      {/* Tableau */}
      <Section title="Tableau de données">
        <Table<SamplePlayer>
          columns={playerColumns}
          data={samplePlayers}
          keyExtractor={(r) => r.id}
        />

        <div className="mt-6">
          <p className="font-sans text-xs text-light-grey/40 mb-3 uppercase tracking-widest">Tableau vide</p>
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
          <p className="font-sans text-light-grey text-sm mb-4">
            Ceci est le contenu de la modale. Appuyez sur <kbd className="bg-mid-grey px-1.5 py-0.5 text-xs font-sans border border-electric-blue/30">Échap</kbd> ou cliquez sur l'overlay pour fermer.
          </p>
          <Input label="Nom du joueur" placeholder="Saisir un nom…" />
        </Modal>

        <Modal
          isOpen={confirmModalOpen}
          onClose={() => setConfirmModalOpen(false)}
          title="Confirmation de suppression"
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
          <p className="font-sans text-light-grey text-sm">
            Cette action est irréversible. Voulez-vous vraiment supprimer cet élément ?
          </p>
        </Modal>
      </Section>

      {/* Géométrie — vérification aucun arrondi */}
      <Section title="Géométrie (zéro arrondi)">
        <div className="flex flex-wrap gap-4">
          <div className="bg-electric-blue text-white px-6 py-3 font-condensed font-bold uppercase">
            Carré strict
          </div>
          <div className="bg-mid-grey border-2 border-electric-blue text-white px-6 py-3 font-condensed">
            Bordure droite
          </div>
          <div className="bg-fluo-green text-black px-6 py-3 font-condensed font-bold uppercase">
            Accent fluo
          </div>
          <div className="bg-red-alert text-white px-6 py-3 font-condensed font-bold uppercase">
            Alerte rouge
          </div>
        </div>
        <p className="font-sans text-xs text-light-grey/40 mt-4">
          Aucun de ces éléments ne doit avoir de bords arrondis — vérifier visuellement.
        </p>
      </Section>
    </div>
  )
}
