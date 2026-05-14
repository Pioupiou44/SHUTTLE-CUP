import { useEffect, useState } from 'react'
import { useRulesStore } from '@/store/rulesStore'
import { Button, Badge, Modal, Input, Select } from '@/components/ui'
import { Pencil, Trash2, Plus, Lock } from 'lucide-react'
import type { ScoringRule } from '@/types/domain'

// ─── Formulaire règle ─────────────────────────────────────────────────────────

type RuleFormData = Omit<ScoringRule, 'id' | 'isCustom'>

const EMPTY_FORM: RuleFormData = {
  name: '',
  setsToWin: 2,
  pointsPerSet: 21,
  hasDeuce: true,
  maxScore: 30,
  goldenPoint: false,
}

function RuleForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: RuleFormData
  onSave: (data: RuleFormData) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState<RuleFormData>(initial)

  const set = <K extends keyof RuleFormData>(key: K, value: RuleFormData[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const valid = form.name.trim().length > 0 && form.pointsPerSet >= 5

  return (
    <div className="flex flex-col gap-5">
      <Input
        label="Nom de la règle"
        placeholder="Ex : Club 15 pts"
        value={form.name}
        onChange={(e) => set('name', e.target.value)}
      />

      <div className="grid grid-cols-2 gap-4">
        <Select
          label="Sets pour gagner"
          value={String(form.setsToWin)}
          onChange={(e) => set('setsToWin', Number(e.target.value))}
          options={[
            { value: '1', label: '1 set' },
            { value: '2', label: '2 sets (sur 3)' },
            { value: '3', label: '3 sets (sur 5)' },
          ]}
        />
        <Input
          label="Points par set"
          type="number"
          min={5}
          max={99}
          value={String(form.pointsPerSet)}
          onChange={(e) => set('pointsPerSet', Number(e.target.value))}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Golden point (score max)"
          type="number"
          min={0}
          max={99}
          value={String(form.maxScore)}
          onChange={(e) => set('maxScore', Number(e.target.value))}
        />
        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-mono font-bold uppercase tracking-[0.08em] text-ink-3">Options</p>
          <label className="flex items-center gap-2 cursor-pointer min-h-[44px]">
            <input
              type="checkbox"
              checked={form.hasDeuce}
              onChange={(e) => set('hasDeuce', e.target.checked)}
              className="w-4 h-4 accent-blue"
            />
            <span className="font-sans text-[14px] text-ink">Déuce (écart 2 pts)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.goldenPoint}
              onChange={(e) => set('goldenPoint', e.target.checked)}
              className="w-4 h-4 accent-blue"
            />
            <span className="font-sans text-[14px] text-ink">Golden point au max</span>
          </label>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button variant="secondary" size="sm" onClick={onCancel}>Annuler</Button>
        <Button size="sm" disabled={!valid} onClick={() => onSave(form)}>Enregistrer</Button>
      </div>
    </div>
  )
}

// ─── Aperçu live ──────────────────────────────────────────────────────────────

function RulePreview({ rule }: { rule: RuleFormData | null }) {
  if (!rule) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-[11px] font-mono font-bold uppercase tracking-[0.08em] text-ink-3">
          Sélectionnez ou créez une règle
        </p>
      </div>
    )
  }

  const totalSets = rule.setsToWin * 2 - 1

  return (
    <div className="p-8 flex flex-col gap-8">
      <div>
        <p className="text-[11px] font-mono font-bold uppercase tracking-[0.08em] text-ink-3 mb-1">Règle</p>
        <p className="font-sans font-black uppercase text-[30px] tracking-[-0.02em] text-ink leading-none">
          {rule.name || '—'}
        </p>
      </div>

      {/* Score exemple */}
      <div className="bg-ink p-6">
        <p className="text-[10px] font-mono font-bold uppercase tracking-[0.1em] text-ink-3 mb-4">Exemple de match</p>
        <div className="flex items-center justify-between">
          <div className="text-center">
            <p className="text-[11px] font-mono text-ink-3 uppercase tracking-[0.08em] mb-2">Équipe A</p>
            <span className="font-sans font-black text-[56px] tracking-[-0.04em] text-green-fluo leading-none">
              {rule.pointsPerSet}
            </span>
          </div>
          <div className="text-center">
            <p className="font-mono font-bold text-[13px] text-ink-3">vs</p>
          </div>
          <div className="text-center">
            <p className="text-[11px] font-mono text-ink-3 uppercase tracking-[0.08em] mb-2">Équipe B</p>
            <span className="font-sans font-black text-[56px] tracking-[-0.04em] text-ink-2 leading-none">
              {rule.pointsPerSet - 3}
            </span>
          </div>
        </div>
        {rule.hasDeuce && (
          <p className="text-[10px] font-mono text-ink-3 uppercase tracking-[0.08em] text-center mt-3">
            Déuce activé — écart 2 pts requis
          </p>
        )}
      </div>

      {/* Résumé */}
      <div className="grid grid-cols-2 gap-4">
        {[
          { label: 'Format',      value: `${rule.setsToWin} sets/${totalSets}` },
          { label: 'Points / set', value: String(rule.pointsPerSet) },
          { label: 'Golden point', value: rule.maxScore > 0 ? String(rule.maxScore) : 'Désactivé' },
          { label: 'Déuce',       value: rule.hasDeuce ? 'Oui' : 'Non' },
        ].map((item) => (
          <div key={item.label}>
            <p className="text-[11px] font-mono font-bold uppercase tracking-[0.08em] text-ink-3">{item.label}</p>
            <p className="font-sans font-black text-[22px] tracking-[-0.02em] text-ink leading-none mt-0.5">
              {item.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Page principale ──────────────────────────────────────────────────────────

export function SettingsPage() {
  const { rules, isLoading, fetchRules, createRule, updateRule, deleteRule } = useRulesStore()
  const [modalOpen, setModalOpen] = useState(false)
  const [editRule, setEditRule] = useState<ScoringRule | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ScoringRule | null>(null)
  const [previewData, setPreviewData] = useState<RuleFormData | null>(null)
  const [formDraft, setFormDraft] = useState<RuleFormData>(EMPTY_FORM)

  useEffect(() => { void fetchRules() }, [fetchRules])

  const openCreate = () => {
    setEditRule(null)
    setFormDraft(EMPTY_FORM)
    setPreviewData(EMPTY_FORM)
    setModalOpen(true)
  }

  const openEdit = (rule: ScoringRule) => {
    setEditRule(rule)
    const data: RuleFormData = {
      name:        rule.name,
      setsToWin:   rule.setsToWin,
      pointsPerSet: rule.pointsPerSet,
      hasDeuce:    rule.hasDeuce,
      maxScore:    rule.maxScore,
      goldenPoint: rule.goldenPoint,
    }
    setFormDraft(data)
    setPreviewData(data)
    setModalOpen(true)
  }

  const handleSave = async (data: RuleFormData) => {
    if (editRule) {
      await updateRule(editRule.id, data)
    } else {
      await createRule(data)
    }
    setModalOpen(false)
    setPreviewData(data)
  }

  const handleDelete = async () => {
    if (deleteTarget) {
      await deleteRule(deleteTarget.id)
      setDeleteTarget(null)
      if (previewData?.name === deleteTarget.name) setPreviewData(null)
    }
  }

  return (
    <div className="flex h-full">
      {/* Zone gauche 60% — liste + actions */}
      <div className="flex-[3] overflow-y-auto scrollbar-light border-r-2 border-line p-8">
        {/* En-tête */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="font-sans font-black uppercase text-[42px] tracking-[-0.03em] text-ink leading-none">
              Configuration
            </h1>
            <p className="font-sans text-[14px] text-ink-3 mt-2">
              Règles de scoring — l'aperçu à droite se met à jour en temps réel.
            </p>
          </div>
          <Button onClick={openCreate} className="shrink-0 mt-1">
            <Plus size={14} className="mr-2 inline" />
            Nouvelle règle
          </Button>
        </div>

        {/* Liste des règles */}
        {isLoading ? (
          <p className="font-sans text-[14px] text-ink-3">Chargement…</p>
        ) : (
          <div className="flex flex-col gap-0">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className="flex items-center justify-between px-4 py-4 border-b border-line-soft hover:bg-bg-alt transition-colors cursor-pointer group"
                onClick={() => setPreviewData({
                  name: rule.name, setsToWin: rule.setsToWin,
                  pointsPerSet: rule.pointsPerSet, hasDeuce: rule.hasDeuce,
                  maxScore: rule.maxScore, goldenPoint: rule.goldenPoint,
                })}
              >
                <div className="flex items-center gap-3">
                  {rule.isCustom ? null : <Lock size={12} className="text-ink-3 shrink-0" />}
                  <div>
                    <p className="font-sans font-bold text-[15px] text-ink">{rule.name}</p>
                    <p className="font-sans text-[12px] text-ink-3 mt-0.5">
                      {rule.setsToWin} sets · {rule.pointsPerSet} pts
                      {rule.hasDeuce ? ' · déuce' : ''}
                      {rule.maxScore > 0 ? ` · max ${rule.maxScore}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!rule.isCustom && (
                    <Badge variant="info">Préset</Badge>
                  )}
                  {rule.isCustom && (
                    <>
                      <button
                        className="p-2 text-ink-3 hover:text-blue transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center opacity-0 group-hover:opacity-100"
                        onClick={(e) => { e.stopPropagation(); openEdit(rule) }}
                        aria-label="Modifier"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        className="p-2 text-ink-3 hover:text-red transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center opacity-0 group-hover:opacity-100"
                        onClick={(e) => { e.stopPropagation(); setDeleteTarget(rule) }}
                        aria-label="Supprimer"
                      >
                        <Trash2 size={15} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}

            {rules.length === 0 && (
              <div className="py-12 text-center">
                <p className="font-sans font-black uppercase text-[18px] text-ink-3">Aucune règle</p>
                <p className="font-sans text-[14px] text-ink-3 mt-1">Créez votre première règle personnalisée</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Zone droite 40% — aperçu live */}
      <div className="flex-[2] bg-bg-alt sticky top-0 h-full overflow-y-auto scrollbar-light">
        <RulePreview rule={previewData} />
      </div>

      {/* Modal création / édition */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editRule ? 'Modifier la règle' : 'Nouvelle règle de scoring'}
        size="md"
      >
        <RuleForm
          initial={formDraft}
          onSave={handleSave}
          onCancel={() => setModalOpen(false)}
        />
      </Modal>

      {/* Modal confirmation suppression */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Supprimer la règle"
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
    </div>
  )
}
