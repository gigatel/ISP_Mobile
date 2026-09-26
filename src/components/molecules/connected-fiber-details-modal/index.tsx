import React, {FC, useCallback, useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {useDispatch} from 'react-redux';
import {StoreDispatch} from '@reducers';
import {GetFiberDetailsByISPMasterAPI} from '@slices/route.slice';
import styles from './styles';

type Props = {
  masterId: string | number | null;
  onClose: () => void;
  expanded?: boolean;
};

type ConnectedFiber = {
  gigId: string;
  fiberCode: string;
  tubeNo: string;
  coreNo: string;
  orderNo: string;
  fiberType: string;
  specification: string;
  drumLength: string;
  routeMappingId: string;
};

const text = (value: unknown) => String(value ?? '').trim();

const parseConnectedFibers = (value: unknown): any[] => {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value !== 'string' || !value.trim()) {
    return [];
  }
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const customerText = (value: unknown): string => {
  if (value === null || value === undefined || value === '') {
    return 'No customer details available';
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return typeof parsed === 'string' ? parsed : customerText(parsed);
    } catch {
      return value;
    }
  }
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => {
        const label = key
          .replace(/([a-z])([A-Z])/g, '$1 $2')
          .replace(/^./, character => character.toUpperCase());
        const displayValue =
          typeof item === 'object' && item !== null
            ? JSON.stringify(item)
            : text(item);
        return `${label}: ${displayValue || '--'}`;
      })
      .join('\n');
  }
  return text(value);
};

const ConnectedFiberDetailsModal: FC<Props> = ({
  masterId,
  onClose,
  expanded = false,
}) => {
  const dispatch = useDispatch<StoreDispatch>();
  const [details, setDetails] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadDetails = useCallback(async () => {
    if (!masterId) {
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await dispatch(
        GetFiberDetailsByISPMasterAPI({masterId}),
      ).unwrap();
      setDetails(response);
    } catch (loadError: any) {
      setDetails(null);
      setError(
        loadError?.message || 'Unable to load the connected fiber details.',
      );
    } finally {
      setLoading(false);
    }
  }, [dispatch, masterId]);

  useEffect(() => {
    if (masterId) {
      setDetails(null);
      loadDetails();
    }
  }, [loadDetails, masterId]);

  const connectedFibers = useMemo<ConnectedFiber[]>(() => {
    const seenConnections = new Set<string>();
    return parseConnectedFibers(
      details?.connectedFibers ?? details?.ConnectedFibers,
    )
      .map(fiber => ({
        gigId: text(fiber?.NewFiberMasterId ?? fiber?.newFiberMasterId),
        fiberCode: text(fiber?.FiberCode ?? fiber?.fiberCode),
        tubeNo: text(fiber?.TubeNo ?? fiber?.tubeNo),
        coreNo: text(fiber?.CoreNo ?? fiber?.coreNo),
        orderNo: text(fiber?.OrderNo ?? fiber?.orderNo),
        fiberType: text(fiber?.FiberTypeName ?? fiber?.fiberTypeName),
        specification: text(
          fiber?.FiberSpecificationName ?? fiber?.fiberSpecificationName,
        ),
        drumLength: text(fiber?.DrumLength ?? fiber?.drumLength),
        routeMappingId: text(
          fiber?.RouteFiberMappingId ?? fiber?.routeFiberMappingId,
        ),
      }))
      .filter(fiber => {
        const connectionKey = [
          fiber.gigId,
          fiber.fiberCode,
          fiber.orderNo,
          fiber.tubeNo,
          fiber.coreNo,
        ]
          .map(value => value.toLowerCase())
          .join('|');
        const uniqueKey = connectionKey.replace(/\|/g, '')
          ? connectionKey
          : `mapping:${fiber.routeMappingId}`;
        if (seenConnections.has(uniqueKey)) {
          return false;
        }
        seenConnections.add(uniqueKey);
        return true;
      });
  }, [details]);

  if (!masterId) {
    return null;
  }

  return (
    <View style={styles.mapOverlay} pointerEvents="box-none">
      <View
        style={[
          styles.mapSheet,
          expanded ? styles.expandedMapSheet : styles.compactMapSheet,
        ]}>
        <View style={styles.header}>
          <View style={styles.headerTextBlock}>
            <Text style={styles.eyebrow}>CONNECTED FIBERS</Text>
            <Text numberOfLines={1} style={styles.title}>
              {text(details?.masterType) || 'Master'} ·{' '}
              {text(details?.masterName) || `#${masterId}`}
            </Text>
            {details?.masterCode ? (
              <Text style={styles.masterCode}>{text(details.masterCode)}</Text>
            ) : null}
          </View>
          <TouchableOpacity
            accessibilityLabel="Close connected fiber details"
            accessibilityRole="button"
            activeOpacity={0.75}
            onPress={onClose}
            style={styles.closeButton}>
            <Text style={styles.closeText}>×</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.stateBox}>
            <ActivityIndicator size="small" color="#7546E7" />
            <Text style={styles.stateTitle}>Loading fiber details</Text>
            <Text style={styles.stateText}>
              Getting the latest master data…
            </Text>
          </View>
        ) : error ? (
          <View style={styles.stateBox}>
            <Text style={styles.errorTitle}>Couldn’t load fiber details</Text>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              accessibilityRole="button"
              activeOpacity={0.8}
              onPress={loadDetails}
              style={styles.retryButton}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}>
            {details?.selectedAddress ? (
              <Text numberOfLines={2} style={styles.address}>
                {text(details.selectedAddress)}
              </Text>
            ) : null}
            <View style={styles.masterMetaRow}>
              <Text style={styles.masterMetaText}>
                ID: {text(details?.id) || text(masterId)}
              </Text>
              <Text style={styles.masterMetaText}>
                Lat/Lng: {text(details?.latLng) || '--'}
              </Text>
            </View>
            {details?.placedOnMasterCode || details?.placedEnclosureCode ? (
              <View style={styles.placedBadge}>
                <Text style={styles.placedText}>
                  Placed on:{' '}
                  {text(details?.placedOnMasterCode) ||
                    text(details?.placedEnclosureCode)}
                  {details?.placedEnclosureId
                    ? ` · ID ${text(details.placedEnclosureId)}`
                    : ''}
                  {details?.placedEnclosureType
                    ? ` · ${text(details.placedEnclosureType)}`
                    : ''}
                </Text>
              </View>
            ) : null}

            <Text style={styles.sectionTitle}>
              Fiber connections ({connectedFibers.length})
            </Text>
            {connectedFibers.length ? (
              connectedFibers.map((fiber, index) => (
                <View
                  key={`${fiber.gigId}-${fiber.fiberCode}-${fiber.orderNo}-${index}`}
                  style={styles.fiberCard}>
                  <View style={styles.fiberHeader}>
                    <Text style={styles.fiberCode}>
                      {fiber.fiberCode || 'Fiber'}
                    </Text>
                    <Text style={styles.orderBadge}>
                      Order {fiber.orderNo || '--'}
                    </Text>
                  </View>
                  <View style={styles.detailGrid}>
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>GIG ID</Text>
                      <Text style={styles.detailValue}>
                        {fiber.gigId || '--'}
                      </Text>
                    </View>
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>FIBER TYPE</Text>
                      <Text style={styles.detailValue}>
                        {fiber.fiberType || '--'}
                      </Text>
                    </View>
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>SPECIFICATION</Text>
                      <Text style={styles.detailValue}>
                        {fiber.specification || '--'}
                      </Text>
                    </View>
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>DRUM LENGTH</Text>
                      <Text style={styles.detailValue}>
                        {fiber.drumLength || '--'}
                      </Text>
                    </View>
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>MAPPING ID</Text>
                      <Text style={styles.detailValue}>
                        {fiber.routeMappingId || '--'}
                      </Text>
                    </View>
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>TUBE NO</Text>
                      <Text style={styles.detailValue}>
                        {fiber.tubeNo || '--'}
                      </Text>
                    </View>
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>CORE NO</Text>
                      <Text style={styles.detailValue}>
                        {fiber.coreNo || '--'}
                      </Text>
                    </View>
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>
                No connected fibers were returned for this master.
              </Text>
            )}

            <Text style={styles.sectionTitle}>Customer details</Text>
            <View style={styles.customerCard}>
              <Text style={styles.customerText}>
                {customerText(
                  details?.customerDetails ?? details?.CustomerDetails,
                )}
              </Text>
            </View>
          </ScrollView>
        )}
      </View>
    </View>
  );
};

export default ConnectedFiberDetailsModal;
