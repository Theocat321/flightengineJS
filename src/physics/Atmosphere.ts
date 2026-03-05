/**
 * ISA Standard Atmosphere model (ICAO 1993).
 * Valid from 0 to ~86 km.
 */

const T0   = 288.15;  // K, sea level temperature
const P0   = 101325;  // Pa, sea level pressure
const RHO0 = 1.225;   // kg/m³, sea level density
const L    = 0.0065;  // K/m, temperature lapse rate (troposphere)
const g    = 9.80665; // m/s²
const R    = 287.058; // J/(kg·K), specific gas constant for air
const GAMMA = 1.4;    // adiabatic index
const TROPOPAUSE = 11000; // m

/**
 * Temperature at altitude (K).
 */
export function airTemperature(altitudeMetres: number): number {
  const alt = Math.max(0, altitudeMetres);
  if (alt <= TROPOPAUSE) {
    return T0 - L * alt;
  }
  // Stratosphere: isothermal at 216.65 K up to 20 km
  return 216.65;
}

/**
 * Air pressure at altitude (Pa).
 */
export function airPressure(altitudeMetres: number): number {
  const alt = Math.max(0, altitudeMetres);
  if (alt <= TROPOPAUSE) {
    return P0 * Math.pow(1 - (L * alt) / T0, (g / (R * L)));
  }
  // Exponential decay in stratosphere
  const P11 = P0 * Math.pow(1 - (L * TROPOPAUSE) / T0, (g / (R * L)));
  return P11 * Math.exp((-g * (alt - TROPOPAUSE)) / (R * 216.65));
}

/**
 * Air density at altitude (kg/m³).
 */
export function airDensity(altitudeMetres: number): number {
  const T = airTemperature(altitudeMetres);
  const P = airPressure(altitudeMetres);
  return P / (R * T);
}

/**
 * Speed of sound at altitude (m/s).
 */
export function speedOfSound(altitudeMetres: number): number {
  const T = airTemperature(altitudeMetres);
  return Math.sqrt(GAMMA * R * T);
}

/**
 * Mach number given true airspeed (m/s) and altitude (m).
 */
export function machNumber(trueAirspeed: number, altitudeMetres: number): number {
  return trueAirspeed / speedOfSound(altitudeMetres);
}
