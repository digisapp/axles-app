// VIN Decoder utility
// VIN structure: https://en.wikipedia.org/wiki/Vehicle_identification_number

interface VINDecodeResult {
  year: number | null;
  make: string | null;
  country: string | null;
  isValid: boolean;
  error?: string;
}

// World Manufacturer Identifier (WMI) codes for truck manufacturers
const WMI_CODES: Record<string, string> = {
  // Peterbilt
  '1XP': 'Peterbilt',
  '2NP': 'Peterbilt',
  // Kenworth
  '1XK': 'Kenworth',
  '2NK': 'Kenworth',
  '3AK': 'Kenworth',
  // Freightliner
  '1FU': 'Freightliner',
  '1FV': 'Freightliner',
  '3AL': 'Freightliner',
  // Volvo
  '4V4': 'Volvo',
  '4VG': 'Volvo',
  '4VZ': 'Volvo',
  // Mack
  '1M1': 'Mack',
  '1M2': 'Mack',
  '1M9': 'Mack',
  // International
  '1HT': 'International',
  '3HS': 'International',
  // Western Star
  '5KK': 'Western Star',
  // Navistar
  '1NP': 'Navistar',
  '3HA': 'Navistar',
  // Ford
  '1FD': 'Ford',
  '1FT': 'Ford',
  '3FD': 'Ford',
  // Chevrolet/GMC
  '1GC': 'Chevrolet',
  '1GT': 'GMC',
  '3GC': 'Chevrolet',
  '3GT': 'GMC',
  // Ram/Dodge
  '1D7': 'Ram',
  '3D7': 'Ram',
  '3C6': 'Ram',
  // Hino
  '5PV': 'Hino',
  // Isuzu
  '4NV': 'Isuzu',
  'JAA': 'Isuzu',
  // Great Dane (Trailers)
  '1GR': 'Great Dane',
  // Utility (Trailers)
  '1UY': 'Utility Trailer',
  // Wabash (Trailers)
  '1JJ': 'Wabash',
  // Hyundai Translead
  '3H3': 'Hyundai Translead',
  // Stoughton (Trailers)
  '1S1': 'Stoughton',
  // Vanguard (Trailers)
  '5V8': 'Vanguard',
  // Caterpillar
  'CAT': 'Caterpillar',
  // John Deere
  '1DW': 'John Deere',
  // Komatsu
  'KMT': 'Komatsu',
};

// Year codes (position 10 of VIN)
const YEAR_CODES: Record<string, number> = {
  'A': 2010, 'B': 2011, 'C': 2012, 'D': 2013, 'E': 2014,
  'F': 2015, 'G': 2016, 'H': 2017, 'J': 2018, 'K': 2019,
  'L': 2020, 'M': 2021, 'N': 2022, 'P': 2023, 'R': 2024,
  'S': 2025, 'T': 2026, 'V': 2027, 'W': 2028, 'X': 2029,
  'Y': 2030, '1': 2031, '2': 2032, '3': 2033, '4': 2034,
  '5': 2035, '6': 2036, '7': 2037, '8': 2038, '9': 2039,
};

// Country codes (first character)
const COUNTRY_CODES: Record<string, string> = {
  '1': 'United States',
  '2': 'Canada',
  '3': 'Mexico',
  '4': 'United States',
  '5': 'United States',
  'J': 'Japan',
  'K': 'South Korea',
  'S': 'United Kingdom',
  'W': 'Germany',
  'Y': 'Sweden/Finland',
  'Z': 'Italy',
};

// Transliteration values for check digit calculation
const TRANSLITERATION: Record<string, number> = {
  'A': 1, 'B': 2, 'C': 3, 'D': 4, 'E': 5, 'F': 6, 'G': 7, 'H': 8,
  'J': 1, 'K': 2, 'L': 3, 'M': 4, 'N': 5, 'P': 7, 'R': 9,
  'S': 2, 'T': 3, 'U': 4, 'V': 5, 'W': 6, 'X': 7, 'Y': 8, 'Z': 9,
  '0': 0, '1': 1, '2': 2, '3': 3, '4': 4,
  '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
};

// Position weights for check digit calculation
const POSITION_WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];

function validateCheckDigit(vin: string): boolean {
  let sum = 0;

  for (let i = 0; i < 17; i++) {
    const char = vin[i].toUpperCase();
    const value = TRANSLITERATION[char];

    if (value === undefined) return false;

    sum += value * POSITION_WEIGHTS[i];
  }

  const remainder = sum % 11;
  const checkDigit = remainder === 10 ? 'X' : remainder.toString();

  return vin[8].toUpperCase() === checkDigit;
}

export function decodeVIN(vin: string): VINDecodeResult {
  // Clean the VIN
  const cleanVIN = vin.replace(/[^A-Za-z0-9]/g, '').toUpperCase();

  // Validate length
  if (cleanVIN.length !== 17) {
    return {
      year: null,
      make: null,
      country: null,
      isValid: false,
      error: 'VIN must be exactly 17 characters',
    };
  }

  // Check for invalid characters (I, O, Q are not allowed)
  if (/[IOQ]/.test(cleanVIN)) {
    return {
      year: null,
      make: null,
      country: null,
      isValid: false,
      error: 'VIN contains invalid characters (I, O, Q are not allowed)',
    };
  }

  // Validate check digit (position 9)
  const isCheckDigitValid = validateCheckDigit(cleanVIN);

  // Get WMI (first 3 characters)
  const wmi = cleanVIN.substring(0, 3);

  // Try to find manufacturer
  let make: string | null = null;

  // First try exact 3-char match
  if (WMI_CODES[wmi]) {
    make = WMI_CODES[wmi];
  } else {
    // Try first 2 characters
    const wmi2 = cleanVIN.substring(0, 2);
    for (const [code, manufacturer] of Object.entries(WMI_CODES)) {
      if (code.startsWith(wmi2)) {
        make = manufacturer;
        break;
      }
    }
  }

  // Get year (position 10)
  const yearChar = cleanVIN[9];
  const year = YEAR_CODES[yearChar] || null;

  // Get country
  const countryChar = cleanVIN[0];
  const country = COUNTRY_CODES[countryChar] || null;

  return {
    year,
    make,
    country,
    isValid: isCheckDigitValid,
    error: isCheckDigitValid ? undefined : 'Invalid check digit - VIN may be incorrect',
  };
}

export function formatVIN(vin: string): string {
  return vin.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}
