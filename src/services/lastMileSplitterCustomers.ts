import {APIs, URLs} from '@apis';
import type {
  Splitter,
  SplitterCustomer,
  SplitterLeg,
} from '../screens/LastMileConnectivityScreen/types';

const text = (value: unknown) => String(value ?? '').trim();
const positiveInteger = (value: unknown): number | undefined => {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : undefined;
};
const activeStatus = (value: unknown): boolean | null => {
  if (
    value === true ||
    value === 1 ||
    ['true', '1', 'on', 'online', 'active'].includes(text(value).toLowerCase())
  ) {
    return true;
  }
  if (
    value === false ||
    value === 0 ||
    ['false', '0', 'off', 'offline', 'inactive'].includes(
      text(value).toLowerCase(),
    )
  ) {
    return false;
  }
  return null;
};

const customerConnectivity = (row: any): SplitterCustomer['connectivity'] => {
  const virtualConnection = activeStatus(row.virtualConnection);
  if (virtualConnection !== null) {
    return virtualConnection ? 'Virtual GIG' : 'Physical GIG';
  }
  const label = [row.connectivity, row.connectBy, row.outConnectBy]
    .map(text)
    .find(value => /physical|virtual/i.test(value));
  if (label) {
    return /physical/i.test(label) ? 'Physical GIG' : 'Virtual GIG';
  }
  // The details endpoint may omit connectivity but return the saved GIG assignment.
  const mappingId = positiveInteger(
    row.connectedFiberMappingId ??
      row.fiberMappingId ??
      row.routeFiberMappingId,
  );
  const tube = positiveInteger(row.connectedTubeNo ?? row.tubeNo);
  const core = positiveInteger(row.connectedCoreNo ?? row.coreNo);
  return mappingId && tube && core ? 'Physical GIG' : 'Virtual GIG';
};

const recordLeg = (row: any, splitter: Splitter) => {
  const code = text(row.splitterCode);
  const suffix =
    splitter.code && code.startsWith(`${splitter.code}/`)
      ? code.slice(splitter.code.length + 1)
      : '';
  return (
    positiveInteger(row.legNo ?? row.legNumber ?? row.leg) ??
    positiveInteger(suffix) ??
    positiveInteger(row.splitParentLeg)
  );
};

export function normalizeSplitterLegs(
  data: any,
  splitter: Splitter,
): SplitterLeg[] {
  return (data.splitterRouteDetailsDto as any[])
    .filter(
      row =>
        row &&
        (row.splitterId == null ||
          Number(row.splitterId) === splitter.splitterId),
    )
    .map(row => ({
      leg: recordLeg(row, splitter),
      splitterDetailId: positiveInteger(row.splitterDetailId),
      splitterCode: text(row.splitterCode),
    }))
    .filter((row): row is typeof row & {leg: number} => row.leg !== undefined);
}

export function normalizeSplitterCustomers(
  data: unknown,
  splitter: Splitter,
): (SplitterCustomer | null)[] {
  const payload = data as {splitterRouteDetailsDto?: unknown};
  if (!payload || !Array.isArray(payload.splitterRouteDetailsDto)) {
    throw new Error('Invalid customer details response. Please retry.');
  }
  const records = payload.splitterRouteDetailsDto.filter(
    (row: any) =>
      row &&
      typeof row === 'object' &&
      (row.splitterId == null ||
        Number(row.splitterId) === splitter.splitterId),
  );
  const positioned: {leg?: number; customer: SplitterCustomer}[] = records.map(
    (row: any) => {
      const leg = recordLeg(row, splitter);
      return {
        leg,
        customer: {
          id: positiveInteger(row.customerDetailId) ?? positiveInteger(row.id),
          customerDetailId: positiveInteger(row.customerDetailId),
          splitterCode: text(row.splitterCode),
          splitterDetailId: positiveInteger(row.splitterDetailId),
          fiberMappingId: positiveInteger(
            row.connectedFiberMappingId ??
              row.fiberMappingId ??
              row.routeFiberMappingId,
          ),
          routeFiberMappingId: positiveInteger(row.routeFiberMappingId),
          tube: text(row.connectedTubeNo ?? row.tubeNo),
          core: text(row.connectedCoreNo ?? row.coreNo),
          mobile: text(row.customerMobileNo),
          name: text(row.customerName),
          mac: text(row.macAddress),
          address: text(row.customerAddress),
          latLng: text(row.customerLatLng),
          landmark: text(row.customerLandmark ?? row.landmark ?? row.remarks),
          online: activeStatus(row.isActive),
          connectivity: customerConnectivity(row),
          gig: text(row.fiberCode),
        },
      };
    },
  );
  const lastLeg = Math.max(0, ...positioned.map(row => row.leg ?? 0));
  const capacity = Math.max(
    splitter.totalPorts ?? 0,
    lastLeg,
    positioned.filter(
      row =>
        row.customer.mobile ||
        row.customer.name ||
        row.customer.mac ||
        row.customer.address,
    ).length + splitter.free,
  );
  if (capacity > 4096) {
    throw new Error('Invalid splitter port count returned by the server.');
  }
  const customers: (SplitterCustomer | null)[] = Array.from(
    {length: capacity},
    () => null,
  );
  const assignedLegs = new Set<number>();
  [...positioned]
    .sort(
      (first, second) =>
        Number(second.leg !== undefined) - Number(first.leg !== undefined),
    )
    .forEach(({leg, customer}) => {
      const index =
        leg !== undefined
          ? leg - 1
          : customers.findIndex(item => item === null);
      if (index < 0 || assignedLegs.has(index)) {
        throw new Error('Customer leg assignments overlap. Please retry.');
      }
      assignedLegs.add(index);
      const hasCustomer = Boolean(
        customer.mobile || customer.name || customer.mac || customer.address,
      );
      customers[index] = hasCustomer ? customer : null;
    });
  return customers;
}

export async function getSplitterCustomerDetails(
  splitter: Splitter,
): Promise<{customers: (SplitterCustomer | null)[]; legs: SplitterLeg[]}> {
  if (!splitter.splitterId || !splitter.code?.trim()) {
    throw new Error('The selected splitter is missing its ID or code.');
  }
  const response = await APIs.getRequestWithQuery({
    path: URLs.getSplitterCustomerDetailsBySplitterId,
    params: `?splitterId=${encodeURIComponent(
      splitter.splitterId,
    )}&splitterCode=${encodeURIComponent(
      splitter.code,
    )}&customerdetails=true&appType=app`,
    isAuth: true,
  });
  if (
    response?.success === false ||
    (response?.success !== true && Number(response?.status) !== 200)
  ) {
    throw new Error(
      response?.message || 'Could not load splitter customers. Please retry.',
    );
  }
  const customers = normalizeSplitterCustomers(response.data, splitter);
  return {customers, legs: normalizeSplitterLegs(response.data, splitter)};
}

export async function getSplitterCustomers(
  splitter: Splitter,
): Promise<(SplitterCustomer | null)[]> {
  return (await getSplitterCustomerDetails(splitter)).customers;
}
