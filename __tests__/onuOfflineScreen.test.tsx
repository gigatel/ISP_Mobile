import React from 'react';
import {logOnuDebug} from '../src/services/onuOfflineDiagnostics';
let mockOnFocus: () => void;
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (callback: () => void) => {
    mockOnFocus = callback;
    require('react').useEffect(callback, [callback]);
  },
}));
jest.mock('../src/services/onuOfflineDiagnostics', () => ({
  logOnuDebug: jest.fn(),
}));
import renderer, {act} from 'react-test-renderer';
import {
  ActivityIndicator,
  Modal,
  Text,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import Screen from '../src/screens/OnuOfflineCustomersScreen';
import {OnuCustomer} from '../src/features/onuOffline/model';
let mockRoot: any;
const mockAnimate = jest.fn();
const mockFit = jest.fn();
jest.mock('react-redux', () => ({
  useSelector: (selector: (value: any) => any) => selector(mockRoot),
}));
jest.mock('../src/services/onuOfflineSignalR', () => ({
  retryOnuConnection: jest.fn(),
  ONU_EVENT: 'OnuOfflineCustomersUpdate',
  ONU_HUB_URL: 'http://mob.gigatel.me:7006/isp_signalR_dev/switchshub',
}));
jest.mock('../src/components/molecules/back-header', () => 'BackHeader');
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({bottom: 0}),
}));
jest.mock('../src/res', () => ({
  COLORS: {PRIMARY: 'purple', ERROR: 'red'},
  FONTS: {SEMI_BOLD: 'System'},
}));
jest.mock('react-native-maps', () => {
  const ReactModule = require('react');
  return {
    __esModule: true,
    PROVIDER_GOOGLE: 'google',
    Marker: 'Marker',
    default: ReactModule.forwardRef((props: any, ref: any) => {
      ReactModule.useImperativeHandle(ref, () => ({
        animateToRegion: mockAnimate,
        fitToCoordinates: mockFit,
      }));
      return ReactModule.createElement('MapView', props);
    }),
  };
});
const customer: OnuCustomer = {
  key: '1:2:101',
  CustomerId: '101',
  OrganizationId: '1',
  ServerId: '2',
  CustomerName: 'Example',
  MobNo: '9000',
  LatLng: '28.6139,77.2090',
  IsOnline: false,
  Status: 'Offline',
};
let tree: renderer.ReactTestRenderer;
const pressText = (text: string) => {
  const button = tree.root
    .findAllByType(TouchableOpacity)
    .find(node =>
      node
        .findAllByType(Text)
        .some(label => String(label.props.children).includes(text)),
    );
  expect(button).toBeDefined();
  act(() => button!.props.onPress());
};
beforeEach(() => {
  jest.clearAllMocks();
  mockRoot = {
    onuOffline: {
      records: {[customer.key]: customer},
      status: 'connected',
      error: null,
      receivedAt: '2026-10-29T09:00:00Z',
    },
  };
  act(() => {
    tree = renderer.create(
      <Screen
        navigation={{goBack: jest.fn()} as any}
        route={{key: 'onu', name: 'OnuOfflineCustomers'}}
      />,
    );
  });
});
afterEach(() => act(() => tree.unmount()));
it('searches the live shared list and opens current customer details', () => {
  act(() => tree.root.findByType(TextInput).props.onChangeText('missing'));
  expect(
    tree.root.findAllByProps({accessibilityLabel: 'View details for Example'}),
  ).toHaveLength(0);
  act(() => tree.root.findByType(TextInput).props.onChangeText('9000'));
  act(() =>
    tree.root
      .findByProps({accessibilityLabel: 'View details for Example'})
      .props.onPress(),
  );
  expect(tree.root.findByType(Modal).props.visible).toBe(true);
  expect(
    tree.root.findAllByType(Text).some(node => node.props.children === '101'),
  ).toBe(true);
  mockRoot.onuOffline.records = {
    [customer.key]: {...customer, CustomerName: 'Updated'},
  };
  act(() =>
    tree.update(
      <Screen
        navigation={{goBack: jest.fn()} as any}
        route={{key: 'onu', name: 'OnuOfflineCustomers'}}
      />,
    ),
  );
  expect(
    tree.root
      .findAllByType(Text)
      .some(node => node.props.children === 'Updated'),
  ).toBe(true);
});
it('focuses actual customer coordinates and does not recenter on subsequent live updates', () => {
  pressText('View on Map');
  const map = tree.root.findByType('MapView' as any);
  act(() => map.props.onMapReady());
  expect(mockAnimate).toHaveBeenCalledWith(
    expect.objectContaining({latitude: 28.6139, longitude: 77.209}),
    400,
  );
  expect(tree.root.findAllByType('Marker' as any)).toHaveLength(1);
  mockAnimate.mockClear();
  mockFit.mockClear();
  act(() => map.props.onPanDrag());
  mockRoot.onuOffline.records = {
    ...mockRoot.onuOffline.records,
    '1:2:102': {
      ...customer,
      key: '1:2:102',
      CustomerId: '102',
      LatLng: 'invalid',
    },
  };
  act(() =>
    tree.update(
      <Screen
        navigation={{goBack: jest.fn()} as any}
        route={{key: 'onu', name: 'OnuOfflineCustomers'}}
      />,
    ),
  );
  expect(tree.root.findAllByType('Marker' as any)).toHaveLength(1);
  expect(mockAnimate).not.toHaveBeenCalled();
  expect(mockFit).not.toHaveBeenCalled();
  act(() => tree.root.findByType('Marker' as any).props.onPress());
  pressText('Full customer details');
  expect(tree.root.findByType(Modal).props.visible).toBe(true);
});

it('logs on screen entry and refocus using the latest state without customer details', () => {
  expect(logOnuDebug).toHaveBeenCalledWith(
    'Screen opened',
    expect.objectContaining({
      connectionStatus: 'connected',
      knownOfflineCustomers: 1,
      waitingForLiveData: false,
    }),
  );
  jest.mocked(logOnuDebug).mockClear();
  act(() => tree.root.findByType(TextInput).props.onChangeText('Example'));
  expect(logOnuDebug).not.toHaveBeenCalled();
  mockRoot.onuOffline = {
    ...mockRoot.onuOffline,
    records: {},
    receivedAt: null,
    status: 'connecting',
  };
  act(() =>
    tree.update(
      <Screen
        navigation={{goBack: jest.fn()} as any}
        route={{key: 'onu', name: 'OnuOfflineCustomers'}}
      />,
    ),
  );
  act(() => mockOnFocus());
  expect(logOnuDebug).toHaveBeenCalledWith(
    'Screen opened',
    expect.objectContaining({
      connectionStatus: 'connecting',
      knownOfflineCustomers: 0,
      waitingForLiveData: true,
    }),
  );
  expect(JSON.stringify(jest.mocked(logOnuDebug).mock.calls)).not.toContain(
    'CustomerName',
  );
});

it('keeps loading in both views after connection until the first valid customer response, including an empty response', () => {
  const update = () =>
    act(() =>
      tree.update(
        <Screen
          navigation={{goBack: jest.fn()} as any}
          route={{key: 'onu', name: 'OnuOfflineCustomers'}}
        />,
      ),
    );
  mockRoot.onuOffline = {
    ...mockRoot.onuOffline,
    records: {},
    receivedAt: null,
    status: 'connecting',
  };
  update();
  expect(tree.root.findByType(ActivityIndicator).props.accessibilityLabel).toBe(
    'Loading offline customers',
  );
  mockRoot.onuOffline.status = 'connected';
  update();
  expect(tree.root.findByType(ActivityIndicator).props.accessibilityLabel).toBe(
    'Loading offline customers',
  );
  pressText('Map View');
  expect(tree.root.findByType(ActivityIndicator).props.accessibilityLabel).toBe(
    'Loading offline customers',
  );
  expect(tree.root.findAllByType('MapView' as any)).toHaveLength(0);
  mockRoot.onuOffline.receivedAt = '2026-11-03T09:00:00Z';
  update();
  expect(tree.root.findAllByType(ActivityIndicator)).toHaveLength(0);
  expect(tree.root.findAllByType('MapView' as any)).toHaveLength(1);
  expect(
    tree.root
      .findAllByType(Text)
      .some(node => node.props.children === 'No known offline customers.'),
  ).toBe(true);
});

it('retains received customers through reconnection and displays the next backend update', () => {
  const update = () =>
    act(() =>
      tree.update(
        <Screen
          navigation={{goBack: jest.fn()} as any}
          route={{key: 'onu', name: 'OnuOfflineCustomers'}}
        />,
      ),
    );
  mockRoot.onuOffline.status = 'reconnecting';
  update();
  expect(
    tree.root.findAllByProps({accessibilityLabel: 'View details for Example'})
      .length,
  ).toBeGreaterThan(0);
  expect(
    tree.root
      .findAllByType(ActivityIndicator)
      .some(
        node => node.props.accessibilityLabel === 'Loading offline customers',
      ),
  ).toBe(false);
  mockRoot.onuOffline = {
    ...mockRoot.onuOffline,
    status: 'connected',
    receivedAt: '2026-11-03T09:01:00Z',
    records: {
      [customer.key]: {...customer, CustomerName: 'Refreshed customer'},
    },
  };
  update();
  expect(
    tree.root.findAllByProps({
      accessibilityLabel: 'View details for Refreshed customer',
    }).length,
  ).toBeGreaterThan(0);
  expect(tree.root.findAllByType(ActivityIndicator)).toHaveLength(0);
});
