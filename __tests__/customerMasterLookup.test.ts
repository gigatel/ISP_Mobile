import {APIs, URLs} from '../src/apis';
import {
  applyCustomerMasterDetails,
  customerLookupQuery,
  lookupCustomerMaster,
} from '../src/services/customerMasterLookup';
import type {SplitterCustomer} from '../src/screens/LastMileConnectivityScreen/types';

jest.mock('../src/apis', () => ({
  APIs: {getRequestWithQuery: jest.fn()},
  URLs: {
    getCustomerMasterDetailByMobNo:
      'http://mob.gigatel.me:7004/api/CustomerMaster/GetCustomerMasterDetailByMobNo',
    getCustomerMasterDetailByMacAddress:
      'http://10.100.2.38:6101/api/CustomerMaster/GetCustomerMasterDetailByMobNo',
  },
}));
const request = APIs.getRequestWithQuery as jest.Mock;
const record = {
  id: 2,
  name: 'API Customer',
  mobNo: '9129121700',
  macAddress: null,
  latLng: '28.541786874749757, 77.25466560998636',
  installationAddress: 'Installation address',
  gstAddress: 'GST address',
  aadharNo: 'not-for-this-form',
};
beforeEach(() => request.mockReset());

test('mobile lookup uses MobNo on the mobile endpoint and maps installation details', async () => {
  request.mockResolvedValue({success: true, status: 200, data: record});
  await expect(lookupCustomerMaster('9129121700')).resolves.toEqual({
    customerMasterId: 2,
    name: 'API Customer',
    mobile: '9129121700',
    mac: '',
    latLng: record.latLng,
    address: 'Installation address',
    landmark: '',
  });
  expect(request).toHaveBeenCalledWith({
    path: URLs.getCustomerMasterDetailByMobNo,
    params: '?MobNo=9129121700',
    isAuth: true,
  });
});

test('MAC lookup uses its supplied endpoint and URL encoding without the accidental quote', async () => {
  request.mockResolvedValue({
    success: true,
    data: {...record, macAddress: '32:5e:87:50:3f:39'},
  });
  const customer = await lookupCustomerMaster('32:5e:87:50:3f:39');
  expect(request).toHaveBeenCalledWith({
    path: URLs.getCustomerMasterDetailByMacAddress,
    params: '?MacAddress=32%3A5e%3A87%3A50%3A3f%3A39',
    isAuth: true,
  });
  expect(customer?.mac).toBe('32:5e:87:50:3f:39');
});

test('recognizes dashed and compact MACs and rejects invalid input before requesting', async () => {
  expect(customerLookupQuery('32-5e-87-50-3f-39')).toBe(
    '?MacAddress=32%3A5e%3A87%3A50%3A3f%3A39',
  );
  expect(customerLookupQuery('325e87503f39')).toBe(
    '?MacAddress=32%3A5e%3A87%3A50%3A3f%3A39',
  );
  await expect(lookupCustomerMaster('invalid')).rejects.toThrow(
    'valid 10-digit',
  );
  expect(request).not.toHaveBeenCalled();
});

test('missing customers and failed requests do not produce sample customer data', async () => {
  request.mockResolvedValueOnce({success: true, data: null});
  await expect(lookupCustomerMaster('9129121700')).resolves.toBeNull();
  request.mockResolvedValueOnce({
    success: false,
    status: 200,
    message: 'Customer not found',
  });
  await expect(lookupCustomerMaster('9129121700')).rejects.toThrow(
    'Customer not found',
  );
  request.mockResolvedValueOnce({success: true, data: 'invalid'});
  await expect(lookupCustomerMaster('9129121700')).rejects.toThrow(
    'Invalid customer response',
  );
});

test('prefill replaces old customer fields, preserves GIG assignment, and keeps the exact device GPS fix', async () => {
  request.mockResolvedValue({success: true, data: record});
  const details = (await lookupCustomerMaster('9129121700'))!;
  const gps = '28.544219862526788, 77.25110829683024';
  const form: SplitterCustomer = {
    id: 61,
    tube: '2',
    core: '3',
    gig: 'OGIG-TEST',
    connectivity: 'Physical GIG',
    mobile: '9000000000',
    mac: 'OLD-MAC',
    name: 'Old customer',
    address: 'Old address',
    landmark: 'Old landmark',
    latLng: gps,
    online: true,
  };
  const filled = applyCustomerMasterDetails(form, details, gps);
  expect(filled).toMatchObject({
    id: 61,
    customerMasterId: 2,
    tube: '2',
    core: '3',
    gig: 'OGIG-TEST',
    name: 'API Customer',
    mac: '',
    address: 'Installation address',
    landmark: '',
    latLng: gps,
  });
  expect(applyCustomerMasterDetails(form, details, null).latLng).toBe(
    record.latLng,
  );
});

test('mobile-number lookup returns the customer MAC whenever the API supplies macAddress', async () => {
  request.mockResolvedValue({
    success: true,
    status: 200,
    data: {...record, macAddress: '32:5e:87:50:3f:39'},
  });
  expect(await lookupCustomerMaster('9129121700')).toMatchObject({
    mobile: '9129121700',
    mac: '32:5e:87:50:3f:39',
  });
});
