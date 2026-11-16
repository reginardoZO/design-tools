const SQRT3 = Math.sqrt(3);

export function newMccLoad(type = "motor", id = `load-${Date.now()}`) {
  return {
    id,
    tag: "",
    type,
    quantity: 1,
    voltage: NaN,
    phases: 3,
    phasePair: "AB",
    duty: "continuous",
    motorCategory: "standard",
    horsepower: NaN,
    motorCurrent: NaN,
    motorJustification: "",
    driveInputCurrent: NaN,
    bypass: false,
    heaterCategory: "other",
    ratingUnit: "kW",
    rating: NaN,
    powerFactor: 1,
    transformerBasis: "rated",
    continuousPercent: NaN,
    primaryVoltage: NaN,
    secondaryVoltage: NaN,
    transformerSide: "primary",
  };
}

function validPositive(value) {
  return Number.isFinite(value) && value > 0;
}

function currentForPower(load, voltage) {
  const { phases, ratingUnit, rating, powerFactor = 1 } = load;
  if (!validPositive(voltage) || !validPositive(rating)) return NaN;
  if (ratingUnit === "A") return rating;
  if (ratingUnit === "kW" && !(powerFactor > 0 && powerFactor <= 1)) return NaN;
  const factor = phases === 3 ? SQRT3 : 1;
  if (ratingUnit === "kVA") return rating * 1000 / (factor * voltage);
  if (ratingUnit === "kW") return rating * 1000 / (factor * voltage * powerFactor);
  return NaN;
}

function error(errors, message) {
  errors.push(message);
}

export function calculateMccFeeder({ loads, voltage, phases, frequency = 60, lookupMotorFLC }) {
  const errors = [];
  const warnings = [];
  const loadResults = [];
  const currentsByPhase = phases === 3 ? { A: 0, B: 0, C: 0 } : { A: 0, B: 0 };
  const operatingCurrentByPhase = { ...currentsByPhase };

  if (!validPositive(voltage)) error(errors, "Enter a positive feeder system voltage.");
  if (![1, 3].includes(phases)) error(errors, "Select single-phase or three-phase feeder service.");
  if (![50, 60].includes(frequency)) error(errors, "System frequency must be 50 or 60 Hz.");
  if (!Array.isArray(loads) || loads.length === 0) error(errors, "Add at least one connected load.");
  if (voltage > 1000) error(errors, "Medium-voltage multiple-motor feeder sizing is not implemented; no conductor recommendation is issued (430.205 / Article 315).");
  warnings.push("No demand/diversity or noncoincident-load reduction is applied. Include all connected loads unless a separately documented Code-permitted exception is independently verified.");

  const motors = [];
  const nonmotorContributions = [];

  for (const [index, load] of (Array.isArray(loads) ? loads : []).entries()) {
    const tag = String(load.tag || `Load ${index + 1}`);
    const invalid = (message) => error(errors, `${tag}: ${message}`);
    if (!Number.isInteger(load.quantity) || load.quantity < 1 || load.quantity > 1000) {
      invalid("quantity must be a whole number from 1 through 1000.");
      continue;
    }
    if (![1, 3].includes(load.phases)) {
      invalid("select a supported phase configuration.");
      continue;
    }
    if (!validPositive(load.voltage) || Math.abs(load.voltage - voltage) > voltage * 0.01) {
      invalid("load voltage must match the feeder line-to-line reference within 1%.");
      continue;
    }
    if (phases === 1 && load.phases !== 1) {
      invalid("a three-phase load cannot be connected to a single-phase feeder.");
      continue;
    }
    if (phases === 3 && load.phases === 1 && !["AB", "BC", "CA"].includes(load.phasePair)) {
      invalid("assign the single-phase load to AB, BC, or CA.");
      continue;
    }

    let current = NaN;
    let motorLike = false;
    let basis = "";
    let applicableDuty = load.duty;
    if (load.type === "motor") {
      motorLike = true;
      if (load.duty !== "continuous") {
        invalid("short-time/intermittent/varying motor duty requires a verified 430.22(E) / 430.24 exception; this calculation is blocked.");
        continue;
      }
      if (load.motorCategory === "standard") {
        if (frequency !== 60) {
          invalid("standard motor table lookup is limited to 60 Hz; provide an applicable verified current basis.");
          continue;
        }
        current = typeof lookupMotorFLC === "function"
          ? lookupMotorFLC(load.horsepower, voltage, load.phases)
          : NaN;
        basis = `NEC ${load.phases === 3 ? "Table 430.250" : "Table 430.248"} FLC, 430.6(A)(1)`;
      } else if (["low-speed", "high-torque", "multispeed"].includes(load.motorCategory)
        && validPositive(load.motorCurrent) && String(load.motorJustification || "").trim()) {
        current = load.motorCurrent;
        basis = `Documented nameplate current for ${load.motorCategory} motor, 430.6(A)(1)`;
        warnings.push(`${tag}: verify the selected special motor category and documented current basis under 430.6(A)(1).`);
      } else {
        invalid("select a supported motor category and enter its valid NEC table FLC or justified permitted nameplate current.");
        continue;
      }
    } else if (load.type === "vfd") {
      motorLike = true;
      if (load.bypass) {
        invalid("VFD bypass conductors require a separate 430.122(C) evaluation; bypass sizing is not implemented.");
        continue;
      }
      current = load.driveInputCurrent;
      basis = "VFD rated input current, 430.122(D) with feeder calculation under 430.24";
    } else if (["heater", "general", "transformer"].includes(load.type)) {
      if (!["continuous", "noncontinuous"].includes(load.duty)) {
        invalid("select continuous or noncontinuous duty.");
        continue;
      }
      if (load.type === "heater" && ["process", "space"].includes(load.heaterCategory)) {
        applicableDuty = "continuous";
        if (load.duty !== "continuous") warnings.push(`${tag}: fixed ${load.heaterCategory} heating is treated as continuous; the entered duty cannot override its mandatory classification.`);
      }
      if (load.type === "transformer") {
        const selectedWindingVoltage = load.transformerSide === "secondary" ? load.secondaryVoltage : load.primaryVoltage;
        if (!validPositive(load.primaryVoltage) || !validPositive(load.secondaryVoltage)
          || !["primary", "secondary"].includes(load.transformerSide)
          || Math.abs(selectedWindingVoltage - voltage) > voltage * 0.01) {
          invalid("enter primary/secondary ratings and select the winding that matches the feeder voltage.");
          continue;
        }
        if (load.type === "transformer" && load.transformerBasis === "calculated"
          && !(Number.isFinite(load.continuousPercent) && load.continuousPercent >= 0 && load.continuousPercent <= 100)) {
          invalid("enter the continuous portion of the calculated load from 0% through 100%.");
          continue;
        }
      }
      if (load.type === "transformer" && load.transformerBasis === "rated") {
        current = currentForPower({ ...load, ratingUnit: "kVA" }, voltage);
        basis = "Transformer rated kVA at feeder winding voltage; operating duty entered by user";
        warnings.push(`${tag}: transformer winding protection under Article 450 and secondary-conductor rules under 240.21(C) are separate from this feeder ampacity calculation.`);
      } else {
        current = currentForPower(load, voltage);
        basis = load.type === "heater"
          ? `${load.ratingUnit} electrical input, ${load.heaterCategory === "other" ? "424 / 425 application review" : load.heaterCategory === "process" ? "425.4(B)" : "424.3(B)"}`
          : load.type === "transformer"
            ? "Calculated transformer load, 215.2; transformer protection remains separate"
            : "Calculated general load, 215.2";
      }
      const splitCalculatedTransformer = load.type === "transformer" && load.transformerBasis === "calculated";
      nonmotorContributions.push({
        load,
        current,
        quantity: load.quantity,
        duty: applicableDuty,
        continuousPercent: splitCalculatedTransformer ? load.continuousPercent : applicableDuty === "continuous" ? 100 : 0,
        tag,
      });
    } else {
      invalid("select motor, VFD, heater, transformer, or general load.");
      continue;
    }

    if (!validPositive(current)) {
      invalid(load.type === "motor"
        ? "no valid motor full-load current is available for this rating and voltage."
        : "enter valid equipment current or power data.");
      continue;
    }
    if (motorLike) {
      if (load.type === "vfd" && load.duty !== "continuous") {
        invalid("VFD input is treated as a motor contribution; noncontinuous drive duty is not modeled.");
        continue;
      }
      for (let unit = 0; unit < load.quantity; unit++) motors.push({ current, load, unit, tag, basis });
    }
    loadResults.push({
      id: load.id,
      tag,
      type: load.type,
      quantity: load.quantity,
      current,
      totalCurrent: current * load.quantity,
      basis,
      duty: applicableDuty,
    });
  }

  if (errors.length) return { valid: false, errors, warnings, loads: loadResults };

  const pairByPhase = { AB: ["A", "B"], BC: ["B", "C"], CA: ["C", "A"] };
  const phaseConductors = (load) => {
    if (phases === 1 || load.phases === 3) return Object.keys(currentsByPhase);
    return pairByPhase[load.phasePair];
  };
  const largestMotorByPhase = Object.fromEntries(Object.keys(currentsByPhase).map(phase => [phase, 0]));
  for (const motor of motors) {
    for (const phase of phaseConductors(motor.load)) {
      currentsByPhase[phase] += motor.current;
      operatingCurrentByPhase[phase] += motor.current;
      largestMotorByPhase[phase] = Math.max(largestMotorByPhase[phase], motor.current);
    }
  }
  for (const item of nonmotorContributions) {
    const continuousCurrent = item.current * item.quantity * item.continuousPercent / 100;
    const noncontinuousCurrent = item.current * item.quantity - continuousCurrent;
    for (const phase of phaseConductors(item.load)) {
      currentsByPhase[phase] += continuousCurrent * 1.25 + noncontinuousCurrent;
      operatingCurrentByPhase[phase] += item.current * item.quantity;
    }
  }

  const largestMotor = motors.reduce((largest, motor) => !largest || motor.current > largest.current ? motor : largest, null);
  // Each conductor must cover its own largest connected motor. A global tie
  // broken by list order could omit the extra 25% from the governing phase.
  for (const phase of Object.keys(currentsByPhase)) currentsByPhase[phase] += largestMotorByPhase[phase] * 0.25;
  const required = Math.max(...Object.values(currentsByPhase));
  const motorCurrent = motors.reduce((sum, motor) => sum + motor.current, 0);
  const nonmotorCurrent = nonmotorContributions.reduce((sum, item) => sum + item.current * item.quantity, 0);
  const continuousNonmotor = nonmotorContributions
    .reduce((sum, item) => sum + item.current * item.quantity * item.continuousPercent / 100, 0);
  const noncontinuousNonmotor = nonmotorContributions
    .reduce((sum, item) => sum + item.current * item.quantity * (1 - item.continuousPercent / 100), 0);
  const mixedSinglePhase = phases === 3 && loads.some(load => load.phases === 1);
  if (mixedSinglePhase) warnings.push("Mixed single-/three-phase loading is summed conservatively by conductor using assigned line pairs; vector cancellation is not credited.");

  return {
    valid: true,
    errors,
    warnings,
    loads: loadResults,
    required,
    totalConnectedCurrent: motorCurrent + nonmotorCurrent,
    motorCurrent,
    nonmotorCurrent,
    largestMotorCurrent: largestMotor?.current || 0,
    largestMotorTag: largestMotor?.tag || "",
    largestMotorContribution: largestMotor ? largestMotor.current * 1.25 : 0,
    remainingMotorCurrent: largestMotor ? motorCurrent - largestMotor.current : 0,
    continuousNonmotorCurrent: continuousNonmotor,
    continuousNonmotorContribution: continuousNonmotor * 1.25,
    noncontinuousNonmotorCurrent: noncontinuousNonmotor,
    currentsByPhase,
    largestMotorByPhase,
    mixedSinglePhase,
    operatingCurrentByPhase,
    operatingCurrent: Math.max(...Object.values(operatingCurrentByPhase)),
    basis: "For each conductor: 125% of its largest connected motor contribution + 100% of its remaining motors + 125% continuous nonmotor loads + 100% noncontinuous nonmotor loads (430.24); VFD input current under 430.122(D).",
    reference: "430.24; 430.6(A)(1); 430.22; 430.122(D); 215.2(A)(1)",
    protectionStatus: "Conductor ampacity calculated; feeder short-circuit/ground-fault protection verification remains separate and is not certified here (430.52 / 430.62).",
  };
}
