export type LoadTypeId =
  | 'power-in'
  | 'generator'
  | 'metering'
  | 'vfd'
  | 'fvnr'
  | 'feeder'
  | 'ngh-brk-turb'
  | 'rly-pnl'
  | 'transfer-control'
  | 'tie-breaker'
  | 'spare'

export interface LoadOption {
  id: string
  label: string
  shortLabel: string
  spaces: number
  widthIn?: number
}

export interface LoadType {
  id: LoadTypeId
  label: string
  shortLabel: string
  options: LoadOption[]
}

export interface PanelLoad {
  id: string
  typeId: LoadTypeId
  optionId: string
  parentLoadId?: string
  /** One-based physical column selected by the user. */
  manualColumn?: number
}

export interface PanelColumn {
  id: string
  role:
    | 'standard'
    | 'power-in'
    | 'generator'
    | 'tie-breaker'
    | 'transition'
    | 'tie-bus-transition'
  widthIn: number
  loads: PanelLoad[]
}

export interface PanelLayout {
  columns: PanelColumn[]
  widthIn: number
  usedSpaces: number
  capacitySpaces: number
  usedHeightIn: number
  capacityHeightIn: number
  utilization: number
}

export const PANEL_SPACE_COUNT = 12
export const SPACE_HEIGHT_IN = 7.5
export const STANDARD_COLUMN_WIDTH_IN = 20.078
export const POWER_COLUMN_WIDTH_IN = 24.078
export const TRANSITION_COLUMN_WIDTH_IN = 20.078
export const TIE_BUS_TRANSITION_COLUMN_WIDTH_IN = TRANSITION_COLUMN_WIDTH_IN
export const END_SECTION_WIDTH_IN = 4.156
export const PANEL_HEIGHT_IN = PANEL_SPACE_COUNT * SPACE_HEIGHT_IN

export const LOAD_TYPES: LoadType[] = [
  {
    id: 'power-in',
    label: 'Power In',
    shortLabel: 'POWER IN',
    options: [
      {
        id: '2000a',
        label: '2000 A',
        shortLabel: '2000 A',
        spaces: 12,
        widthIn: POWER_COLUMN_WIDTH_IN,
      },
      {
        id: '2500a',
        label: '2500 A',
        shortLabel: '2500 A',
        spaces: 12,
        widthIn: POWER_COLUMN_WIDTH_IN,
      },
    ],
  },
  {
    id: 'generator',
    label: 'Generator',
    shortLabel: 'GENERATOR',
    options: [
      {
        id: 'full-column',
        label: 'Full column',
        shortLabel: 'FULL COLUMN',
        spaces: 12,
        widthIn: POWER_COLUMN_WIDTH_IN,
      },
    ],
  },
  {
    id: 'metering',
    label: 'Metering',
    shortLabel: 'METERING',
    options: [
      {
        id: 'voltmeter-switch',
        label: 'Voltmeter + switch',
        shortLabel: 'VOLT + SW',
        spaces: 3,
      },
    ],
  },
  {
    id: 'vfd',
    label: 'VFD',
    shortLabel: 'VFD',
    options: [
      { id: '1-5hp', label: '1.5 HP / 3.3 FLA', shortLabel: '1.5 HP', spaces: 5 },
      { id: '7-5hp', label: '7.5 HP / 12 FLA', shortLabel: '7.5 HP', spaces: 5 },
      { id: '15hp', label: '15 HP / 23 FLA', shortLabel: '15 HP', spaces: 7 },
      { id: '50hp', label: '50 HP / 72 FLA', shortLabel: '50 HP', spaces: 12 },
    ],
  },
  {
    id: 'fvnr',
    label: 'FVNR Starter',
    shortLabel: 'FVNR',
    options: [
      { id: '0-75hp-n1', label: '0.75 HP · NEMA 1', shortLabel: '0.75 HP · N1', spaces: 2 },
      { id: '1-5hp-n1', label: '1.5 HP · NEMA 1', shortLabel: '1.5 HP · N1', spaces: 2 },
      { id: '2hp-n1', label: '2 HP · NEMA 1', shortLabel: '2 HP · N1', spaces: 2 },
      { id: '3hp-n1', label: '3 HP · NEMA 1', shortLabel: '3 HP · N1', spaces: 2 },
      { id: '5hp-n1', label: '5 HP · NEMA 1', shortLabel: '5 HP · N1', spaces: 2 },
      { id: '7-5hp-n1', label: '7.5 HP · NEMA 1', shortLabel: '7.5 HP · N1', spaces: 2 },
      { id: '10hp-n1', label: '10 HP · NEMA 1', shortLabel: '10 HP · N1', spaces: 2 },
      { id: '15hp-n2', label: '15 HP · NEMA 2', shortLabel: '15 HP · N2', spaces: 2 },
      { id: '20hp-n2', label: '20 HP · NEMA 2', shortLabel: '20 HP · N2', spaces: 2 },
      { id: '25hp-n2', label: '25 HP · NEMA 2', shortLabel: '25 HP · N2', spaces: 2 },
      { id: '40hp-n3', label: '40 HP · NEMA 3', shortLabel: '40 HP · N3', spaces: 3 },
      { id: '50hp-n3', label: '50 HP · NEMA 3', shortLabel: '50 HP · N3', spaces: 3 },
      { id: '200hp-n5-42', label: '200 HP · NEMA 5', shortLabel: '200 HP · N5', spaces: 7 },
      { id: '200hp-n5-48', label: '200 HP · NEMA 5', shortLabel: '200 HP · N5', spaces: 8 },
      { id: '400hp-n6', label: '400 HP · NEMA 6', shortLabel: '400 HP · N6', spaces: 11 },
    ],
  },
  {
    id: 'feeder',
    label: 'Feeder Breaker',
    shortLabel: 'FEEDER',
    options: [
      { id: '30a', label: '30 A', shortLabel: '30 A', spaces: 2 },
      { id: '50a', label: '50 A', shortLabel: '50 A', spaces: 2 },
      { id: '80a', label: '80 A', shortLabel: '80 A', spaces: 2 },
      { id: '150a', label: '150 A', shortLabel: '150 A', spaces: 3 },
      { id: '225a', label: '225 A', shortLabel: '225 A', spaces: 3 },
      { id: '400a', label: '400 A', shortLabel: '400 A', spaces: 4 },
      { id: '800a', label: '800 A', shortLabel: '800 A', spaces: 7 },
      { id: '1200a', label: '1200 A', shortLabel: '1200 A', spaces: 7 },
    ],
  },
  {
    id: 'ngh-brk-turb',
    label: 'NGH BRK (TURB)',
    shortLabel: 'NGH BRK',
    options: [
      {
        id: 'standard',
        label: 'Turbine breaker',
        shortLabel: 'TURB',
        spaces: 8,
        widthIn: STANDARD_COLUMN_WIDTH_IN,
      },
    ],
  },
  {
    id: 'rly-pnl',
    label: 'RLY PNL',
    shortLabel: 'RLY PNL',
    options: [
      {
        id: 'standard',
        label: 'Relay panel',
        shortLabel: 'RLY PNL',
        spaces: 4,
        widthIn: STANDARD_COLUMN_WIDTH_IN,
      },
    ],
  },
  {
    id: 'transfer-control',
    label: 'Transfer Control',
    shortLabel: 'TRANSFER',
    options: [
      {
        id: 'standard',
        label: 'Transfer control',
        shortLabel: 'CONTROL',
        spaces: 12,
        widthIn: STANDARD_COLUMN_WIDTH_IN,
      },
    ],
  },
  {
    id: 'tie-breaker',
    label: 'Tie Breaker',
    shortLabel: 'TIE',
    options: [
      {
        id: '2000a',
        label: '2000 A',
        shortLabel: '2000 A',
        spaces: 12,
        widthIn: POWER_COLUMN_WIDTH_IN,
      },
    ],
  },
  {
    id: 'spare',
    label: 'Spare Space',
    shortLabel: 'SPACE',
    options: Array.from({ length: PANEL_SPACE_COUNT }, (_, index) => index + 1).map((spaces) => ({
      id: `${spaces}-spaces`,
      label: 'Spare',
      shortLabel: `${spaces} SP`,
      spaces,
    })),
  },
]

export function getLoadType(typeId: LoadTypeId) {
  return LOAD_TYPES.find((type) => type.id === typeId) ?? LOAD_TYPES[0]
}

export function getLoadOption(load: PanelLoad) {
  const type = getLoadType(load.typeId)
  return type.options.find((option) => option.id === load.optionId) ?? type.options[0]
}

function columnUsedSpaces(loads: PanelLoad[]) {
  return loads.reduce((total, load) => total + getLoadOption(load).spaces, 0)
}

function greedyPack(items: PanelLoad[], seedBins: PanelLoad[][]) {
  const bins = seedBins.map((bin) => [...bin])

  for (const item of items) {
    const spaces = getLoadOption(item).spaces
    let bestIndex = -1
    let smallestRemainder = Number.POSITIVE_INFINITY

    for (let index = 0; index < bins.length; index += 1) {
      const remainder = PANEL_SPACE_COUNT - columnUsedSpaces(bins[index]) - spaces
      if (remainder >= 0 && remainder < smallestRemainder) {
        bestIndex = index
        smallestRemainder = remainder
      }
    }

    if (bestIndex === -1) {
      bins.push([item])
    } else {
      bins[bestIndex].push(item)
    }
  }

  return bins
}

function packStandardLoads(items: PanelLoad[], meterLoads: PanelLoad[]) {
  const sorted = [...items].sort(
    (first, second) => getLoadOption(second).spaces - getLoadOption(first).spaces,
  )
  const seeds = meterLoads.map((meter) => [meter])
  let best = greedyPack(sorted, seeds)
  let bestMeterWaste = best
    .slice(0, seeds.length)
    .reduce((total, bin) => total + PANEL_SPACE_COUNT - columnUsedSpaces(bin), 0)

  if (sorted.length > 24) {
    return best
  }

  const searchStartedAt = performance.now()
  const visitedStates = new Set<string>()
  const maxSearchTimeMs = 12
  const maxVisitedStates = 12_000

  const remainingTotals = new Array(sorted.length + 1).fill(0) as number[]
  for (let index = sorted.length - 1; index >= 0; index -= 1) {
    remainingTotals[index] = remainingTotals[index + 1] + getLoadOption(sorted[index]).spaces
  }

  const search = (itemIndex: number, bins: PanelLoad[][]) => {
    if (
      visitedStates.size >= maxVisitedStates ||
      performance.now() - searchStartedAt >= maxSearchTimeMs
    ) {
      return
    }

    const meterRemainders = bins
      .slice(0, seeds.length)
      .map((bin) => PANEL_SPACE_COUNT - columnUsedSpaces(bin))
    const standardRemainders = bins
      .slice(seeds.length)
      .map((bin) => PANEL_SPACE_COUNT - columnUsedSpaces(bin))
      .sort((first, second) => second - first)
    const stateKey = `${itemIndex}|${meterRemainders.join(',')}|${standardRemainders.join(',')}`
    if (visitedStates.has(stateKey)) {
      return
    }
    visitedStates.add(stateKey)

    if (itemIndex === sorted.length) {
      const meterWaste = bins
        .slice(0, seeds.length)
        .reduce((total, bin) => total + PANEL_SPACE_COUNT - columnUsedSpaces(bin), 0)
      if (bins.length < best.length || (bins.length === best.length && meterWaste < bestMeterWaste)) {
        best = bins.map((bin) => [...bin])
        bestMeterWaste = meterWaste
      }
      return
    }

    const freeHeight = bins.reduce(
      (total, bin) => total + PANEL_SPACE_COUNT - columnUsedSpaces(bin),
      0,
    )
    const requiredNewBins = Math.ceil(
      Math.max(0, remainingTotals[itemIndex] - freeHeight) / PANEL_SPACE_COUNT,
    )
    if (bins.length + requiredNewBins > best.length) {
      return
    }

    const item = sorted[itemIndex]
    const itemSpaces = getLoadOption(item).spaces
    const triedRemainders = new Set<number>()

    for (let index = 0; index < bins.length; index += 1) {
      const remainder = PANEL_SPACE_COUNT - columnUsedSpaces(bins[index])
      if (remainder < itemSpaces || triedRemainders.has(remainder)) {
        continue
      }
      triedRemainders.add(remainder)
      bins[index].push(item)
      search(itemIndex + 1, bins)
      bins[index].pop()
    }

    if (bins.length < best.length) {
      bins.push([item])
      search(itemIndex + 1, bins)
      bins.pop()
    }
  }

  search(0, seeds.map((seed) => [...seed]))
  return best
}

function dedicatedColumn(load: PanelLoad): PanelColumn {
  const role = load.typeId === 'power-in' || load.typeId === 'generator'
    ? load.typeId
    : 'tie-breaker'

  return {
    id: `column-${load.id}`,
    role,
    widthIn: getLoadOption(load).widthIn ?? POWER_COLUMN_WIDTH_IN,
    loads: [load],
  }
}

function tieBusTransitionColumn(tieLoad: PanelLoad): PanelColumn {
  return {
    id: `tie-bus-transition-${tieLoad.id}`,
    role: 'tie-bus-transition',
    widthIn: TIE_BUS_TRANSITION_COLUMN_WIDTH_IN,
    loads: [],
  }
}

function buildAutomaticPanelLayout(loads: PanelLoad[]): PanelLayout {
  const powerLoads = loads.filter((load) => load.typeId === 'power-in')
  const generatorLoads = loads.filter((load) => load.typeId === 'generator')
  const tieLoads = loads.filter((load) => load.typeId === 'tie-breaker')
  const meterLoads = loads.filter((load) => load.typeId === 'metering')
  const modularLoads = loads.filter(
    (load) => !['power-in', 'generator', 'tie-breaker', 'metering'].includes(load.typeId),
  )
  const packedBins = packStandardLoads(modularLoads, meterLoads)
  const meterColumns = packedBins.slice(0, meterLoads.length).map((bin, index) => ({
    id: `meter-column-${index}`,
    role: 'transition' as const,
    widthIn: TRANSITION_COLUMN_WIDTH_IN,
    loads: bin,
  }))
  const standardColumns = packedBins.slice(meterLoads.length).map((bin, index) => ({
    id: `standard-column-${index}`,
    role: 'standard' as const,
    widthIn: STANDARD_COLUMN_WIDTH_IN,
    loads: bin,
  }))
  const columns: PanelColumn[] = []

  powerLoads.forEach((powerLoad, index) => {
    columns.push(dedicatedColumn(powerLoad))
    if (meterColumns[index]) {
      columns.push(meterColumns[index])
    }
  })
  columns.push(...meterColumns.slice(powerLoads.length))
  columns.push(...generatorLoads.map(dedicatedColumn))
  tieLoads.forEach((tieLoad) => {
    columns.push(dedicatedColumn(tieLoad), tieBusTransitionColumn(tieLoad))
  })
  columns.push(...standardColumns)

  const equipmentWidthIn = columns.reduce((total, column) => total + column.widthIn, 0)
  const widthIn = columns.length > 0
    ? equipmentWidthIn + END_SECTION_WIDTH_IN * 2
    : 0
  const structuralTransitionCount = columns.filter(
    (column) => column.role === 'tie-bus-transition',
  ).length
  const usedSpaces = loads.reduce((total, load) => total + getLoadOption(load).spaces, 0)
    + structuralTransitionCount * PANEL_SPACE_COUNT
  const capacitySpaces = columns.length * PANEL_SPACE_COUNT
  const usedHeightIn = usedSpaces * SPACE_HEIGHT_IN
  const capacityHeightIn = capacitySpaces * SPACE_HEIGHT_IN

  return {
    columns,
    widthIn,
    usedSpaces,
    capacitySpaces,
    usedHeightIn,
    capacityHeightIn,
    utilization: capacityHeightIn === 0 ? 0 : usedHeightIn / capacityHeightIn,
  }
}

function manualColumn(loads: PanelLoad[], columnNumber: number): PanelColumn {
  return {
    id: `manual-column-${columnNumber}`,
    role: 'standard',
    widthIn: Math.max(
      STANDARD_COLUMN_WIDTH_IN,
      ...loads.map((load) => getLoadOption(load).widthIn ?? STANDARD_COLUMN_WIDTH_IN),
    ),
    loads,
  }
}

/**
 * Builds the panel while reserving user-selected columns before placing automatic
 * loads. Automatic packing can therefore never move or consume a manually placed
 * drawer.
 */
export function buildPanelLayout(loads: PanelLoad[]): PanelLayout {
  const manuallyPlacedLoads = loads.filter(
    (load) => Number.isInteger(load.manualColumn) && (load.manualColumn ?? 0) > 0,
  )
  if (manuallyPlacedLoads.length === 0) {
    return buildAutomaticPanelLayout(loads)
  }

  const automaticLoads = loads.filter((load) => !manuallyPlacedLoads.includes(load))
  const automaticLayout = buildAutomaticPanelLayout(automaticLoads)
  const manualGroups = new Map<number, PanelLoad[]>()

  manuallyPlacedLoads.forEach((load) => {
    const columnNumber = load.manualColumn as number
    const group = manualGroups.get(columnNumber) ?? []
    group.push(load)
    manualGroups.set(columnNumber, group)
  })

  const columnSlots: Array<PanelColumn | undefined> = []
  manualGroups.forEach((manualLoads, columnNumber) => {
    columnSlots[columnNumber - 1] = manualColumn(manualLoads, columnNumber)
  })

  // Keep the structural two-column pairs together when a reserved column falls
  // in the middle of their former position.
  const automaticBlocks: PanelColumn[][] = []
  for (let index = 0; index < automaticLayout.columns.length; index += 1) {
    const column = automaticLayout.columns[index]
    const nextColumn = automaticLayout.columns[index + 1]
    const isStructuralPair = nextColumn && (
      (column.role === 'power-in' && nextColumn.role === 'transition')
      || (column.role === 'tie-breaker' && nextColumn.role === 'tie-bus-transition')
    )
    if (isStructuralPair) {
      automaticBlocks.push([column, nextColumn])
      index += 1
    } else {
      automaticBlocks.push([column])
    }
  }

  let slotIndex = 0
  automaticBlocks.forEach((block) => {
    while (block.some((_, offset) => columnSlots[slotIndex + offset])) {
      slotIndex += 1
    }
    block.forEach((column, offset) => {
      columnSlots[slotIndex + offset] = column
    })
    slotIndex += block.length
  })

  const columns: PanelColumn[] = columnSlots.map((column, index) => column ?? ({
    id: `empty-column-${index + 1}`,
    role: 'standard' as const,
    widthIn: STANDARD_COLUMN_WIDTH_IN,
    loads: [],
  }))

  const equipmentWidthIn = columns.reduce((total, column) => total + column.widthIn, 0)
  const widthIn = equipmentWidthIn + END_SECTION_WIDTH_IN * 2
  const structuralTransitionCount = columns.filter(
    (column) => column.role === 'tie-bus-transition',
  ).length
  const usedSpaces = loads.reduce((total, load) => total + getLoadOption(load).spaces, 0)
    + structuralTransitionCount * PANEL_SPACE_COUNT
  const capacitySpaces = columns.length * PANEL_SPACE_COUNT
  const usedHeightIn = usedSpaces * SPACE_HEIGHT_IN
  const capacityHeightIn = capacitySpaces * SPACE_HEIGHT_IN

  return {
    columns,
    widthIn,
    usedSpaces,
    capacitySpaces,
    usedHeightIn,
    capacityHeightIn,
    utilization: usedHeightIn / capacityHeightIn,
  }
}
