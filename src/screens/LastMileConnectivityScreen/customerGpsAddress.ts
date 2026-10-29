import {fetchWithAppHeaders} from '../../apis/headers';
import {getOlaMapApiKey} from '../../utils/olaMapKey';

type AddressComponent = {
  types?: string[];
  long_name?: string;
  longName?: string;
};
type AddressResult = {
  formatted_address?: string;
  formattedAddress?: string;
  display_name?: string;
  landmark?: string;
  name?: string;
  types?: string[];
  address_components?: AddressComponent[];
  addressComponents?: AddressComponent[];
};

export function applyCustomerGpsAddress<
  T extends {latLng: string; address: string; landmark: string},
>(form: T, gpsLatLng: string, text: {address: string; landmark: string}): T {
  if (form.latLng !== gpsLatLng) {
    return form;
  }
  return {
    ...form,
    address: form.address || text.address,
    landmark: form.landmark || text.landmark,
  };
}

// Deliberately returns text only: a geocoder's place coordinates must never
// replace the device fix, even when its nearest address is some distance away.
export async function getCustomerGpsAddress(
  latitude: number,
  longitude: number,
): Promise<{address: string; landmark: string}> {
  const key = getOlaMapApiKey();
  if (!key) {
    throw new Error('Address lookup unavailable');
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetchWithAppHeaders(
      `https://api.olamaps.io/places/v1/reverse-geocode?latlng=${latitude},${longitude}&api_key=${encodeURIComponent(
        key,
      )}`,
      {signal: controller.signal},
    );
    if (!response.ok) {
      throw new Error('Address lookup failed');
    }
    const json = await response.json();
    const results: AddressResult[] =
      json.results ?? json.geocodingResults ?? [];
    const result = Array.isArray(results)
      ? results.find(
          item =>
            item.formatted_address ||
            item.formattedAddress ||
            item.display_name,
        )
      : undefined;
    if (!result) {
      throw new Error('Address not found');
    }
    const components =
      result.address_components ?? result.addressComponents ?? [];
    const landmark = [
      'point_of_interest',
      'establishment',
      'premise',
      'neighborhood',
      'sublocality_level_2',
      'sublocality_level_1',
      'sublocality',
    ]
      .map(type =>
        components.find(component => component.types?.includes(type)),
      )
      .find(Boolean);
    return {
      address:
        result.formatted_address ||
        result.formattedAddress ||
        result.display_name ||
        '',
      landmark:
        result.landmark ||
        (result.types?.some(type =>
          ['point_of_interest', 'establishment', 'premise'].includes(type),
        )
          ? result.name
          : '') ||
        landmark?.long_name ||
        landmark?.longName ||
        '',
    };
  } finally {
    clearTimeout(timeout);
  }
}
