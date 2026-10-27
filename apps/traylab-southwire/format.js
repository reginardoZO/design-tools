// U.S. presentation conventions shared by the interface and exports.
export const formatNumber = (value, digits = 2) => value === Infinity ? '∞' :
  Number.isFinite(value) ? new Intl.NumberFormat('en-US', {
    maximumFractionDigits: digits, minimumFractionDigits: digits
  }).format(value) : '—';

export const formatInteger = value => new Intl.NumberFormat('en-US').format(value || 0);
export const dimension = value => `${formatNumber(value, 3)} in`;

export function conductorSize(cable) {
  const size = String(cable.size ?? '').trim().replace(/\s*(?:AWG|kcmil|MCM)\s*$/i, '').replace(/^#\s*/, '');
  const unit = /(?:kcmil|MCM)/i.test(String(cable.size)) || Number(cable.sizeKcmil) >= 250 ? 'kcmil' : 'AWG';
  return `${size} ${unit}`;
}

export const cableSize = cable => `${cable.conductors || '?'}C × ${conductorSize(cable)}`;
