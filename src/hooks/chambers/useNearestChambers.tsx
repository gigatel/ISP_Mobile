import {useWatchUserLocation} from '@hooks/useWatchUserLocation';
import {Common} from '@utils';
import {useCallback, useEffect, useState} from 'react';
import {ticketService} from '../../services/ticketService';
import {Chamber} from 'src/types/data-types';
import Geolocation, {
  GeolocationResponse,
} from '@react-native-community/geolocation';
export const useNearestChambers = () => {
  const [chambers, setChambers] = useState<Chamber[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any>(null);

  const fetchChambers = async () => {
    setLoading(true);
    try {
      Geolocation.getCurrentPosition(async pos => {
        const res = await ticketService.getNearestChambers(
          'GTPL',
          pos.coords.latitude,
          pos.coords.longitude,
          200,
        );

        if (res?.success && Array.isArray(res.data)) {
          const mapped: Chamber[] = res.data.map((c: any) => ({
            id: Number(c.id),

            // ✅ UNIQUE KEY (VERY IMPORTANT)
            uniqueKey: `${c.chamber_id}__${c.route_id}`,

            chamberIdStr: `${c.chamber_id} (${c.route_id})`,
            chamberId: c.chamber_id,
            routeId: c.route_id,

            chamberName: c.chamber_name,
            chamberLat: String(c.chamber_latitude),
            chamberLong: String(c.chamber_longitude),

            distance: Number(c.distance ?? 0),
          }));

          setChambers(mapped);
        } else {
          setChambers([]);
        }
      });
    } catch (e) {
      setError(e);
      Common.showToast('Failed to load chambers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChambers();
  }, []);

  return {chambers, loading, error, refetch: fetchChambers};
};
