import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {FONTS} from '@res';
import {MasterMapIcon} from './ConnectivityIcons';
import {typeOf} from './connectivity';

export const customerField = (item: any, ...keys: string[]): any => {
  if (!item || typeof item !== 'object') {
    return '';
  }
  for (const key of keys) {
    const actual = Object.keys(item).find(
      name => name.toLowerCase() === key.toLowerCase(),
    );
    if (actual && item[actual] != null && item[actual] !== '') {
      return item[actual];
    }
  }
  return '';
};
const textOf = (value: any) =>
  value === '' || value == null || typeof value === 'object'
    ? '—'
    : String(value);
const powerOf = (value: any) =>
  value === '' || value == null
    ? '—'
    : /dbm/i.test(String(value))
    ? String(value)
    : `${value} dBm`;
export type CustomerCard = {
  kind: 'splitter' | 'customer';
  data: any;
  previous?: boolean;
};
export const customerCardsOf = (items: any[], circuit: any): CustomerCard[] => {
  const defined = (data: any) =>
    Object.fromEntries(
      Object.entries(data || {}).filter(
        ([, value]) => value != null && value !== '',
      ),
    );
  const full = customerField(circuit, 'fullDetails') || {};
  const rawConnections =
    customerField(full, 'splitterDetails') ||
    customerField(circuit, 'splitterDetails');
  const connections = Array.isArray(rawConnections)
    ? rawConnections
    : rawConnections && typeof rawConnections === 'object'
    ? [rawConnections]
    : [];
  const splitters = items.filter(
    item => typeOf(item).includes('split') || typeOf(item).includes('fatbox'),
  );
  const customerDetails = items.filter(item =>
    typeOf(item).includes('customer'),
  );
  const cards: CustomerCard[] = splitters.map(data => ({
    kind: 'splitter',
    data,
  }));
  connections.forEach(connection => {
    const parent = connections.find(
      record =>
        String(customerField(record, 'id')) ===
          String(customerField(connection, 'parentId')) &&
        String(customerField(record, 'splitterId')) ===
          String(customerField(connection, 'splitterId')),
    );
    const splitterData = {...defined(parent), ...defined(connection)};
    // Use physical splitter metadata for the customer leg without replacing
    // that leg's identity or its customer-specific fields.
    [
      'splitterName',
      'splitterLaymenCode',
      'splitterType',
      'address',
      'splitterAddress',
      'landmark',
      'splitterLandmark',
      'masterCode',
    ].forEach(key => {
      const value = customerField(connection, key);
      const inherited = customerField(parent, key);
      if (value !== '' || inherited !== '') {
        splitterData[key] = value !== '' ? value : inherited;
      }
    });
    const splitterRemark =
      customerField(connection, 'splitterRemark') ||
      customerField(parent, 'splitterRemark', 'remarks', 'remark') ||
      customerField(connection, 'remarks', 'remark');
    if (splitterRemark !== '') {
      splitterData.splitterRemark = splitterRemark;
    }
    const splitterId = customerField(connection, 'splitterId');
    const splitterCode = customerField(connection, 'splitterCode');
    const index = cards.findIndex(
      card =>
        card.kind === 'splitter' &&
        ((splitterId !== '' &&
          String(customerField(card.data, 'splitterId')) ===
            String(splitterId) &&
          (splitterCode === '' ||
            customerField(card.data, 'splitterCode') === '' ||
            customerField(card.data, 'splitterCode') === splitterCode)) ||
          (splitterCode !== '' &&
            customerField(card.data, 'splitterCode') === splitterCode)),
    );
    if (index >= 0) {
      cards[index].data = {
        ...defined(cards[index].data),
        ...defined(splitterData),
      };
    } else if (splitterId !== '' || splitterCode !== '') {
      cards.push({kind: 'splitter', data: splitterData});
    }
  });
  const actualCustomers = connections.filter(
    data =>
      customerField(
        data,
        'customerName',
        'customerMobileNo',
        'customerAddress',
        'customerLatLng',
      ) !== '',
  );
  if (actualCustomers.length) {
    actualCustomers.forEach(data =>
      cards.push({
        kind: 'customer',
        data: {
          ...defined(customerDetails[0]),
          ...defined(data),
          remarks:
            customerField(data, 'remarks', 'remark') ||
            customerField(customerDetails[0], 'remarks', 'remark'),
        },
      }),
    );
  } else {
    customerDetails.forEach(data => cards.push({kind: 'customer', data}));
    const standalone =
      customerField(full, 'customer', 'customerDetails') ||
      customerField(circuit, 'customer', 'customerDetails');
    if (standalone && typeof standalone === 'object') {
      (Array.isArray(standalone) ? standalone : [standalone]).forEach(data =>
        cards.push({kind: 'customer', data}),
      );
    }
    if (
      !cards.some(card => card.kind === 'customer') &&
      customerField(
        circuit,
        'customerName',
        'customerMobileNo',
        'customerAddress',
      ) !== ''
    ) {
      cards.push({kind: 'customer', data: circuit});
    }
  }
  // Splitter output legs can share an ID, so their code must also identify the card.
  const unique = cards.filter((card, index) => {
    const identity =
      card.kind === 'splitter'
        ? `${customerField(
            card.data,
            'splitterId',
            'deviceId',
            'masterId',
            'id',
          )}|${customerField(card.data, 'splitterCode', 'masterCode')}`
        : `${customerField(card.data, 'id', 'customerId')}|${customerField(
            card.data,
            'customerName',
          )}|${customerField(card.data, 'customerLatLng')}`;
    return !cards.slice(0, index).some(other => {
      const otherIdentity =
        other.kind === 'splitter'
          ? `${customerField(
              other.data,
              'splitterId',
              'deviceId',
              'masterId',
              'id',
            )}|${customerField(other.data, 'splitterCode', 'masterCode')}`
          : `${customerField(other.data, 'id', 'customerId')}|${customerField(
              other.data,
              'customerName',
            )}|${customerField(other.data, 'customerLatLng')}`;
      return other.kind === card.kind && otherIdentity === identity;
    });
  });
  return [
    ...unique.filter(card => card.kind === 'splitter'),
    ...unique.filter(card => card.kind === 'customer'),
  ];
};
const Row = ({label, value}: {label: string; value: any}) => (
  <View style={styles.row}>
    <Text style={styles.label}>{label}:</Text>
    <Text selectable style={styles.value}>
      {textOf(value)}
    </Text>
  </View>
);
const CORE_COLORS: Record<string, string> = {
  blue: '#2454FF',
  orange: '#F18B27',
  green: '#32924B',
  brown: '#865B3A',
  slate: '#78818E',
  grey: '#78818E',
  gray: '#78818E',
  white: '#FFF',
  red: '#E94444',
  black: '#232323',
  yellow: '#F0C523',
  violet: '#9452CF',
  purple: '#9452CF',
  rose: '#DE7499',
  pink: '#DE7499',
  aqua: '#41C1C5',
};
export default function CustomerConnectivityCards({
  items,
  circuit,
  cards: selectedCards,
}: {
  items: any[];
  circuit: any;
  cards?: CustomerCard[];
}) {
  const cards = selectedCards ?? customerCardsOf(items, circuit);
  if (!cards.length) {
    return (
      <Text style={styles.empty}>
        No splitter or customer information returned for this circuit.
      </Text>
    );
  }
  return (
    <View>
      {cards.map((card, index) => {
        const data = card.data;
        const field = (...keys: string[]) => customerField(data, ...keys);
        const inputPower = field(
          'inputOpticalPower',
          'opticalPowerIn',
          'inputPower',
          'inPower',
          'powerIn',
        );
        const outputPower = field(
          'outputOpticalPower',
          'opticalPowerOut',
          'outputPower',
          'outPower',
          'powerOut',
        );
        const opticalPower =
          field('opticalPower') !== ''
            ? field('opticalPower')
            : inputPower !== '' || outputPower !== ''
            ? `In = ${powerOf(inputPower)} | Out = ${powerOf(outputPower)}`
            : '';
        const coreColor = String(
          field(
            'coreColor',
            'coreColour',
            'colorName',
            'coreColorName',
            'core1Color',
            'core2Color',
          ),
        );
        const color =
          CORE_COLORS[coreColor.toLowerCase()] ||
          (/^#[0-9a-f]{6}$/i.test(coreColor) ? coreColor : undefined);
        return (
          <View key={`${card.kind}-${index}`}>
            <View style={styles.card}>
              <View style={styles.heading}>
                <MasterMapIcon type={card.kind} color="#414550" size={14} />
                <Text style={styles.title}>
                  {card.kind === 'splitter'
                    ? 'Splitter Information'
                    : 'Customer Information'}
                </Text>
              </View>
              {card.kind === 'splitter' ? (
                <>
                  <Row
                    label="Splitter ID"
                    value={field(
                      'splitterCode',
                      'splitterId',
                      'mastercode',
                      'masterCode',
                      'deviceId',
                      'deviceMasterId',
                      'masterId',
                      'id',
                    )}
                  />
                  <Row
                    label="Splitter Name"
                    value={field(
                      'splitterName',
                      'splitterLaymenCode',
                      'masterName',
                      'deviceName',
                      'name',
                    )}
                  />
                  <Row
                    label="Splitter Type"
                    value={
                      card.previous
                        ? field('splitParentLeg') !== ''
                          ? `1:${field('splitParentLeg')}`
                          : ''
                        : field('splitterType', 'splitterRatio', 'ratio')
                    }
                  />
                  <Row label="Optical Power" value={opticalPower} />
                  <Row
                    label="Address"
                    value={field(
                      'splitterAddress',
                      'address',
                      'selectedAddress',
                    )}
                  />
                  <Row
                    label="Landmark"
                    value={field('splitterLandmark', 'landmark')}
                  />
                  <Row
                    label="Remark"
                    value={field('splitterRemark', 'remarks', 'remark')}
                  />
                </>
              ) : (
                <>
                  <Row label="CGIG ID" value={field('fiberMappingId')} />
                  <Row
                    label="Customer Name"
                    value={field(
                      'customerName',
                      'customerCompanyName',
                      'companyName',
                      'masterName',
                      'name',
                    )}
                  />
                  <Row
                    label="Customer Mobile No."
                    value={field(
                      'customerMobile',
                      'customerMobileNo',
                      'mobileNo',
                      'mobile',
                      'contactPersonMobile',
                      'phone',
                    )}
                  />
                  <Row
                    label="Customer Lat Long."
                    value={
                      field('customerLatLng', 'latLng', 'customerLatLong') ||
                      (field('latitude') !== '' && field('longitude') !== ''
                        ? `${field('latitude')}, ${field('longitude')}`
                        : '')
                    }
                  />
                  <Row
                    label="Customer Address"
                    value={field(
                      'customerAddress',
                      'selectedAddress',
                      'address',
                      'endAddress',
                    )}
                  />
                  <Row label="Landmark" value={field('landmark')} />
                  <View style={styles.coreRow}>
                    <Text style={styles.label}>Tube:</Text>
                    <Text style={styles.value}>
                      {textOf(field('tubeNo', 'tubeNumber', 'tube'))}
                    </Text>
                    <Text style={styles.label}>Core:</Text>
                    <Text style={styles.value}>
                      {textOf(field('coreNo', 'coreNumber', 'core1', 'core2'))}
                    </Text>
                    {color && (
                      <View
                        style={[styles.colorDot, {backgroundColor: color}]}
                      />
                    )}
                    {!!coreColor && (
                      <Text style={styles.value}>{coreColor}</Text>
                    )}
                  </View>
                  <Row label="Remarks" value={field('remarks', 'remark')} />
                </>
              )}
            </View>
            {index < cards.length - 1 && <View style={styles.connector} />}
          </View>
        );
      })}
    </View>
  );
}
const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFF',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E8EAF0',
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E8EAF0',
    marginBottom: 6,
  },
  title: {fontFamily: FONTS.MEDIUM, fontSize: 12, color: '#414550'},
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    paddingVertical: 3,
  },
  label: {
    fontFamily: FONTS.MEDIUM,
    fontSize: 11,
    lineHeight: 16,
    color: '#343842',
  },
  value: {
    flexShrink: 1,
    fontFamily: FONTS.REGULAR,
    fontSize: 11,
    lineHeight: 16,
    color: '#515663',
  },
  coreRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 3,
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#A5A8B0',
  },
  connector: {
    alignSelf: 'center',
    width: 0,
    height: 16,
    borderLeftWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#84AFE2',
  },
  empty: {padding: 20, textAlign: 'center', color: '#767B89', fontSize: 12},
});
