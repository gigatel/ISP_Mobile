// utils/addressParser.ts
/**
 * Utility functions for parsing address components
 */

export interface ParsedAddress {
  area: string;
  city: string;
  state: string;
  country: string;
  pincode: string;
}

// Common Indian states
const INDIAN_STATES = [
  'Delhi',
  'Maharashtra',
  'Karnataka',
  'Tamil Nadu',
  'Gujarat',
  'Rajasthan',
  'Uttar Pradesh',
  'West Bengal',
  'Haryana',
  'Punjab',
  'Madhya Pradesh',
  'Bihar',
  'Andhra Pradesh',
  'Telangana',
  'Kerala',
  'Assam',
  'Odisha',
  'Jharkhand',
  'Chhattisgarh',
  'Uttarakhand',
  'Himachal Pradesh',
  'Tripura',
  'Meghalaya',
  'Manipur',
  'Nagaland',
  'Goa',
  'Arunachal Pradesh',
  'Mizoram',
  'Sikkim',
];

// Common Indian cities
const INDIAN_CITIES = [
  'New Delhi',
  'Delhi',
  'Mumbai',
  'Bangalore',
  'Bengaluru',
  'Chennai',
  'Kolkata',
  'Hyderabad',
  'Pune',
  'Ahmedabad',
  'Surat',
  'Jaipur',
  'Lucknow',
  'Kanpur',
  'Nagpur',
  'Indore',
  'Thane',
  'Bhopal',
  'Visakhapatnam',
  'Patna',
  'Vadodara',
  'Ghaziabad',
  'Ludhiana',
  'Agra',
  'Nashik',
  'Faridabad',
  'Meerut',
  'Rajkot',
  'Varanasi',
  'Srinagar',
  'Aurangabad',
  'Dhanbad',
  'Amritsar',
  'Navi Mumbai',
  'Allahabad',
  'Ranchi',
  'Howrah',
  'Coimbatore',
  'Jabalpur',
  'Gwalior',
  'Vijayawada',
  'Jodhpur',
  'Madurai',
  'Raipur',
  'Kota',
];

/**
 * Parse address string and extract components
 */
export const parseAddressComponents = (
  addressString: string,
): ParsedAddress => {
  console.log('🔍 Parsing address:', addressString);

  const parts = addressString.split(',').map(part => part.trim());
  console.log('📋 Address parts:', parts);

  let extractedCity = '';
  let extractedState = '';
  let extractedCountry = '';
  let extractedPincode = '';
  let extractedArea = '';

  // Extract pincode (6 digits)
  const pincodeMatch = addressString.match(/\b\d{6}\b/);
  if (pincodeMatch) {
    extractedPincode = pincodeMatch[0];
    console.log('✅ Pincode extracted:', extractedPincode);
  }

  // Extract country
  if (parts.length > 0) {
    const lastPart = parts[parts.length - 1];
    if (lastPart.toLowerCase().includes('india')) {
      extractedCountry = 'India';
      console.log('✅ Country extracted:', extractedCountry);
    }
  }

  // Extract state
  for (const part of parts) {
    const foundState = INDIAN_STATES.find(
      state =>
        part.toLowerCase() === state.toLowerCase() ||
        part.toLowerCase().includes(state.toLowerCase()),
    );
    if (foundState) {
      extractedState = foundState;
      console.log('✅ State extracted:', extractedState);
      break;
    }
  }

  // Extract city - prioritize "New Delhi"
  for (const part of parts) {
    if (part.toLowerCase().includes('new delhi')) {
      extractedCity = 'New Delhi';
      console.log('✅ City extracted:', extractedCity);
      break;
    }
  }

  if (!extractedCity) {
    for (const part of parts) {
      const foundCity = INDIAN_CITIES.find(
        city =>
          part.toLowerCase() === city.toLowerCase() ||
          part.toLowerCase().includes(city.toLowerCase()),
      );
      if (foundCity) {
        extractedCity = foundCity;
        console.log('✅ City extracted:', extractedCity);
        break;
      }
    }
  }

  // Extract area using repeated word detection
  const wordCount: {[key: string]: number} = {};
  for (const part of parts) {
    const words = part.split(' ');
    for (const word of words) {
      const cleanWord = word.replace(/[^a-zA-Z]/g, '');
      if (cleanWord.length > 3) {
        wordCount[cleanWord] = (wordCount[cleanWord] || 0) + 1;
      }
    }
  }

  let maxCount = 0;
  let areaCandidate = '';
  for (const [word, count] of Object.entries(wordCount)) {
    if (count > maxCount && count >= 2) {
      maxCount = count;
      areaCandidate = word;
    }
  }

  if (areaCandidate) {
    extractedArea = areaCandidate;
    console.log('✅ Area extracted (repeated word):', extractedArea);
  } else {
    // Fallback pattern matching
    for (let i = 0; i < Math.min(4, parts.length); i++) {
      const part = parts[i];
      if (
        !part.match(/\d{6}/) &&
        !part.toLowerCase().includes('block') &&
        !part.toLowerCase().includes('main rd') &&
        !part.toLowerCase().includes('road') &&
        !part.toLowerCase().includes('street') &&
        !part.toLowerCase().includes('no') &&
        part.length > 3 &&
        part.length < 30
      ) {
        const words = part.split(' ').filter(w => w.length > 3);
        if (words.length > 0) {
          extractedArea = words[words.length - 1];
          console.log('✅ Area extracted (fallback):', extractedArea);
          break;
        }
      }
    }
  }

  const result = {
    area: extractedArea,
    city: extractedCity,
    state: extractedState,
    country: extractedCountry,
    pincode: extractedPincode,
  };

  console.log('=== AUTO-FILL SUMMARY ===');
  console.log('Area:', result.area || 'NOT FILLED');
  console.log('City:', result.city || 'NOT FILLED');
  console.log('State:', result.state || 'NOT FILLED');
  console.log('Country:', result.country || 'NOT FILLED');
  console.log('Pincode:', result.pincode || 'NOT FILLED');
  console.log('========================');

  return result;
};
