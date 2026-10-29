import {APIs, URLs} from '../src/apis';
import {
  buildSplitterCustomerConnectivityPayload,
  saveSplitterCustomerConnectivity,
} from '../src/services/splitterCustomerConnectivity';

jest.mock('../src/apis', () => ({
  APIs: {postRequestWithJson: jest.fn()},
  URLs: {
    insertUpdateSplitterCustomerConnectivityAsync:
      'http://mob.gigatel.me:7004/api/Splitter/InsertUpdateSplitterCustomerConnectivityAsync',
  },
}));
const post = APIs.postRequestWithJson as jest.Mock;
const payload = {
  id: 0,
  splitterId: 27,
  splitterDetailId: 260,
  splitterCode: '02/12/A-128/B-64-1/C-32-1',
  fiberMappingId: 10,
  tubeNo: 1,
  coreNo: 12,
  customerMobileNo: '9000000000',
  customerName: 'Customer',
  customerAddress: 'Customer address',
  customerLatLng: '28.5, 77.4',
  virtualConnection: true,
  remarks: 'Landmark',
  macAddress: '20:e1:5d:0d:e1:da',
};
beforeEach(() => post.mockReset());

test('posts the customer connection body with authentication', async () => {
  post.mockResolvedValue({success: true, status: 200, data: null});
  await expect(
    saveSplitterCustomerConnectivity(payload),
  ).resolves.toBeUndefined();
  expect(post).toHaveBeenCalledWith({
    path: URLs.insertUpdateSplitterCustomerConnectivityAsync,
    params: payload,
    isAuth: true,
  });
});

test('posts an existing connection ID and physical connectivity without changing the supplied fields', async () => {
  post.mockResolvedValue({success: true});
  const edit = {...payload, id: 15, virtualConnection: false};
  await saveSplitterCustomerConnectivity(edit);
  expect(post.mock.calls[0][0].params).toEqual(edit);
});

test('reports server and network failures instead of showing success', async () => {
  post.mockResolvedValueOnce({
    success: false,
    status: 200,
    message: 'Core in use',
  });
  await expect(saveSplitterCustomerConnectivity(payload)).rejects.toThrow(
    'Core in use',
  );
  post.mockRejectedValueOnce(new Error('Network unavailable'));
  await expect(saveSplitterCustomerConnectivity(payload)).rejects.toThrow(
    'Network unavailable',
  );
  post.mockResolvedValueOnce(undefined);
  await expect(saveSplitterCustomerConnectivity(payload)).rejects.toThrow(
    'Could not connect',
  );
});

const splitter = {
  id: 'nearby-260',
  splitterId: 27,
  splitterDetailId: 260,
  code: '02/12/A-128/B-64-1/C-32-1',
  name: 'Splitter',
  free: 4,
  totalPorts: 8,
  latitude: null,
  longitude: null,
  distance: null,
};
const customer = {
  tube: '2',
  core: '3',
  mobile: ' 9000000000 ',
  name: ' Customer ',
  address: ' Customer address ',
  latLng: '28.5, 77.4',
  mac: '20:e1:5d:0d:e1:da',
  landmark: ' Landmark ',
  connectivity: 'Physical GIG',
  gig: 'API GIG',
  fiberMappingId: 90,
  online: null,
};

test('builds the selected free-leg payload using server metadata and selected GIG ID', () => {
  const built = buildSplitterCustomerConnectivityPayload(
    splitter,
    5,
    customer,
    {
      leg: 5,
      splitterDetailId: 265,
      splitterCode: `${splitter.code}/5`,
    },
  );
  expect(built).toMatchObject({
    id: 0,
    splitterId: 27,
    splitterDetailId: 265,
    splitterCode: `${splitter.code}/5`,
    fiberMappingId: 90,
    tubeNo: 2,
    coreNo: 3,
    virtualConnection: false,
    remarks: 'Landmark',
    customerName: 'Customer',
    customerMobileNo: '9000000000',
  });
});

test('virtual connections clear stale physical GIG fields and edits preserve the server connection ID', () => {
  const built = buildSplitterCustomerConnectivityPayload(splitter, 1, {
    ...customer,
    id: 82,
    connectivity: 'Virtual GIG',
    splitterDetailId: 260,
    splitterCode: `${splitter.code}/1`,
  });
  expect(built).toMatchObject({
    id: 82,
    virtualConnection: true,
    fiberMappingId: 0,
    tubeNo: 0,
    coreNo: 0,
  });
});

test('missing splitter IDs or physical GIG selections cannot create a guessed connection', () => {
  expect(() =>
    buildSplitterCustomerConnectivityPayload(
      {...splitter, splitterDetailId: undefined},
      5,
      customer,
    ),
  ).toThrow('Splitter details are missing');
  expect(() =>
    buildSplitterCustomerConnectivityPayload(splitter, 5, {
      ...customer,
      fiberMappingId: undefined,
    }),
  ).toThrow('Select a GIG');
  expect(() =>
    buildSplitterCustomerConnectivityPayload(splitter, 9, customer),
  ).toThrow('Invalid splitter leg');
});

test('rejects nested business failures even when HTTP status and top-level success indicate success', async () => {
  post.mockResolvedValue({
    success: true,
    status: 200,
    message: 'Customer leg is already occupied.',
    data: {result: false, msg: 'Customer leg is already occupied.'},
  });
  await expect(saveSplitterCustomerConnectivity(payload)).rejects.toThrow(
    'Customer leg is already occupied.',
  );
});

test('accepts the actual successful nested result returned by the API', async () => {
  post.mockResolvedValue({
    success: true,
    status: 200,
    data: {result: true, msg: 'Saved Successfully'},
  });
  await expect(
    saveSplitterCustomerConnectivity(payload),
  ).resolves.toBeUndefined();
});

test('an edit without the existing customer connectivity ID cannot be sent as a new insert', () => {
  expect(() =>
    buildSplitterCustomerConnectivityPayload(
      splitter,
      5,
      customer,
      undefined,
      true,
    ),
  ).toThrow('customer connectivity ID');
  expect(
    buildSplitterCustomerConnectivityPayload(
      splitter,
      5,
      {...customer, id: 82},
      undefined,
      true,
    ).id,
  ).toBe(82);
});

test('edit POST id uses customerDetailId rather than the splitter detail ID', () => {
  const built = buildSplitterCustomerConnectivityPayload(
    splitter,
    5,
    {
      ...customer,
      id: 999,
      customerDetailId: 173,
      splitterDetailId: 260,
      address: 'Updated address',
      connectivity: 'Virtual GIG',
    },
    undefined,
    true,
  );
  expect(built).toMatchObject({
    id: 173,
    splitterDetailId: 260,
    customerAddress: 'Updated address',
    virtualConnection: true,
  });
});
