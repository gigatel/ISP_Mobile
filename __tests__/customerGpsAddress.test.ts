import {fetchWithAppHeaders} from '../src/apis/headers';
import {
  applyCustomerGpsAddress,
  getCustomerGpsAddress,
} from '../src/screens/LastMileConnectivityScreen/customerGpsAddress';

jest.mock('../src/apis/headers', () => ({fetchWithAppHeaders: jest.fn()}));
jest.mock('../src/utils/olaMapKey', () => ({
  getOlaMapApiKey: () => 'test-key',
}));
const fetchAddress = fetchWithAppHeaders as jest.Mock;

beforeEach(() => fetchAddress.mockReset());

test('queries the exact GPS coordinates and ignores a distant geocoded coordinate', async () => {
  fetchAddress.mockResolvedValue({
    ok: true,
    json: async () => ({
      results: [
        {
          formatted_address: 'Nearby mapped address',
          geometry: {location: {lat: 29.5, lng: 78.5}},
          address_components: [
            {types: ['neighborhood'], long_name: 'City Park'},
          ],
        },
      ],
    }),
  });
  const latitude = 28.612345678901;
  const longitude = 77.212345678901;
  const text = await getCustomerGpsAddress(latitude, longitude);
  expect(fetchAddress.mock.calls[0][0]).toContain(
    `latlng=${latitude},${longitude}`,
  );
  expect(text).toEqual({
    address: 'Nearby mapped address',
    landmark: 'City Park',
  });
  const coordinates = `${latitude}, ${longitude}`;
  expect(
    applyCustomerGpsAddress(
      {latLng: coordinates, address: '', landmark: ''},
      coordinates,
      text,
    ),
  ).toEqual({latLng: coordinates, ...text});
});

test('prefers an actual landmark over broader locality components', async () => {
  fetchAddress.mockResolvedValue({
    ok: true,
    json: async () => ({
      results: [
        {
          formatted_address: 'Test address',
          address_components: [
            {types: ['sublocality'], long_name: 'Market'},
            {types: ['point_of_interest'], long_name: 'Clock Tower'},
          ],
        },
      ],
    }),
  });
  await expect(getCustomerGpsAddress(28.6, 77.2)).resolves.toEqual({
    address: 'Test address',
    landmark: 'Clock Tower',
  });
});

test('does not invent a landmark when none is returned', async () => {
  fetchAddress.mockResolvedValue({
    ok: true,
    json: async () => ({
      geocodingResults: [{formattedAddress: 'Test address'}],
    }),
  });
  await expect(getCustomerGpsAddress(28.6, 77.2)).resolves.toEqual({
    address: 'Test address',
    landmark: '',
  });
});

test('ignores an outdated lookup after coordinates change', () => {
  const form = {latLng: '28.7, 77.3', address: '', landmark: ''};
  expect(
    applyCustomerGpsAddress(form, '28.6, 77.2', {
      address: 'Old address',
      landmark: 'Old landmark',
    }),
  ).toBe(form);
});

test('preserves address and landmark typed while the lookup was pending', () => {
  const form = {
    latLng: '28.6, 77.2',
    address: 'Manual address',
    landmark: 'Manual landmark',
  };
  expect(
    applyCustomerGpsAddress(form, form.latLng, {
      address: 'Mapped address',
      landmark: 'Mapped landmark',
    }),
  ).toEqual(form);
});

test('fails without returning replacement coordinates when lookup is unavailable', async () => {
  fetchAddress.mockResolvedValue({ok: false});
  await expect(getCustomerGpsAddress(28.6, 77.2)).rejects.toThrow(
    'Address lookup failed',
  );
});
