import {MapNode} from './mapData';
import {valueOf} from './connectivity';
export type MarkerKind =
  | 'chamber'
  | 'switch'
  | 'splitter'
  | 'point'
  | 'pop'
  | 'enclosure'
  | 'pole'
  | 'tree'
  | 'building'
  | 'customer'
  | 'tiffin'
  | 'master';
export const markerKindOf = (type: string): MarkerKind => {
  const name = type.toLowerCase().replace(/[\s_-]/g, '');
  if (name.includes('chamber') || name === 'mh' || name.includes('manhole')) {
    return 'chamber';
  }
  if (name.includes('switch')) {
    return 'switch';
  }
  if (name.includes('split') || name.includes('fatbox')) {
    return 'splitter';
  }
  if (name.includes('point') || name === 'pnt') {
    return 'point';
  }
  if (name.includes('pop') || name === 'dc') {
    return 'pop';
  }
  if (name.includes('encl')) {
    return 'enclosure';
  }
  if (name.includes('pole')) {
    return 'pole';
  }
  if (name.includes('tree')) {
    return 'tree';
  }
  if (name.includes('building')) {
    return 'building';
  }
  if (name.includes('customer')) {
    return 'customer';
  }
  if (name.includes('tiffin')) {
    return 'tiffin';
  }
  return 'master';
};
export const MARKER_META: Record<MarkerKind, {label: string; color: string}> = {
  chamber: {label: 'Chamber', color: '#B5691E'},
  switch: {label: 'Switch', color: '#2865DC'},
  splitter: {label: 'Splitter', color: '#8051EE'},
  point: {label: 'Point', color: '#218774'},
  pop: {label: 'POP / DC', color: '#3956A1'},
  enclosure: {label: 'Enclosure', color: '#626779'},
  pole: {label: 'Pole', color: '#866749'},
  tree: {label: 'Tree', color: '#448642'},
  building: {label: 'Building', color: '#455C87'},
  customer: {label: 'Customer', color: '#A449B8'},
  tiffin: {label: 'Tiffin', color: '#917339'},
  master: {label: 'Master', color: '#596A7C'},
};
export const markerDetailRows = (node: MapNode) => {
  const data = node.data;
  const isCustomer = markerKindOf(node.type) === 'customer';
  const rows: {label: string; value: string}[] = [];
  const add = (label: string, value: any) => {
    if (value != null && value !== '' && typeof value !== 'object') {
      rows.push({label, value: String(value)});
    }
  };
  add('Type', MARKER_META[markerKindOf(node.type)].label);
  const fields: [string, string[]][] = [
    [
      'Master ID',
      ['deviceMasterId', 'DeviceMasterId', 'masterId', 'MasterId', 'id'],
    ],
    ['Code', ['mastercode', 'masterCode', 'MasterCode', 'deviceCode']],
    [
      'Name',
      [
        'switchName',
        'splitterName',
        'splitterLaymenCode',
        'customerName',
        'masterName',
        'name',
      ],
    ],
    ['Switch ID', ['deviceId', 'DeviceId']],
    ['POP', ['popName', 'PopName', 'POPName']],
    ['Port', ['port', 'portName', 'PortName', 'portNo']],
    ['Rack', ['rackname', 'rackName', 'RackName']],
    ['Rack position', ['rackPosition', 'RackPosition']],
    ['Connection', ['connectVia', 'connectionType', 'customerConnectiontype']],
    ['Splitter type', ['splitterType']],
    ['Endpoint', ['endpoint']],
    ['Order', ['orderNo', 'OrderNo']],
    ['Distance (m)', ['distance']],
    ['Loop (m)', ['loop']],
    [
      'Address',
      isCustomer
        ? ['customerAddress', 'selectedAddress', 'address', 'Address']
        : ['selectedAddress', 'address', 'Address'],
    ],
    ['Landmark', ['landmark']],
    ['Area', ['area', 'areaName', 'AreaName']],
    ['City', ['city']],
    ['State', ['state']],
    ['PIN code', ['pincode']],
    ['Country', ['country']],
    ['Fiber code', ['fiberCode']],
    ['Fiber type', ['fiberTypeName']],
    ['Specification', ['fiberSpecificationName']],
    ['Drum length (m)', ['drumLength']],
    ['Tube', ['tubeNo']],
    ['Core', ['coreNo']],
    ['Placed on', ['placedMasterType']],
    ['Placed master', ['placedTypeName']],
    ['Placed master code', ['placedOnMasterCode']],
    ['Enclosure', ['placedEnclosureCode']],
    ['Status', ['status']],
    ['Remark', ['remarks', 'Remarks', 'splitterRemark', 'remark']],
  ];
  fields.forEach(([label, keys]) => add(label, valueOf(data, ...keys)));
  if (isCustomer) {
    add(
      'Mobile',
      valueOf(data, 'customerMobileNo', 'customerMobile', 'mobileNo', 'mobile'),
    );
  }
  if (node.routeFiberIds.length) {
    add('Route fiber IDs', node.routeFiberIds.join(', '));
  } else {
    const id = Number(valueOf(data, 'routeFiberId', 'RouteFiberId'));
    if (id > 0) {
      add('Route fiber ID', id);
    }
  }
  add(
    'Coordinates',
    `${node.coordinate.latitude}, ${node.coordinate.longitude}`,
  );
  return rows;
};
