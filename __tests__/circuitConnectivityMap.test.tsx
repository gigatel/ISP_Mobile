import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {Text, TouchableOpacity, View} from 'react-native';
import {
  markerKindOf,
  markerDetailRows,
} from '../src/screens/InfraConnectivityScreen/markerDetails';
import ConnectivityMap from '../src/screens/InfraConnectivityScreen/ConnectivityMap';
import {customerMapItemsOf} from '../src/screens/InfraConnectivityScreen/customerMapItems';
import {
  buildConnectivityMapData,
  routeFiberIdsOf,
} from '../src/screens/InfraConnectivityScreen/mapData';
import {coordinateOf} from '../src/screens/InfraConnectivityScreen/connectivity';
import {circuitConnectivityService} from '../src/services/circuitConnectivityService';

jest.mock('../src/services/circuitConnectivityService', () => ({
  circuitConnectivityService: {getMasterDetailsByRouteFiberId: jest.fn()},
}));
jest.mock('../src/screens/InfraConnectivityScreen/ConnectivityIcons', () => ({
  MasterMapIcon: () => null,
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({top: 0, bottom: 0, left: 0, right: 0}),
}));
jest.mock('react-native-maps', () => {
  const ReactModule = require('react');
  const NativeView = require('react-native').View;
  return {
    __esModule: true,
    default: ReactModule.forwardRef((props: any, ref: any) =>
      ReactModule.createElement(NativeView, {...props, ref}),
    ),
    Marker: NativeView,
    Polyline: NativeView,
    Circle: NativeView,
  };
});
const request = jest.mocked(
  circuitConnectivityService.getMasterDetailsByRouteFiberId,
);
const masters = [
  {
    id: 2,
    masterName: 'Splitter',
    masterType: 'Splitter',
    orderNo: 2,
    latLng: '28.55,77.26',
    routeFiberMappingId: 0,
  },
  {
    id: 1,
    masterName: 'Point 18',
    masterType: 'Point',
    mastercode: 'PNT-54',
    orderNo: 1,
    latLng: '28.54702488309084,77.24971175492834',
    routeFiberMappingId: 0,
  },
];
let screen: renderer.ReactTestRenderer | undefined;
beforeEach(() => {
  jest.clearAllMocks();
});
afterEach(() => {
  if (screen) {
    act(() => screen!.unmount());
    screen = undefined;
  }
});

test('reads API latLng and deduplicates positive route IDs including nested rows', () => {
  expect(coordinateOf(masters[1])).toEqual({
    latitude: 28.54702488309084,
    longitude: 77.24971175492834,
  });
  expect(
    routeFiberIdsOf([
      {routeFiberMappingId: 18},
      {routes: [{routeFiberMappingId: 18}, {RouteFiberMappingId: 19}]},
      {routeFiberMappingId: 0},
      {routeFiberMappingId: 'bad'},
      {routeFiberId: 99},
      {routeFiberId: 100, routeFiberMappingId: 0},
    ]),
  ).toEqual([18, 19]);
});
test('keeps each fiber path separate, sorts by orderNo, and locates switches by linked master ID', () => {
  const data = buildConnectivityMapData(
    [{deviceMasterId: 1, infraType: 'Switch', switchName: 'Switch A'}],
    [
      {routeFiberId: 18, masters},
      {
        routeFiberId: 19,
        masters: [
          {id: 3, orderNo: 1, masterType: 'Point', latLng: '28.6,77.3'},
          {id: 4, orderNo: 2, masterType: 'Customer', latLng: '28.61,77.31'},
        ],
      },
    ],
  );
  expect(data.paths).toHaveLength(2);
  expect(data.paths[0].coordinates).toEqual([
    {latitude: 28.54702488309084, longitude: 77.24971175492834},
    {latitude: 28.55, longitude: 77.26},
  ]);
  expect(
    data.nodes.find(node => node.title === 'Switch A')?.coordinate,
  ).toEqual(data.paths[0].coordinates[0]);
  expect(data.nodes.some(node => node.type === 'splitter')).toBe(true);
});
test('does not draw a false line across a master with missing coordinates', () => {
  const data = buildConnectivityMapData(
    [],
    [
      {
        routeFiberId: 18,
        masters: [
          masters[1],
          {id: 5, orderNo: 2, latLng: null},
          {...masters[0], orderNo: 3},
        ],
      },
    ],
  );
  expect(data.paths).toHaveLength(0);
  expect(data.nodes).toHaveLength(2);
});
test('loads each unique route and renders ordered polyline coordinates', async () => {
  request.mockResolvedValue({success: true, message: '', data: masters});
  await act(async () => {
    screen = renderer.create(
      <ConnectivityMap
        items={[
          {routeFiberId: 99, routeFiberMappingId: 18},
          {routeFiberId: 100, routeFiberMappingId: 18},
        ]}
        location={{latitude: 28.54, longitude: 77.25}}
        radius={500}
        customer={false}
      />,
    );
  });
  expect(request).toHaveBeenCalledTimes(1);
  expect(request).toHaveBeenCalledWith(18);
  const line = screen!.root
    .findAllByType(View)
    .find(view => view.props.strokeWidth === 3);
  expect(line?.props.coordinates).toEqual([
    {latitude: 28.54702488309084, longitude: 77.24971175492834},
    {latitude: 28.55, longitude: 77.26},
  ]);
});
test('a failed route lookup can be retried on the same map', async () => {
  request
    .mockResolvedValueOnce({success: false, message: 'Offline', data: []})
    .mockResolvedValueOnce({success: true, message: '', data: masters});
  await act(async () => {
    screen = renderer.create(
      <ConnectivityMap
        items={[{routeFiberMappingId: 18}]}
        location={null}
        radius={500}
        customer
      />,
    );
  });
  await act(async () => {
    screen!.root.findByType(TouchableOpacity).props.onPress();
  });
  expect(request).toHaveBeenCalledTimes(2);
  expect(
    screen!.root.findAllByType(View).some(view => view.props.strokeWidth === 3),
  ).toBe(true);
});

test('marker types distinguish chamber, switch, splitter, point, and other masters', () => {
  expect(
    ['Chamber', 'Switch', 'Splitter', 'Point', 'Pole', 'Unknown'].map(
      markerKindOf,
    ),
  ).toEqual(['chamber', 'switch', 'splitter', 'point', 'pole', 'master']);
  expect(markerKindOf('Spliter/FatBox')).toBe('splitter');
});
test('switch details inherit fiber metadata and retain zero values without displaying null fields', () => {
  const data = buildConnectivityMapData(
    [
      {
        deviceMasterId: 1,
        deviceId: 78,
        infraType: 'Switch',
        switchName: 'Switch A',
        port: 'GE0/1',
        rackName: 'Rack 5',
        remarks: null,
      },
    ],
    [
      {
        routeFiberId: 18,
        masters: [
          {
            ...masters[1],
            loop: 0,
            tubeNo: 1,
            coreNo: 12,
            fiberCode: 'OGIG-676',
          },
        ],
      },
    ],
  );
  const node = data.nodes.find(item => item.type === 'switch')!;
  expect(markerDetailRows(node)).toEqual(
    expect.arrayContaining([
      {label: 'Port', value: 'GE0/1'},
      {label: 'Fiber code', value: 'OGIG-676'},
      {label: 'Core', value: '12'},
      {label: 'Loop (m)', value: '0'},
      {label: 'Route fiber IDs', value: '18'},
    ]),
  );
  expect(markerDetailRows(node).some(row => row.label === 'Remark')).toBe(
    false,
  );
});
test('tapping a switch opens its details and the panel can be dismissed', async () => {
  request.mockResolvedValue({success: true, message: '', data: masters});
  await act(async () => {
    screen = renderer.create(
      <ConnectivityMap
        items={[
          {routeFiberMappingId: 18},
          {
            infraType: 'Switch',
            deviceMasterId: 1,
            switchName: 'Switch A',
            port: 'GigabitEthernet0/14',
          },
        ]}
        location={null}
        radius={500}
        customer={false}
      />,
    );
  });
  const marker = screen!.root
    .findAllByType(View)
    .find(view => view.props.accessibilityLabel?.includes('Switch: Switch A'))!;
  await act(async () => {
    marker.props.onPress({stopPropagation: jest.fn()});
  });
  await act(async () => {
    screen!.root
      .findAllByType(TouchableOpacity)
      .find(
        button =>
          button.props.accessibilityLabel === 'Show details for Switch A',
      )!
      .props.onPress();
  });
  expect(
    screen!.root
      .findAllByType(Text)
      .some(text => text.props.children === 'GigabitEthernet0/14'),
  ).toBe(true);
  await act(async () => {
    screen!.root
      .findAllByType(TouchableOpacity)
      .find(
        button => button.props.accessibilityLabel === 'Close master details',
      )!
      .props.onPress();
  });
  expect(
    screen!.root
      .findAllByType(Text)
      .some(text => text.props.children === 'GigabitEthernet0/14'),
  ).toBe(false);
});

test('circuit start/end switches use first and last ordered masters despite differing device-master IDs', () => {
  const circuit = {
    fromDeviceId: 80,
    fromDeviceName: 'Start switch',
    fromPortName: 'GE1',
    toDeviceId: 90,
    toDeviceName: 'End switch',
    toPortName: 'GE2',
    details: [
      {
        deviceId: 80,
        deviceMasterId: 700,
        infraType: 'Switch',
        switchName: 'Start switch',
      },
      {routeFiberMappingId: 18},
      {
        deviceId: 90,
        deviceMasterId: 800,
        infraType: 'Switch',
        switchName: 'End switch',
      },
    ],
  };
  const data = buildConnectivityMapData(
    [circuit],
    [{routeFiberId: 18, masters}],
  );
  const switches = data.nodes.filter(node => node.type === 'switch');
  expect(switches).toHaveLength(2);
  expect(switches.find(node => node.data.deviceId === 80)?.coordinate).toEqual(
    coordinateOf(masters[1]),
  );
  expect(switches.find(node => node.data.deviceId === 90)?.coordinate).toEqual(
    coordinateOf(masters[0]),
  );
  expect(
    markerDetailRows(switches.find(node => node.data.deviceId === 80)!),
  ).toEqual(
    expect.arrayContaining([
      {label: 'Port', value: 'GE1'},
      {label: 'Endpoint', value: 'Route start'},
    ]),
  );
});
test('an intermediate switch connects adjacent route blocks without linking other circuits', () => {
  const nextMasters = [
    {id: 3, orderNo: 1, masterType: 'Point', latLng: '28.55,77.26'},
    {id: 4, orderNo: 2, masterType: 'Point', latLng: '28.56,77.27'},
  ];
  const data = buildConnectivityMapData(
    [
      {
        details: [
          {deviceId: 80, infraType: 'Switch', switchName: 'A'},
          {routeFiberMappingId: 18},
          {deviceId: 90, infraType: 'Switch', switchName: 'B'},
          {routeFiberMappingId: 19},
          {deviceId: 100, infraType: 'Switch', switchName: 'C'},
        ],
      },
      {
        fromDeviceId: 101,
        fromDeviceName: 'Unrelated',
        details: [{routeFiberMappingId: 20}],
      },
    ],
    [
      {routeFiberId: 18, masters},
      {routeFiberId: 19, masters: nextMasters},
    ],
  );
  const shared = data.nodes.find(
    node => node.type === 'switch' && node.data.deviceId === 90,
  )!;
  expect(shared.coordinate).toEqual(coordinateOf(masters[0]));
  expect(shared.routeFiberIds).toEqual([18, 19]);
  expect(data.nodes.some(node => node.data.deviceId === 101)).toBe(false);
});

test('customer mapping IDs trigger the route-master API and draw the splitter/customer connection', async () => {
  const customerMasters = [
    {id: 501, orderNo: 1, masterType: 'Point', latLng: '28.55,77.25'},
    {id: 502, orderNo: 2, masterType: 'Point', latLng: '28.56,77.26'},
  ];
  request.mockResolvedValue({
    success: true,
    message: '',
    data: customerMasters,
  });
  const items = customerMapItemsOf([
    {
      kind: 'splitter',
      data: {splitterId: 5, splitterCode: 'SPL-5', fiberMappingId: 11},
    },
    {
      kind: 'customer',
      data: {
        id: 900,
        routeFiberMappingId: 0,
        splitterId: 5,
        fiberMappingId: 11,
        customerName: 'Map customer',
        customerLatLng: '28.561,77.261',
      },
    },
  ]);
  expect(routeFiberIdsOf(items)).toEqual([11]);
  await act(async () => {
    screen = renderer.create(
      <ConnectivityMap items={items} location={null} radius={0} customer />,
    );
  });
  expect(request).toHaveBeenCalledTimes(1);
  expect(request).toHaveBeenCalledWith(11);
  const data = buildConnectivityMapData(items, [
    {routeFiberId: 11, masters: customerMasters},
  ]);
  expect(data.nodes.find(node => node.type === 'splitter')?.coordinate).toEqual(
    {latitude: 28.55, longitude: 77.25},
  );
  expect(data.nodes.find(node => node.type === 'customer')?.coordinate).toEqual(
    {latitude: 28.561, longitude: 77.261},
  );
  expect(data.paths).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        coordinates: [
          {latitude: 28.56, longitude: 77.26},
          {latitude: 28.561, longitude: 77.261},
        ],
      }),
    ]),
  );
});
test('loads both input/output fibers and attaches customer to its output route, with reverse order supported', () => {
  const items = customerMapItemsOf([
    {
      kind: 'splitter',
      data: {splitterId: 5, fiberMappingId: 11, outFiberMappingId: 12},
    },
    {
      kind: 'customer',
      data: {
        id: 901,
        routeFiberMappingId: 0,
        splitterId: 5,
        fiberMappingId: 11,
        outFiberMappingId: 12,
        customerName: 'C1',
        customerLatLng: '28.5501,77.2501',
      },
    },
  ]);
  expect(routeFiberIdsOf(items)).toEqual([11, 12]);
  const data = buildConnectivityMapData(items, [
    {
      routeFiberId: 12,
      masters: [
        {id: 1, orderNo: 1, masterType: 'Point', latLng: '28.55,77.25'},
        {id: 2, orderNo: 2, masterType: 'Point', latLng: '28.56,77.26'},
      ],
    },
  ]);
  expect(data.nodes.find(node => node.type === 'splitter')?.coordinate).toEqual(
    {latitude: 28.56, longitude: 77.26},
  );
  expect(
    data.paths.find(path => path.key.startsWith('customer-route'))?.coordinates,
  ).toEqual([
    {latitude: 28.55, longitude: 77.25},
    {latitude: 28.5501, longitude: 77.2501},
  ]);
});
