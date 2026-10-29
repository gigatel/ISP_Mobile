export type Splitter = {
  id: string;
  name: string;
  free: number;
  distance: number | null;
  latitude: number | null;
  longitude: number | null;
  source?: 'api';
  splitterId?: number;
  splitterDetailId?: number;
  code?: string;
  displayCode?: string;
  splitterType?: string;
  totalPorts?: number;
  connectedCustomers?: number;
  address?: string;
  landmark?: string;
  opticalPowerIn?: number | null;
  opticalPowerOut?: number | null;
  rxPower?: number | null;
  txPower?: number | null;
  masterSiteId?: number;
  deviceId?: number;
  portId?: number;
};

export type SplitterLeg = {
  leg: number;
  splitterDetailId?: number;
  splitterCode: string;
};

export type SplitterCustomer = {
  tube: string;
  core: string;
  mobile: string;
  mac: string;
  name: string;
  address: string;
  latLng: string;
  online: boolean | null;
  id?: number;
  splitterCode?: string;
  customerMasterId?: number;
  customerDetailId?: number;
  splitterDetailId?: number;
  fiberMappingId?: number;
  routeFiberMappingId?: number;
  routeId?: number;
  fiberMasterId?: number;
  connectivity: string;
  gig: string;
  landmark: string;
};
