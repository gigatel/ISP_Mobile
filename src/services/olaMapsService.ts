// src/services/olaMapsService.ts
import {getOlaMapApiKey} from '../utils/olaMapKey';
import {fetchWithAppHeaders} from '../apis/headers';

const OLA_BASE_URL = 'https://api.olamaps.io/places/v1';

export interface OlaAddressResult {
  formatted_address: string;
}

export const olaReverseGeocode = async (
  lat: number,
  lng: number,
): Promise<{ results: OlaAddressResult[] } | null> => {
  try {
    const OLA_API_KEY = getOlaMapApiKey();
    if (!OLA_API_KEY) {
      console.warn('❌ OLA_MAP_API key missing from login response');
      return null;
    }

    if (isNaN(lat) || isNaN(lng)) {
      console.warn('❌ Invalid lat/lng:', lat, lng);
      return null;
    }

    const url =
      `${OLA_BASE_URL}/reverse-geocode` +
      `?latlng=${lat},${lng}&api_key=${encodeURIComponent(OLA_API_KEY)}`;

    console.log('[Ola Maps API] reverse-geocode OLA_MAP_API:', OLA_API_KEY);
    const res = await fetchWithAppHeaders(url);

    if (!res.ok) {
      console.warn('❌ Ola API error:', res.status);
      return null;
    }

    const json = await res.json();

    const results = json?.results || json?.geocodingResults || [];

    if (!Array.isArray(results)) {
      return null;
    }

    return {
      results: results.map((item: any) => ({
        formatted_address:
          item.formatted_address ||
          item.formattedAddress ||
          item.display_name ||
          item.displayName ||
          item.address ||
          '',
      })),
    };
  } catch (e) {
    console.log('❌ Ola reverse geocode error', e);
    return null;
  }
};
