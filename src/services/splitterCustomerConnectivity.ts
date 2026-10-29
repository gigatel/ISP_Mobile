import {APIs, URLs} from '@apis';
import type {
  Splitter,
  SplitterCustomer,
  SplitterLeg,
} from '../screens/LastMileConnectivityScreen/types';

export type SplitterCustomerConnectivityPayload = {
  id: number;
  splitterId: number;
  splitterDetailId: number;
  splitterCode: string;
  fiberMappingId: number;
  tubeNo: number;
  coreNo: number;
  customerMobileNo: string;
  customerName: string;
  customerAddress: string;
  customerLatLng: string;
  virtualConnection: boolean;
  remarks: string;
  macAddress: string;
};

const positiveInteger = (value: unknown) => {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : 0;
};

export function buildSplitterCustomerConnectivityPayload(
  splitter: Splitter,
  leg: number,
  customer: SplitterCustomer,
  connectionLeg?: SplitterLeg,
  editing = false,
): SplitterCustomerConnectivityPayload {
  const id =
    positiveInteger(customer.customerDetailId) || positiveInteger(customer.id);
  if (editing && !id) {
    throw new Error(
      'Cannot update this connection: the splitter details API did not return its customer connectivity ID.',
    );
  }
  const splitterId = positiveInteger(splitter.splitterId);
  const splitterDetailId = positiveInteger(
    connectionLeg?.splitterDetailId ??
      customer.splitterDetailId ??
      splitter.splitterDetailId,
  );
  if (!splitterId || !splitterDetailId || !splitter.code?.trim()) {
    throw new Error(
      'Splitter details are missing. Reopen the splitter and try again.',
    );
  }
  if (
    !positiveInteger(leg) ||
    (splitter.totalPorts && leg > splitter.totalPorts) ||
    (connectionLeg && connectionLeg.leg !== leg)
  ) {
    throw new Error('Invalid splitter leg. Reopen the splitter and try again.');
  }
  const virtualConnection = !/physical/i.test(customer.connectivity);
  const fiberMappingId = virtualConnection
    ? 0
    : positiveInteger(customer.fiberMappingId);
  const tubeNo = virtualConnection ? 0 : positiveInteger(customer.tube);
  const coreNo = virtualConnection ? 0 : positiveInteger(customer.core);
  if (!virtualConnection && (!fiberMappingId || !tubeNo || !coreNo)) {
    throw new Error('Select a GIG, tube and core before saving the customer.');
  }
  return {
    id,
    splitterId,
    splitterDetailId,
    splitterCode:
      connectionLeg?.splitterCode ||
      customer.splitterCode ||
      `${splitter.code.trim()}/${leg}`,
    fiberMappingId,
    tubeNo,
    coreNo,
    customerMobileNo: customer.mobile.trim(),
    customerName: customer.name.trim(),
    customerAddress: customer.address.trim(),
    customerLatLng: customer.latLng.trim(),
    virtualConnection,
    remarks: customer.landmark.trim(),
    macAddress: customer.mac.trim(),
  };
}

export async function saveSplitterCustomerConnectivity(
  payload: SplitterCustomerConnectivityPayload,
): Promise<void> {
  const response = await APIs.postRequestWithJson({
    path: URLs.insertUpdateSplitterCustomerConnectivityAsync,
    params: payload,
    isAuth: true,
  });
  if (
    response?.data?.result === false ||
    response?.success === false ||
    (response?.success !== true && Number(response?.status) !== 200)
  ) {
    throw new Error(
      response?.data?.msg ||
        response?.message ||
        'Could not connect the customer. Please retry.',
    );
  }
}
