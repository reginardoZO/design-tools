import { startTransition, useEffect, useRef, useState, type CSSProperties } from 'react'
import {
  CircuitBoard,
  FileDown,
  FolderOpen,
  Layers3,
  Link2,
  LockKeyhole,
  Save,
  Plus,
  Ruler,
  Trash2,
  Zap,
} from 'lucide-react'
import './App.css'
import {
  buildPanelLayout,
  END_SECTION_WIDTH_IN,
  getLoadOption,
  getLoadType,
  isColumnFillable,
  LOAD_TYPES,
  PANEL_HEIGHT_IN,
  PANEL_SPACE_COUNT,
  SPACE_HEIGHT_IN,
  STANDARD_COLUMN_WIDTH_IN,
  type PanelLayoutOptions,
  type LoadTypeId,
  type PanelColumn,
  type PanelLoad,
} from './panel'

const feetFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const inchesFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 3,
})

function formatOption(option: { label: string; spaces: number }) {
  const spaceLabel = `${option.spaces} ${option.spaces === 1 ? 'space' : 'spaces'}`
  const height = `${inchesFormatter.format(option.spaces * SPACE_HEIGHT_IN)} in`
  return `${option.label} · ${spaceLabel} · ${height}`
}

const PANEL_STORAGE_KEY = 'dimensionador.saved-panel.v1'
const FIXED_LOAD_TYPES: LoadTypeId[] = ['power-in', 'generator', 'tie-breaker', 'metering']

interface SavedPanel {
  version: 1
  loads: PanelLoad[]
  panelTag: string
  savedAt: string
  automaticSpares?: boolean
  retainedLoadColumns?: number
}

function isManualDrawer(load: PanelLoad) {
  return !load.parentLoadId
    && load.typeId !== 'spare'
    && !load.isAutomaticSpare
    && !FIXED_LOAD_TYPES.includes(load.typeId)
}

function readSavedPanel(): SavedPanel | null {
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(PANEL_STORAGE_KEY) ?? 'null',
    ) as Partial<SavedPanel> | null
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.loads)) {
      return null
    }

    const loads = parsed.loads.filter((load): load is PanelLoad => {
      if (!load || typeof load.id !== 'string' || typeof load.optionId !== 'string') {
        return false
      }
      const type = LOAD_TYPES.find((candidate) => candidate.id === load.typeId)
      return Boolean(type?.options.some((option) => option.id === load.optionId))
    }).map((load) => {
      const manualColumn = Number.isInteger(load.manualColumn)
        && (load.manualColumn ?? 0) > 0
        && (load.manualColumn ?? 0) <= 100
        && isManualDrawer(load)
        ? load.manualColumn
        : undefined
      return { ...load, manualColumn }
    })

    return {
      version: 1,
      loads,
      panelTag: typeof parsed.panelTag === 'string' ? parsed.panelTag : '',
      savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : '',
      automaticSpares: parsed.automaticSpares !== false,
      retainedLoadColumns: typeof parsed.retainedLoadColumns === 'number'
        ? Math.max(0, Math.floor(parsed.retainedLoadColumns))
        : 0,
    }
  } catch {
    return null
  }
}

function PanelColumnView({
  column,
  label,
  onLoadClick,
}: {
  column: PanelColumn
  label: string
  onLoadClick: (load: PanelLoad) => void
}) {
  return (
    <div
      className={`panel-column column-${column.role}${column.emptyLoadWarning ? ' column-empty-warning' : ''}`}
      data-column-kind={column.kind}
      style={{ width: `${column.widthIn * 5}px` }}
    >
      <div className="equipment-zone">
        {column.role === 'tie-bus-transition' && (
          <div className="tie-bus-transition-label">
            <span>TIE BUS</span>
            <strong>TRANSITION</strong>
          </div>
        )}
        {column.emptyLoadWarning && (
          <div className="empty-column-warning">
            <strong>EMPTY LOAD COLUMN</strong>
            <span>Retained after recalculation</span>
          </div>
        )}
        {column.loads.map((load) => {
          const type = getLoadType(load.typeId)
          const option = getLoadOption(load)
          const compact = option.spaces <= 2
          const heightIn = option.spaces * SPACE_HEIGHT_IN

          return (
            <button
              type="button"
              className={`load-bucket load-${load.typeId}`}
              data-compact={compact}
              data-manual={Boolean(load.manualColumn)}
              key={load.id}
              style={{ height: `${(option.spaces / PANEL_SPACE_COUNT) * 100}%` }}
              title={load.isAutomaticSpare
                ? `SPARE · Equipped reserve · ${formatOption(option)}`
                : isManualDrawer(load)
                ? `${type.label} · ${formatOption(option)} · Click to choose a column`
                : `${type.label} · ${formatOption(option)} · Fixed by the panel rules`}
              onClick={() => onLoadClick(load)}
              disabled={!isManualDrawer(load)}
            >
              <span>{type.shortLabel}</span>
              <strong>{option.shortLabel}</strong>
              <small>{option.spaces} SP · {inchesFormatter.format(heightIn)}&quot;</small>
            </button>
          )
        })}
      </div>
      <div className="column-label">
        <div className="column-identity">
          <span>{label}</span>
          <small>{column.kind}</small>
        </div>
        <div className="column-dimension">
          <strong>{inchesFormatter.format(column.widthIn)} in</strong>
          <small>{feetFormatter.format(column.widthIn / 12)} ft</small>
        </div>
      </div>
    </div>
  )
}

function EndSectionView({ position }: { position: 'start' | 'end' }) {
  return (
    <div
      className={`end-section end-section-${position}`}
      style={{ width: `${END_SECTION_WIDTH_IN * 5}px` }}
      aria-label={`End section ${position === 'start' ? 'start' : 'end'}`}
    >
      <span>END SECTION</span>
    </div>
  )
}

function App() {
  const [initialPanel] = useState(readSavedPanel)
  const [loads, setLoads] = useState<PanelLoad[]>(initialPanel?.loads ?? [])
  const [selectedTypeId, setSelectedTypeId] = useState<LoadTypeId>('fvnr')
  const [selectedOptionId, setSelectedOptionId] = useState(
    getLoadType('fvnr').options[0].id,
  )
  const [quantity, setQuantity] = useState(1)
  const [automaticSpares, setAutomaticSpares] = useState(initialPanel?.automaticSpares ?? true)
  const [retainedLoadColumns, setRetainedLoadColumns] = useState(
    initialPanel?.retainedLoadColumns ?? 0,
  )
  const layoutOptions: PanelLayoutOptions = {
    automaticSpares,
    minimumLoadColumns: retainedLoadColumns,
  }
  const layout = buildPanelLayout(loads, layoutOptions)
  const selectedType = getLoadType(selectedTypeId)
  const powerCount = loads.filter((load) => load.typeId === 'power-in').length
  const meterCount = loads.filter((load) => load.typeId === 'metering').length
  const availableMeterSlots = powerCount - meterCount
  const canAdd = (selectedTypeId !== 'metering' || quantity <= availableMeterSlots)
    && !(automaticSpares && selectedTypeId === 'spare')
  const widthFeet = feetFormatter.format(layout.widthIn / 12)
  const spareBuckets = layout.columns
    .flatMap((column) => column.loads)
    .filter((load) => load.typeId === 'spare')
  const spareBom = [...spareBuckets.reduce((groups, load) => {
    const size = getLoadOption(load).spaces
    groups.set(size, (groups.get(size) ?? 0) + 1)
    return groups
  }, new Map<number, number>())]
    .sort(([first], [second]) => second - first)
    .map(([size, count]) => `${count}×${size} SP`)
    .join(' + ')

  let standardSectionCount = 0
  let transitionCount = 0
  const columnLabels = layout.columns.map((column) => {
    if (column.role === 'tie-bus-transition') {
      return 'TBT'
    }
    if (column.role === 'transition') {
      transitionCount += 1
      return `TR${String(transitionCount).padStart(2, '0')}`
    }
    standardSectionCount += 1
    return `S${String(standardSectionCount).padStart(2, '0')}`
  })

  const [exportOpen, setExportOpen] = useState(false)
  const [tagInput, setTagInput] = useState('')
  const [panelTag, setPanelTag] = useState(initialPanel?.panelTag ?? '')
  const [saveStatus, setSaveStatus] = useState(
    initialPanel?.savedAt ? `Restored ${new Date(initialPanel.savedAt).toLocaleString()}` : '',
  )
  const [hasSavedPanel, setHasSavedPanel] = useState(Boolean(initialPanel))
  const [manualLoadId, setManualLoadId] = useState<string | null>(null)
  const [manualColumnInput, setManualColumnInput] = useState('0')
  const [pendingPrint, setPendingPrint] = useState(false)
  const [printScale, setPrintScale] = useState(1)
  const stageRef = useRef<HTMLDivElement>(null)
  const printingRef = useRef(false)

  useEffect(() => {
    if (layout.loadColumnCount > retainedLoadColumns) {
      setRetainedLoadColumns(layout.loadColumnCount)
    }
  }, [layout.loadColumnCount, retainedLoadColumns])

  const manualLoad = loads.find((load) => load.id === manualLoadId) ?? null

  const openManualDialog = (load: PanelLoad) => {
    if (!isManualDrawer(load)) {
      return
    }
    const currentColumn = layout.columns.findIndex((column) =>
      column.loads.some((candidate) => candidate.id === load.id),
    )
    setManualLoadId(load.id)
    setManualColumnInput(String(load.manualColumn ?? currentColumn + 1))
  }

  const closeManualDialog = () => {
    setManualLoadId(null)
    setManualColumnInput('0')
  }

  const confirmManualColumn = () => {
    if (!manualLoad) {
      return
    }
    const targetColumn = Number(manualColumnInput)
    const targetColumnData = layout.columns[targetColumn - 1]
    const occupiedSpaces = (targetColumnData?.loads ?? [])
      .filter((load) => load.id !== manualLoad.id && !load.isAutomaticSpare)
      .reduce((total, load) => total + getLoadOption(load).spaces, 0)
    if (
      targetColumn > 0
      && (
        !targetColumnData
        || !isColumnFillable(targetColumnData)
        || occupiedSpaces + getLoadOption(manualLoad).spaces > PANEL_SPACE_COUNT
      )
    ) {
      return
    }

    startTransition(() => setLoads((current) => current.map((load) => {
      if (load.id !== manualLoad.id) {
        return load
      }
      if (targetColumn === 0) {
        const { manualColumn: _manualColumn, ...automaticLoad } = load
        return automaticLoad
      }
      return { ...load, manualColumn: targetColumn }
    })))
    setSaveStatus('Unsaved changes')
    closeManualDialog()
  }

  const savePanel = () => {
    const savedAt = new Date().toISOString()
    const snapshot: SavedPanel = {
      version: 1,
      loads,
      panelTag,
      savedAt,
      automaticSpares,
      retainedLoadColumns: layout.loadColumnCount,
    }
    try {
      window.localStorage.setItem(PANEL_STORAGE_KEY, JSON.stringify(snapshot))
      setHasSavedPanel(true)
      setSaveStatus(`Saved ${new Date(savedAt).toLocaleString()}`)
    } catch {
      setSaveStatus('The panel could not be saved in this browser')
    }
  }

  const openSavedPanel = () => {
    const savedPanel = readSavedPanel()
    if (!savedPanel) {
      setHasSavedPanel(false)
      setSaveStatus('No saved panel was found in this browser')
      return
    }
    startTransition(() => {
      setLoads(savedPanel.loads)
      setPanelTag(savedPanel.panelTag)
      setAutomaticSpares(savedPanel.automaticSpares ?? true)
      setRetainedLoadColumns(savedPanel.retainedLoadColumns ?? 0)
    })
    setSaveStatus(`Opened panel saved ${new Date(savedPanel.savedAt).toLocaleString()}`)
  }

  const openExportDialog = () => {
    setTagInput(panelTag)
    setExportOpen(true)
  }

  const confirmExport = () => {
    const tag = tagInput.trim()
    if (!tag) {
      return
    }

    const stageWidth = stageRef.current?.offsetWidth ?? 0
    const printableWidthPx = 1000
    setPanelTag(tag)
    if (tag !== panelTag) {
      setSaveStatus('Unsaved changes')
    }
    setPrintScale(stageWidth > printableWidthPx ? printableWidthPx / stageWidth : 1)
    setExportOpen(false)
    setPendingPrint(true)
  }

  useEffect(() => {
    if (!pendingPrint || printingRef.current) {
      return
    }

    printingRef.current = true
    const originalTitle = document.title
    document.title = panelTag
    window.print()
    document.title = originalTitle
    printingRef.current = false
    setPendingPrint(false)
  }, [pendingPrint, panelTag])

  const changeType = (typeId: LoadTypeId) => {
    const nextType = getLoadType(typeId)
    setSelectedTypeId(typeId)
    setSelectedOptionId(nextType.options[0].id)
  }

  const addLoads = () => {
    if (!canAdd) {
      return
    }

    const automaticRlyCount = selectedTypeId === 'tie-breaker'
      ? 2
      : selectedTypeId === 'generator'
        ? 1
        : 0
    const nextLoads: PanelLoad[] = Array.from({ length: quantity }).flatMap(() => {
      const parentLoad: PanelLoad = {
        id: crypto.randomUUID(),
        typeId: selectedTypeId,
        optionId: selectedOptionId,
      }
      const automaticRlyLoads: PanelLoad[] = Array.from(
        { length: automaticRlyCount },
        () => ({
          id: crypto.randomUUID(),
          typeId: 'rly-pnl',
          optionId: 'standard',
          parentLoadId: parentLoad.id,
        }),
      )
      const automaticMeterLoads: PanelLoad[] = selectedTypeId === 'power-in'
        ? [{
            id: crypto.randomUUID(),
            typeId: 'metering',
            optionId: 'voltmeter-switch',
            parentLoadId: parentLoad.id,
          }]
        : []

      return [parentLoad, ...automaticMeterLoads, ...automaticRlyLoads]
    })
    startTransition(() => setLoads((current) => [...current, ...nextLoads]))
    setSaveStatus('Unsaved changes')
  }

  const removeLoad = (load: PanelLoad) => {
    if (load.parentLoadId) {
      return
    }

    const remainingMeterCount = loads.filter((item) =>
      item.typeId === 'metering' && item.parentLoadId !== load.id,
    ).length
    const locksMeter = load.typeId === 'power-in' && remainingMeterCount > powerCount - 1
    if (locksMeter) {
      return
    }
    startTransition(() => setLoads((current) => current.filter(
      (item) => item.id !== load.id && item.parentLoadId !== load.id,
    )))
    setSaveStatus('Unsaved changes')
  }

  const selectedManualColumn = Number(manualColumnInput)
  const selectedManualColumnTarget = layout.columns[selectedManualColumn - 1]
  const selectedManualColumnSpaces = manualLoad && selectedManualColumnTarget
    ? selectedManualColumnTarget.loads
      .filter((load) => load.id !== manualLoad.id && !load.isAutomaticSpare)
      .reduce((total, load) => total + getLoadOption(load).spaces, 0)
      + getLoadOption(manualLoad).spaces
    : 0
  const manualSelectionFits = selectedManualColumn === 0
    || (
      Boolean(selectedManualColumnTarget)
      && isColumnFillable(selectedManualColumnTarget as PanelColumn)
      && selectedManualColumnSpaces <= PANEL_SPACE_COUNT
    )

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand-mark" aria-hidden="true">
          <CircuitBoard size={25} strokeWidth={1.8} />
        </div>
        <div className="brand-copy">
          <span className="eyebrow">LV PANEL LAB / 480 V</span>
          <h1>LV Panel Sizer</h1>
        </div>
        <div className="source-badge">
          <span>Freedom Arc Resistant</span>
          <strong>NEMA 1 · 3PH3W · 60 Hz</strong>
        </div>
      </header>

      <main className="workspace">
        <aside className="config-panel">
          <section className="config-section">
            <div className="section-heading">
              <div>
                <span className="section-number">01</span>
                <h2>Add load</h2>
              </div>
              <Zap size={19} aria-hidden="true" />
            </div>

            <div className="field-stack">
              <label htmlFor="load-type">Load type</label>
              <div className="select-wrap">
                <select
                  id="load-type"
                  value={selectedTypeId}
                  onChange={(event) => changeType(event.target.value as LoadTypeId)}
                >
                  {LOAD_TYPES.filter((type) => type.id !== 'metering').map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="field-stack">
              <label htmlFor="load-size">Load size</label>
              <div className="select-wrap">
                <select
                  id="load-size"
                  value={selectedOptionId}
                  onChange={(event) => setSelectedOptionId(event.target.value)}
                >
                  {selectedType.options.map((option) => (
                    <option key={option.id} value={option.id}>
                      {formatOption(option)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="add-row">
              <div className="field-stack quantity-field">
                <label htmlFor="load-quantity">Quantity</label>
                <input
                  id="load-quantity"
                  type="number"
                  min="1"
                  max="12"
                  value={quantity}
                  onChange={(event) =>
                    setQuantity(Math.min(12, Math.max(1, Number(event.target.value) || 1)))
                  }
                />
              </div>
              <button className="primary-button" type="button" onClick={addLoads} disabled={!canAdd}>
                <Plus size={18} aria-hidden="true" />
                Add
              </button>
            </div>

            {selectedTypeId === 'metering' && (
              <div className={`constraint-status ${canAdd ? 'status-ok' : 'status-blocked'}`}>
                <Link2 size={16} aria-hidden="true" />
                <span>
                  {availableMeterSlots > 0
                    ? `${availableMeterSlots} ${availableMeterSlots === 1 ? 'position available' : 'positions available'} next to the Power In`
                    : 'Requires an available Power In'}
                </span>
              </div>
            )}
            {selectedTypeId === 'spare' && automaticSpares && (
              <div className="constraint-status status-blocked">
                <LockKeyhole size={16} aria-hidden="true" />
                <span>Spare buckets are being calculated automatically</span>
              </div>
            )}

            <label className="spare-toggle">
              <input
                type="checkbox"
                checked={automaticSpares}
                onChange={(event) => {
                  const enabled = event.target.checked
                  setAutomaticSpares(enabled)
                  if (enabled) {
                    setLoads((current) => current.filter((load) => load.typeId !== 'spare'))
                  }
                  setSaveStatus('Unsaved changes')
                }}
              />
              <span>
                <strong>Automatic spare buckets</strong>
                <small>20% of real load modules, including a dominant-size reserve</small>
              </span>
            </label>
          </section>

          <section className="config-section load-list-section">
            <div className="section-heading list-heading">
              <div>
                <span className="section-number">02</span>
                <h2>Selected loads</h2>
              </div>
              <span className="load-count">{loads.length}</span>
            </div>

            <div className="selected-loads">
              {loads.length === 0 ? (
                <div className="empty-list">No loads added</div>
              ) : (
                loads.map((load, index) => {
                  const type = getLoadType(load.typeId)
                  const option = getLoadOption(load)
                  const isAutomaticChild = Boolean(load.parentLoadId)
                  const remainingMeterCount = loads.filter((item) =>
                    item.typeId === 'metering' && item.parentLoadId !== load.id
                  ).length
                  const removalLocked = isAutomaticChild
                    || (load.typeId === 'power-in' && remainingMeterCount > powerCount - 1)
                  const lockedTitle = isAutomaticChild
                    ? `${type.label} added automatically; remove the linked equipment`
                    : 'Remove the Metering first'

                  return (
                    <div className="selected-load" key={load.id}>
                      <span className={`load-swatch swatch-${load.typeId}`} aria-hidden="true" />
                      <span className="load-index">{String(index + 1).padStart(2, '0')}</span>
                      <div className="selected-load-copy">
                        <strong>{type.label}</strong>
                        <span>
                          {formatOption(option)}
                          {isAutomaticChild && ' · Automatic'}
                          {load.manualColumn && ` · Column ${load.manualColumn} (manual)`}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="icon-button"
                        onClick={() => removeLoad(load)}
                        disabled={removalLocked}
                        title={removalLocked ? lockedTitle : 'Remove load'}
                        aria-label={removalLocked ? lockedTitle : 'Remove load'}
                      >
                        {removalLocked ? <LockKeyhole size={15} /> : <Trash2 size={15} />}
                      </button>
                    </div>
                  )
                })
              )}
            </div>

            {loads.length > 0 && (
              <button
                className="clear-button"
                type="button"
                onClick={() => {
                  setLoads([])
                  setRetainedLoadColumns(0)
                  setSaveStatus('Unsaved changes')
                }}
              >
                <Trash2 size={15} aria-hidden="true" />
                Clear panel
              </button>
            )}
          </section>
        </aside>

        <section className="panel-workbench">
          <div className="print-header">
            <div>
              <span className="print-eyebrow">
                LV Panel Sizer · Freedom Arc Resistant · NEMA 1 · 3PH3W · 60 Hz
              </span>
              <h1 className="print-tag">{panelTag}</h1>
            </div>
            <div className="print-meta">
              <span>Total width {widthFeet} ft · {inchesFormatter.format(layout.widthIn)} in</span>
              <span>
                Columns {layout.columns.length} · Sections {layout.columns.length + 2}
                {' '}· Utilization {Math.round(layout.utilization * 100)}%
              </span>
              <span>
                Load base {layout.baseLoadSpaces} modules · Equipped spare {layout.spareSpaces} modules
              </span>
              <span>BOM · Equipped SPARE {spareBom || 'none'}</span>
              <span>Issued on {new Date().toLocaleDateString('en-US')}</span>
            </div>
          </div>

          <div className="metrics-band">
            <div className="primary-metric">
              <Ruler size={20} aria-hidden="true" />
              <div>
                <span>Total width</span>
                <strong>{widthFeet} ft</strong>
                <small>{inchesFormatter.format(layout.widthIn)} in</small>
              </div>
            </div>
            <div className="metric">
              <Layers3 size={18} aria-hidden="true" />
              <div>
                <span>Sections</span>
                <strong>{layout.columns.length > 0 ? layout.columns.length + 2 : 0}</strong>
              </div>
            </div>
            <div className="metric">
              <CircuitBoard size={18} aria-hidden="true" />
              <div><span>Utilization</span><strong>{Math.round(layout.utilization * 100)}%</strong></div>
            </div>
            <div className="metric reserve-metric">
              <Layers3 size={18} aria-hidden="true" />
              <div>
                <span>Equipped spare</span>
                <strong>{layout.spareSpaces} SP</strong>
              </div>
            </div>
          </div>

          <div className="drawing-header">
            <div>
              <span className="section-number">03</span>
              <h2>Front elevation</h2>
            </div>
            <div className="drawing-actions">
              <button
                className="save-button"
                type="button"
                onClick={openSavedPanel}
                disabled={!hasSavedPanel}
                title="Open the last panel saved in this browser"
              >
                <FolderOpen size={15} aria-hidden="true" />
                Open saved
              </button>
              <div className="save-action">
                <button
                  className="save-button"
                  type="button"
                  onClick={savePanel}
                  disabled={layout.columns.length === 0}
                >
                  <Save size={15} aria-hidden="true" />
                  Save panel
                </button>
                {saveStatus && <span className="save-status" role="status">{saveStatus}</span>}
              </div>
              <button
                className="export-button"
                type="button"
                onClick={openExportDialog}
                disabled={layout.columns.length === 0}
              >
                <FileDown size={15} aria-hidden="true" />
                Export PDF
              </button>
            </div>
            <div className="drawing-specs">
              <span>Height {PANEL_HEIGHT_IN} in</span>
              <span>{PANEL_SPACE_COUNT} spaces × {SPACE_HEIGHT_IN} in</span>
              <span>Full usable area {PANEL_HEIGHT_IN} in</span>
              <span>
                Standard section {inchesFormatter.format(STANDARD_COLUMN_WIDTH_IN)} in /{' '}
                {feetFormatter.format(STANDARD_COLUMN_WIDTH_IN / 12)} ft
              </span>
            </div>
          </div>

          <div className="panel-scroll" aria-live="polite">
            {layout.columns.length === 0 ? (
              <div className="empty-panel">
                <div className="empty-cabinet" aria-hidden="true">
                  <span /><span /><span />
                </div>
                <strong>Empty panel</strong>
              </div>
            ) : (
              <div
                className="drawing-stage"
                ref={stageRef}
                style={{ width: `${layout.widthIn * 5}px`, '--print-scale': printScale } as CSSProperties}
              >
                <div className="dimension-line">
                  <i /><span>{widthFeet} ft</span><i />
                </div>
                <div className="panel-rack">
                  <EndSectionView position="start" />
                  {layout.columns.map((column, index) => (
                    <PanelColumnView
                      column={column}
                      label={`C${String(index + 1).padStart(2, '0')} · ${columnLabels[index]}`}
                      onLoadClick={openManualDialog}
                      key={column.id}
                    />
                  ))}
                  <EndSectionView position="end" />
                </div>
              </div>
            )}
          </div>

          <div className="workbench-footer">
            <div className="utilization-block">
              <div>
                <span>Vertical space usage</span>
                <strong>{layout.usedSpaces} / {layout.capacitySpaces} spaces</strong>
              </div>
              <div className="utilization-track" aria-hidden="true">
                <span style={{ width: `${layout.utilization * 100}%` }} />
              </div>
              {layout.emptyLoadColumnCount > 0 && (
                <span className="empty-column-notice">
                  {layout.emptyLoadColumnCount} empty load {layout.emptyLoadColumnCount === 1 ? 'column retained' : 'columns retained'}
                </span>
              )}
            </div>
            <div className="legend" aria-label="Load legend">
              {spareBuckets.length > 0 && (
                <span className="spare-bom"><strong>BOM</strong> Equipped SPARE: {spareBom}</span>
              )}
              {LOAD_TYPES.filter((type) => type.id !== 'spare').map((type) => (
                <span key={type.id}><i className={`swatch-${type.id}`} />{type.shortLabel}</span>
              ))}
            </div>
          </div>
        </section>
      </main>

      {manualLoad && (
        <div className="export-dialog-overlay">
          <form
            className="export-dialog column-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="column-dialog-title"
            onSubmit={(event) => {
              event.preventDefault()
              confirmManualColumn()
            }}
          >
            <h2 id="column-dialog-title">Choose drawer column</h2>
            <p>
              Choose the physical column for {getLoadType(manualLoad.typeId).label}{' '}
              {getLoadOption(manualLoad).shortLabel}. A manual drawer is excluded from
              automatic column adjustment.
            </p>
            <label htmlFor="drawer-column">Column</label>
            <div className="select-wrap">
              <select
                id="drawer-column"
                value={manualColumnInput}
                onChange={(event) => setManualColumnInput(event.target.value)}
                autoFocus
              >
                <option value="0">Automatic placement</option>
                {layout.columns.map((column, index) => {
                  const columnNumber = index + 1
                  const occupiedSpaces = column.loads
                    .filter((load) => load.id !== manualLoad.id && !load.isAutomaticSpare)
                    .reduce((total, load) => total + getLoadOption(load).spaces, 0)
                  const fits = isColumnFillable(column)
                    && occupiedSpaces + getLoadOption(manualLoad).spaces <= PANEL_SPACE_COUNT
                  return (
                    <option key={columnNumber} value={columnNumber} disabled={!fits}>
                      Column {columnNumber} ({columnLabels[index]})
                      {!isColumnFillable(column) ? ' · INFRA (fixed)' : column.kind === 'INFRA' ? ' · INFRA' : ''}
                      {occupiedSpaces > 0 ? ` · ${PANEL_SPACE_COUNT - occupiedSpaces} spaces available` : ''}
                    </option>
                  )
                })}
              </select>
            </div>
            {!manualSelectionFits && (
              <span className="dialog-error">This column does not have enough vertical space.</span>
            )}
            <div className="export-dialog-actions">
              <button type="button" className="dialog-cancel" onClick={closeManualDialog}>
                Cancel
              </button>
              <button type="submit" className="primary-button" disabled={!manualSelectionFits}>
                Apply
              </button>
            </div>
          </form>
        </div>
      )}

      {exportOpen && (
        <div className="export-dialog-overlay">
          <form
            className="export-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="export-dialog-title"
            onSubmit={(event) => {
              event.preventDefault()
              confirmExport()
            }}
          >
            <h2 id="export-dialog-title">Export panel to PDF</h2>
            <p>
              Enter the panel tag. It will be shown at the top of the exported file.
              In the print window, select "Save as PDF".
            </p>
            <label htmlFor="panel-tag">Panel tag</label>
            <input
              id="panel-tag"
              value={tagInput}
              onChange={(event) => setTagInput(event.target.value)}
              placeholder="e.g. MCC-01"
              maxLength={40}
              autoFocus
            />
            <div className="export-dialog-actions">
              <button type="button" className="dialog-cancel" onClick={() => setExportOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="primary-button" disabled={!tagInput.trim()}>
                <FileDown size={16} aria-hidden="true" />
                Export
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

export default App
