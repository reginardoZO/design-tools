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
  isAutomaticSpare?: boolean
  equipped?: boolean
}

export type PanelColumnKind = 'INFRA' | 'CARGA'

export interface PanelColumn {
  id: string
  role:
    | 'standard'
    | 'power-in'
    | 'generator'
    | 'tie-breaker'
    | 'transition'
    | 'tie-bus-transition'
    | 'infrastructure'
    | 'tie-auxiliary'
  kind: PanelColumnKind
  widthIn: number
  loads: PanelLoad[]
  emptyLoadWarning?: boolean
}

export interface PanelLayout {
  columns: PanelColumn[]
  widthIn: number
  usedSpaces: number
  capacitySpaces: number
  usedHeightIn: number
  capacityHeightIn: number
  utilization: number
  baseLoadSpaces: number
  spareTargetSpaces: number
  spareSpaces: number
  loadColumnCount: number
  emptyLoadColumnCount: number
}

export interface PanelLayoutOptions {
  automaticSpares?: boolean
  minimumLoadColumns?: number
}

export const PANEL_SPACE_COUNT = 12
export const SPACE_HEIGHT_IN = 7.5
export const STANDARD_COLUMN_WIDTH_IN = 20.078
export const POWER_COLUMN_WIDTH_IN = 24.078
export const TRANSITION_COLUMN_WIDTH_IN = 20.078
export const TIE_BUS_TRANSITION_COLUMN_WIDTH_IN = TRANSITION_COLUMN_WIDTH_IN
export const END_SECTION_WIDTH_IN = 4.156
export const PANEL_HEIGHT_IN = PANEL_SPACE_COUNT * SPACE_HEIGHT_IN
export const SPARE_PERCENTAGE = 0.2
export const VALID_SPARE_SIZES = [12, 6, 3, 2, 1] as const

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

const INFRA_LOAD_TYPES: LoadTypeId[] = [
  'power-in',
  'generator',
  'metering',
  'rly-pnl',
  'transfer-control',
  'tie-breaker',
]

export function isRealLoad(load: PanelLoad) {
  return load.typeId !== 'spare' && !INFRA_LOAD_TYPES.includes(load.typeId)
}

function dedicatedColumn(load: PanelLoad): PanelColumn {
  const role = load.typeId === 'power-in' || load.typeId === 'generator'
    ? load.typeId
    : 'tie-breaker'
  return {
    id: `column-${load.id}`,
    role,
    kind: 'INFRA',
    widthIn: getLoadOption(load).widthIn ?? POWER_COLUMN_WIDTH_IN,
    loads: [load],
  }
}

function meteringColumn(load: PanelLoad): PanelColumn {
  return {
    id: `meter-column-${load.id}`,
    role: 'transition',
    kind: 'INFRA',
    widthIn: TRANSITION_COLUMN_WIDTH_IN,
    loads: [load],
  }
}

function tieBusTransitionColumn(tieLoad: PanelLoad): PanelColumn {
  return {
    id: `tie-bus-transition-${tieLoad.id}`,
    role: 'tie-bus-transition',
    kind: 'INFRA',
    widthIn: TIE_BUS_TRANSITION_COLUMN_WIDTH_IN,
    loads: [],
  }
}

function packedColumns(loads: PanelLoad[], kind: PanelColumnKind, idPrefix: string) {
  return packStandardLoads(loads, []).map((bin, index): PanelColumn => ({
    id: `${idPrefix}-${index}`,
    role: kind === 'INFRA' ? 'infrastructure' : 'standard',
    kind,
    widthIn: STANDARD_COLUMN_WIDTH_IN,
    loads: bin,
  }))
}

function buildAutomaticColumns(loads: PanelLoad[]) {
  const powerLoads = loads.filter((load) => load.typeId === 'power-in')
  const generatorLoads = loads.filter((load) => load.typeId === 'generator')
  const tieLoads = loads.filter((load) => load.typeId === 'tie-breaker')
  const meterLoads = loads.filter((load) => load.typeId === 'metering')
  const tieAuxiliaryIds = new Set(
    loads
      .filter((load) => load.typeId === 'rly-pnl' && tieLoads.some((tie) => tie.id === load.parentLoadId))
      .map((load) => load.id),
  )
  const pairedMeterIds = new Set<string>()
  const meterForPower = new Map<string, PanelLoad>()

  powerLoads.forEach((powerLoad) => {
    const meter = meterLoads.find((candidate) =>
      !pairedMeterIds.has(candidate.id) && candidate.parentLoadId === powerLoad.id,
    ) ?? meterLoads.find((candidate) => !pairedMeterIds.has(candidate.id))
    if (meter) {
      meterForPower.set(powerLoad.id, meter)
      pairedMeterIds.add(meter.id)
    }
  })

  const powerPair = (powerLoad: PanelLoad, reverse = false) => {
    const pair = [dedicatedColumn(powerLoad)]
    const meter = meterForPower.get(powerLoad.id)
    if (meter) {
      pair.push(meteringColumn(meter))
    }
    return reverse ? pair.reverse() : pair
  }

  const leftEdge = powerLoads[0] ? powerPair(powerLoads[0]) : []
  const rightEdge = powerLoads[1] ? powerPair(powerLoads[1], true) : []
  const extraPowerColumns = powerLoads.slice(2).flatMap((powerLoad) => powerPair(powerLoad))
  const unpairedMeterColumns = meterLoads
    .filter((meter) => !pairedMeterIds.has(meter.id))
    .map(meteringColumn)

  const infrastructureLoads = loads.filter((load) =>
    INFRA_LOAD_TYPES.includes(load.typeId)
    && !['power-in', 'generator', 'metering', 'tie-breaker'].includes(load.typeId)
    && !tieAuxiliaryIds.has(load.id),
  )
  const realLoadColumns = packedColumns(
    loads.filter((load) => isRealLoad(load) || load.typeId === 'spare'),
    'CARGA',
    'load-column',
  )
  const infrastructureColumns = packedColumns(infrastructureLoads, 'INFRA', 'infra-column')
  const middleColumns: PanelColumn[] = [
    ...extraPowerColumns,
    ...generatorLoads.map(dedicatedColumn),
    ...unpairedMeterColumns,
    ...infrastructureColumns,
    ...realLoadColumns,
  ]
  const tieColumns = tieLoads.flatMap((tieLoad): PanelColumn[] => {
    const auxiliaryLoads = loads.filter((load) => load.parentLoadId === tieLoad.id && load.typeId === 'rly-pnl')
    const auxiliaryColumn: PanelColumn[] = auxiliaryLoads.length > 0 ? [{
      id: `tie-auxiliary-${tieLoad.id}`,
      role: 'tie-auxiliary',
      kind: 'INFRA',
      widthIn: STANDARD_COLUMN_WIDTH_IN,
      loads: auxiliaryLoads,
    }] : []
    return [...auxiliaryColumn, dedicatedColumn(tieLoad), tieBusTransitionColumn(tieLoad)]
  })

  middleColumns.splice(Math.ceil(middleColumns.length / 2), 0, ...tieColumns)
  return [...leftEdge, ...middleColumns, ...rightEdge]
}

function manualColumn(loads: PanelLoad[], columnNumber: number): PanelColumn {
  const kind = loads.some((load) => isRealLoad(load) || load.typeId === 'spare') ? 'CARGA' : 'INFRA'
  return {
    id: `manual-column-${columnNumber}`,
    role: kind === 'CARGA' ? 'standard' : 'infrastructure',
    kind,
    widthIn: Math.max(
      STANDARD_COLUMN_WIDTH_IN,
      ...loads.map((load) => getLoadOption(load).widthIn ?? STANDARD_COLUMN_WIDTH_IN),
    ),
    loads,
  }
}

function automaticBlocks(columns: PanelColumn[]) {
  const blocks: PanelColumn[][] = []
  for (let index = 0; index < columns.length; index += 1) {
    const column = columns[index]
    const next = columns[index + 1]
    const afterNext = columns[index + 2]
    if (column.role === 'tie-auxiliary' && next?.role === 'tie-breaker' && afterNext?.role === 'tie-bus-transition') {
      blocks.push([column, next, afterNext])
      index += 2
    } else if (
      next && (
        (column.role === 'power-in' && next.role === 'transition')
        || (column.role === 'transition' && next.role === 'power-in')
        || (column.role === 'tie-breaker' && next.role === 'tie-bus-transition')
      )
    ) {
      blocks.push([column, next])
      index += 1
    } else {
      blocks.push([column])
    }
  }
  return blocks
}

function rightEdgeStart(columns: PanelColumn[]) {
  const lastIndex = columns.length - 1
  if (columns[lastIndex]?.role !== 'power-in') {
    return columns.length
  }
  return columns[lastIndex - 1]?.role === 'transition' ? lastIndex - 1 : lastIndex
}

function emptyLoadColumn(id: string): PanelColumn {
  return {
    id,
    role: 'standard',
    kind: 'CARGA',
    widthIn: STANDARD_COLUMN_WIDTH_IN,
    loads: [],
  }
}

function ensureMinimumLoadColumns(columns: PanelColumn[], minimum: number) {
  const next = [...columns]
  let missing = Math.max(0, minimum - next.filter((column) => column.kind === 'CARGA').length)
  while (missing > 0) {
    next.splice(rightEdgeStart(next), 0, emptyLoadColumn(`retained-load-column-${missing}`))
    missing -= 1
  }
  return next
}

function spareUnits(baseSpaces: number, largestLoad: number) {
  if (baseSpaces === 0 || largestLoad === 0) {
    return { target: 0, sizes: [] as number[] }
  }
  const dominantSize = [...VALID_SPARE_SIZES]
    .reverse()
    .find((size) => size >= largestLoad) ?? PANEL_SPACE_COUNT
  const target = Math.max(Math.ceil(baseSpaces * SPARE_PERCENTAGE), dominantSize)
  const sizes = [dominantSize]
  let remaining = target - dominantSize
  VALID_SPARE_SIZES.forEach((size) => {
    while (remaining >= size) {
      sizes.push(size)
      remaining -= size
    }
  })
  return { target, sizes: sizes.sort((first, second) => second - first) }
}

function addAutomaticSpares(columns: PanelColumn[]) {
  const withoutSpares = columns.map((column) => ({
    ...column,
    loads: column.loads.filter((load) => load.typeId !== 'spare' && !load.isAutomaticSpare),
  }))
  const realLoads = withoutSpares
    .filter((column) => column.kind === 'CARGA')
    .flatMap((column) => column.loads.filter(isRealLoad))
  const baseSpaces = realLoads.reduce((total, load) => total + getLoadOption(load).spaces, 0)
  const largestLoad = realLoads.reduce(
    (largest, load) => Math.max(largest, getLoadOption(load).spaces),
    0,
  )
  const { target, sizes } = spareUnits(baseSpaces, largestLoad)

  sizes.forEach((size, index) => {
    const candidates = withoutSpares
      .map((column, columnIndex) => ({
        column,
        columnIndex,
        free: PANEL_SPACE_COUNT - columnUsedSpaces(column.loads),
      }))
      .filter(({ column, free }) => column.kind === 'CARGA' && free >= size)
      .sort((first, second) => first.free - second.free)
    let targetColumn = candidates[0]?.column
    if (!targetColumn) {
      targetColumn = emptyLoadColumn(`automatic-spare-column-${index}`)
      withoutSpares.splice(rightEdgeStart(withoutSpares), 0, targetColumn)
    }
    targetColumn.loads.push({
      id: `automatic-spare-${size}-${index}`,
      typeId: 'spare',
      optionId: `${size}-spaces`,
      isAutomaticSpare: true,
      equipped: true,
    })
  })

  return { columns: withoutSpares, target, baseSpaces }
}

function arrangeFinalColumns(columns: PanelColumn[]) {
  if (columns.length === 0) {
    return columns
  }
  const slots: Array<PanelColumn | undefined> = new Array(columns.length)
  const placed = new Set<PanelColumn>()
  const placeBlock = (block: PanelColumn[], start: number) => {
    block.forEach((column, offset) => {
      slots[start + offset] = column
      placed.add(column)
    })
  }

  const leftBlock = columns[0]?.role === 'power-in'
    ? columns.slice(0, columns[1]?.role === 'transition' ? 2 : 1)
    : []
  const lastIndex = columns.length - 1
  const rightBlock = columns[lastIndex]?.role === 'power-in'
    ? columns.slice(columns[lastIndex - 1]?.role === 'transition' ? lastIndex - 1 : lastIndex)
    : []
  if (leftBlock.length > 0) {
    placeBlock(leftBlock, 0)
  }
  if (rightBlock.length > 0) {
    placeBlock(rightBlock, columns.length - rightBlock.length)
  }

  columns.filter((column) => column.id.startsWith('manual-column-')).forEach((column) => {
    const target = Number(column.id.slice('manual-column-'.length)) - 1
    if (target >= 0 && target < slots.length && !slots[target]) {
      placeBlock([column], target)
    }
  })

  const tieBlocks = automaticBlocks(columns).filter((block) =>
    block.some((column) => column.role === 'tie-breaker'),
  )
  tieBlocks.forEach((block) => {
    const lineupCenter = (columns.length - 1) / 2
    const candidates = Array.from(
      { length: columns.length - block.length + 1 },
      (_, start) => start,
    ).filter((start) => block.every((_, offset) => !slots[start + offset]))
    const bestStart = candidates.sort((first, second) => {
      const firstDistance = Math.abs(first + (block.length - 1) / 2 - lineupCenter)
      const secondDistance = Math.abs(second + (block.length - 1) / 2 - lineupCenter)
      return firstDistance - secondDistance
    })[0]
    if (bestStart !== undefined) {
      placeBlock(block, bestStart)
    }
  })

  const remaining = columns.filter((column) => !placed.has(column))
  for (let index = 0; index < slots.length; index += 1) {
    if (!slots[index]) {
      slots[index] = remaining.shift()
    }
  }
  return slots.filter((column): column is PanelColumn => Boolean(column))
}

function finalizeLayout(
  inputColumns: PanelColumn[],
  automaticSpares: boolean,
): PanelLayout {
  const spareResult = automaticSpares
    ? addAutomaticSpares(inputColumns)
    : {
        columns: inputColumns.map((column) => ({
          ...column,
          loads: column.loads.map((load) => load.typeId === 'spare' ? { ...load, equipped: true } : load),
        })),
        target: 0,
        baseSpaces: inputColumns
          .filter((column) => column.kind === 'CARGA')
          .flatMap((column) => column.loads)
          .filter(isRealLoad)
          .reduce((total, load) => total + getLoadOption(load).spaces, 0),
      }
  const columns = arrangeFinalColumns(spareResult.columns).map((column) => ({
    ...column,
    emptyLoadWarning: column.kind === 'CARGA' && column.loads.length === 0,
  }))
  const structuralTransitionCount = columns.filter((column) => column.role === 'tie-bus-transition').length
  const usedSpaces = columns.reduce(
    (total, column) => total + columnUsedSpaces(column.loads),
    structuralTransitionCount * PANEL_SPACE_COUNT,
  )
  const capacitySpaces = columns.length * PANEL_SPACE_COUNT
  const usedHeightIn = usedSpaces * SPACE_HEIGHT_IN
  const capacityHeightIn = capacitySpaces * SPACE_HEIGHT_IN
  const equipmentWidthIn = columns.reduce((total, column) => total + column.widthIn, 0)
  const spareSpaces = columns
    .flatMap((column) => column.loads)
    .filter((load) => load.typeId === 'spare')
    .reduce((total, load) => total + getLoadOption(load).spaces, 0)
  const loadColumns = columns.filter((column) => column.kind === 'CARGA')

  return {
    columns,
    widthIn: columns.length > 0 ? equipmentWidthIn + END_SECTION_WIDTH_IN * 2 : 0,
    usedSpaces,
    capacitySpaces,
    usedHeightIn,
    capacityHeightIn,
    utilization: capacityHeightIn === 0 ? 0 : usedHeightIn / capacityHeightIn,
    baseLoadSpaces: spareResult.baseSpaces,
    spareTargetSpaces: spareResult.target,
    spareSpaces,
    loadColumnCount: loadColumns.length,
    emptyLoadColumnCount: loadColumns.filter((column) => column.emptyLoadWarning).length,
  }
}

/** Build a deterministic lineup, then add equipped spare buckets as the final allocation step. */
export function buildPanelLayout(loads: PanelLoad[], options: PanelLayoutOptions = {}): PanelLayout {
  const automaticSpares = options.automaticSpares ?? true
  const manuallyPlacedLoads = loads.filter(
    (load) => Number.isInteger(load.manualColumn) && (load.manualColumn ?? 0) > 0,
  )
  const automaticLoads = loads.filter((load) => !manuallyPlacedLoads.includes(load))
  const automaticColumns = buildAutomaticColumns(automaticLoads)
  let columns = automaticColumns

  if (manuallyPlacedLoads.length > 0) {
    const manualGroups = new Map<number, PanelLoad[]>()
    manuallyPlacedLoads.forEach((load) => {
      const columnNumber = load.manualColumn as number
      manualGroups.set(columnNumber, [...(manualGroups.get(columnNumber) ?? []), load])
    })
    const slots: Array<PanelColumn | undefined> = []
    manualGroups.forEach((manualLoads, columnNumber) => {
      slots[columnNumber - 1] = manualColumn(manualLoads, columnNumber)
    })
    let slotIndex = 0
    automaticBlocks(automaticColumns).forEach((block) => {
      while (block.some((_, offset) => slots[slotIndex + offset])) {
        slotIndex += 1
      }
      block.forEach((column, offset) => {
        slots[slotIndex + offset] = column
      })
      slotIndex += block.length
    })
    columns = slots.map((column, index) => column ?? emptyLoadColumn(`empty-column-${index + 1}`))
  }

  columns = ensureMinimumLoadColumns(columns, options.minimumLoadColumns ?? 0)
  return finalizeLayout(columns, automaticSpares)
}
