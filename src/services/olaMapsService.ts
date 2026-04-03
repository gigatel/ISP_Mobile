// src/services/olaMapsService.ts
import {OLA_MAP_API} from '@env';

const OLA_API_KEY = OLA_MAP_API;
const OLA_BASE_URL = 'https://api.olamaps.io/places/v1';

export interface OlaAddressResult {
  formatted_address: string;
}

export const olaReverseGeocode = async (
  lat: number,
  lng: number,
): Promise<{ results: OlaAddressResult[] } | null> => {
  try {
    if (!OLA_API_KEY) {
      console.warn('❌ OLA_MAP_API key missing in env');
      return null;
    }

    if (isNaN(lat) || isNaN(lng)) {
      console.warn('❌ Invalid lat/lng:', lat, lng);
      return null;
    }

    const url =
      `${OLA_BASE_URL}/reverse-geocode` +
      `?latlng=${lat},${lng}&api_key=${OLA_API_KEY}`;

    const res = await fetch(url);

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
