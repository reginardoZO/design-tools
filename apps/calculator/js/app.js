/**
 * Load Current Calculator
 * 
 * Calculates electrical current from load parameters with support for:
 * - Multiple power units (kW, HP, kVA, kVAr)
 * - System types (1Φ, 2Φ, 3Φ)
 * - Power factor and efficiency
 * - Automatic unit conversion and recalculation
 */

// ==================== CONSTANTS ====================

const CONVERSION_FACTORS = {
  HP_TO_KW: 0.746, // 1 HP = 0.746 kW
};

const SQRT3 = Math.sqrt(3);

// ==================== DOM SELECTORS ====================

const getElements = () => ({
  systemType: document.getElementById('systemType'),
  voltage: document.getElementById('voltage'),
  power: document.getElementById('power'),
  powerUnit: document.getElementById('powerUnit'),
  powerFactor: document.getElementById('powerFactor'),
  efficiency: document.getElementById('efficiency'),
  
  currentResult: document.getElementById('currentResult'),
  detailSystem: document.getElementById('detailSystem'),
  detailVoltage: document.getElementById('detailVoltage'),
  detailNominalPower: document.getElementById('detailNominalPower'),
  detailEfficiency: document.getElementById('detailEfficiency'),
  detailInputPower: document.getElementById('detailInputPower'),
  detailPowerFactor: document.getElementById('detailPowerFactor'),
  detailFormula: document.getElementById('detailFormula'),
});

// ==================== CALCULATION FUNCTIONS ====================

/**
 * Converts power to kW based on the power unit
 * @param {number} power - Power value
 * @param {string} unit - Power unit (kW, HP, kVA, kVAr)
 * @param {number} powerFactor - Power factor for conversions
 * @returns {number} Power in kW
 */
function convertPowerToKW(power, unit, powerFactor) {
  switch (unit) {
    case 'kW':
      return power;
    
    case 'HP':
      return power * CONVERSION_FACTORS.HP_TO_KW;
    
    case 'kVA':
      // kW = kVA × cos(φ)
      return power * powerFactor;
    
    case 'kVAr':
      // From kVAr to kW using relationship: kVA² = kW² + kVAr²
      // cos(φ) = kW / kVA, so kW = kVA × cos(φ)
      // sin(φ) = kVAr / kVA
      // cos(φ) = sqrt(1 - sin²(φ)) = sqrt(1 - (kVAr/kVA)²)
      // We need to find kW and kVA from kVAr and power factor
      // If power factor is given, we assume it's for the real power
      // kVAr = kVA × sin(φ), and sin(φ) = sqrt(1 - cos²(φ))
      // So: kVA = kVAr / sqrt(1 - cos²(φ)) = kVAr / sin(φ)
      const sinPhi = Math.sqrt(1 - powerFactor * powerFactor);
      const kVAFromKVAr = power / sinPhi;
      return kVAFromKVAr * powerFactor;
    
    default:
      return power;
  }
}

/**
 * Calculates input power considering efficiency
 * @param {number} nominalPowerKW - Nominal power in kW
 * @param {number} efficiency - Efficiency (0-1)
 * @returns {number} Input power in kW
 */
function calculateInputPower(nominalPowerKW, efficiency) {
  if (efficiency <= 0 || efficiency > 1) return nominalPowerKW;
  return nominalPowerKW / efficiency;
}

/**
 * Calculates current based on system type and power parameters
 * @param {string} systemType - System type ('1', '2', '3' for Φ)
 * @param {number} voltage - Voltage in volts
 * @param {number} inputPowerKW - Input power in kW
 * @param {number} powerFactor - Power factor (cos φ)
 * @returns {{current: number, formula: string}}
 */
function calculateCurrent(systemType, voltage, inputPowerKW, powerFactor) {
  let current;
  let formula;
  
  // Formula: I = P / (V × √n × PF)
  // Where n = 1 for monofásico, 2 for bifásico, 3 for trifásico (with √3)
  
  switch (systemType) {
    case '1':
      // Monofásico: I = P / (V × PF)
      current = (inputPowerKW * 1000) / (voltage * powerFactor);
      formula = 'I = P / (V × PF)';
      break;
    
    case '2':
      // Bifásico: I = P / (2 × V × PF)
      current = (inputPowerKW * 1000) / (2 * voltage * powerFactor);
      formula = 'I = P / (2 × V × PF)';
      break;
    
    case '3':
    default:
      // Trifásico: I = P / (√3 × V × PF)
      current = (inputPowerKW * 1000) / (SQRT3 * voltage * powerFactor);
      formula = 'I = P / (√3 × V × PF)';
      break;
  }
  
  return { current, formula };
}

/**
 * Formats a number with appropriate precision
 * @param {number} value - Value to format
 * @param {number} decimals - Number of decimal places
 * @returns {string}
 */
function formatNumber(value, decimals = 2) {
  if (!Number.isFinite(value)) return '—';
  const formatted = value.toFixed(decimals);
  // Remove trailing zeros but keep at least one decimal place if decimals > 0
  if (decimals > 0) {
    return formatted.replace(/(\.\d*[1-9])0+$|\.0+$/, '$1');
  }
  return formatted;
}

/**
 * Gets system type label
 * @param {string} systemType - System type code
 * @returns {string}
 */
function getSystemLabel(systemType) {
  const labels = {
    '1': 'Single Phase (1Φ)',
    '2': 'Two Phase (2Φ)',
    '3': 'Three Phase (3Φ)',
  };
  return labels[systemType] || '—';
}

// ==================== UI UPDATE FUNCTIONS ====================

/**
 * Performs all calculations and updates the UI
 */
function updateCalculation() {
  const els = getElements();
  
  // Get input values
  const systemType = els.systemType.value;
  const voltage = parseFloat(els.voltage.value) || 0;
  const power = parseFloat(els.power.value) || 0;
  const powerUnit = els.powerUnit.value;
  const powerFactor = parseFloat(els.powerFactor.value) || 1;
  const efficiency = parseFloat(els.efficiency.value) || 1;
  
  // Validation
  if (voltage <= 0 || power <= 0 || powerFactor <= 0 || efficiency <= 0) {
    els.currentResult.textContent = '—';
    updateDetails('—', '—', '—', '—', '—', '—', '—');
    return;
  }
  
  // Calculations
  const powerKW = convertPowerToKW(power, powerUnit, powerFactor);
  const inputPowerKW = calculateInputPower(powerKW, efficiency);
  const { current, formula } = calculateCurrent(systemType, voltage, inputPowerKW, powerFactor);
  
  // Update output
  els.currentResult.textContent = formatNumber(current, 2);
  
  // Update details
  updateDetails(
    getSystemLabel(systemType),
    `${formatNumber(voltage, 1)} V`,
    `${formatNumber(power, 2)} ${powerUnit}`,
    `${formatNumber(efficiency * 100, 1)} %`,
    `${formatNumber(inputPowerKW, 2)} kW`,
    `${formatNumber(powerFactor, 3)}`,
    formula
  );
}

/**
 * Updates detail fields in the output panel
 */
function updateDetails(system, voltage, nominalPower, efficiency, inputPower, powerFactor, formula) {
  const els = getElements();
  els.detailSystem.textContent = system;
  els.detailVoltage.textContent = voltage;
  els.detailNominalPower.textContent = nominalPower;
  els.detailEfficiency.textContent = efficiency;
  els.detailInputPower.textContent = inputPower;
  els.detailPowerFactor.textContent = powerFactor;
  els.detailFormula.textContent = formula;
}

// ==================== EVENT LISTENERS ====================

function setupEventListeners() {
  const els = getElements();
  const inputs = [
    els.systemType,
    els.voltage,
    els.power,
    els.powerUnit,
    els.powerFactor,
    els.efficiency,
  ];
  
  inputs.forEach((input) => {
    input.addEventListener('change', updateCalculation);
    input.addEventListener('input', updateCalculation);
  });
}

// ==================== INITIALIZATION ====================

document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  updateCalculation();
});
