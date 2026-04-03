import {useEffect, useState} from 'react';
import {ticketService} from '../../services';
import {TicketDetailsData} from '../../types/ticket.types';
import {olaReverseGeocode} from '../../services/olaMapsService';

/* ==============================
      PARSE formData.data JSON
    ============================== */
const parseFormDataData = (raw?: string | null) => {
  if (!raw) return {};

  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return {};

    const parsed = arr.reduce((acc: any, item: any) => {
      const key = item?.FieldIdStr;
      if (!key) return acc;

      // ✅ CRITICAL FIX: For temp_circuit, prioritize ValueStr over Value
      // ValueStr contains "TEMP-85-ADN" while Value contains "1026"
      const valueStr =
        item.ValueStr !== null && item.ValueStr !== undefined
          ? String(item.ValueStr).trim()
          : '';

      const value =
        item.Value !== null && item.Value !== undefined
          ? String(item.Value).trim()
          : '';

      // ✅ Use ValueStr first (has display name), then Value (has ID)
      acc[key] =
        valueStr !== ''
          ? valueStr
          : value !== ''
          ? value
          : item.FileBase64 ?? '';

      return acc;
    }, {});

    console.log('🔥 PARSED FORM DATA:', parsed);
    return parsed;
  } catch (e) {
    console.log('❌ Failed to parse formData.data', e);
    return {};
  }
};

/* ==============================
      GET LATEST NOC REMARK
    ============================== */
const getLatestNocRemark = (histories: any[]) => {
  if (!Array.isArray(histories) || histories.length === 0) return '';

  const sorted = [...histories].sort(
    (a, b) =>
      new Date(b.statusUpdatedOn).getTime() -
      new Date(a.statusUpdatedOn).getTime(),
  );
  console.log('sorted_Remark', sorted);
  return (sorted[0]?.remark || '').trim();
};

export const useTicketDetails = (ticketId: string) => {
  const [ticketDetails, setTicketDetails] = useState<TicketDetailsData | null>(
    null,
  );
  const [followUps, setFollowUps] = useState<any[]>([]);
  const [routeRows, setRouteRows] = useState<any[]>([]);
  const [routeAddressMap, setRouteAddressMap] = useState<
    Record<string, string>
  >({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const groupChambersByRoute = (chambers: any[]) => {
    const map: Record<string, any> = {};
    chambers.forEach(ch => {
      if (!ch?.route_id) return;
      if (!map[ch.route_id]) {
        map[ch.route_id] = {
          route_id: ch.route_id,
          route_chambers: [],
        };
      }
      map[ch.route_id].route_chambers.push(ch);
    });
    return Object.values(map);
  };

  /* ==============================
        LOAD TICKET DETAILS
      ============================== */
  const loadTicketDetailsFromAPI = async () => {
    try {
      setLoading(true);
      setError(null);

      const res: any = await ticketService.getComplaintById(ticketId);
      if (!res?.success) {
        setError('Ticket details not found');
        return;
      }

      const apiTicket = res.data;
      const raw = res.raw;
      const formData = res.formData;
      const taskStatusHistories = res.taskStatusHistories || [];

      console.log('🔥 RAW API RESPONSE:', {
        apiTicket,
        formData,
        formDataData: formData?.data,
      });

      /* ==============================
            PARSE FORM DATA
          ============================== */
      const parsedForm = parseFormDataData(formData?.data);
      // ✅ TASK LOCATION (Enter Location)
      const taskLocation =
        parsedForm.field_1 && typeof parsedForm.field_1 === 'string'
          ? parsedForm.field_1
          : '';

      console.log('🔥 PARSED FORM FIELDS:', {
        temp_circuit: parsedForm.temp_circuit,
        circuit_id_with_name: parsedForm.circuit_id_with_name,
        customer_name: parsedForm.customer_name,
        select_company: parsedForm.select_company,
      });

      /* ==============================
            FOLLOW UPS
          ============================== */
      const fu = raw?.followUps || apiTicket?.followUps || [];
      setFollowUps(Array.isArray(fu) ? fu : []);

      /* ==============================
            ROUTES / CHAMBERS
          ============================== */
      let routes: any[] = [];

      if (formData?.routeRowData) {
        try {
          const parsed = JSON.parse(formData.routeRowData);
          if (Array.isArray(parsed)) routes = parsed;
        } catch {}
      } else if (formData?.chamberData) {
        try {
          const chambers = JSON.parse(formData.chamberData);
          if (Array.isArray(chambers)) {
            routes = groupChambersByRoute(chambers);
          }
        } catch {}
      }

      setRouteRows(routes);

      /* ==============================
            OLA ADDRESS (ROUTE LEVEL)
          ============================== */
      const addressMap: Record<string, string> = {};
      for (const r of routes) {
        const chambers = r.route_chambers || [];
        if (!chambers.length) continue;

        const c = chambers[0];
        const lat = Number(c.chamber_latitude);
        const lng = Number(c.chamber_longitude);

        if (!isNaN(lat) && !isNaN(lng)) {
          try {
            const addr = await olaReverseGeocode(lat, lng);
            if (addr?.formattedAddress) {
              addressMap[r.route_id] = addr.formattedAddress;
            }
          } catch {}
        }
      }
      setRouteAddressMap(addressMap);
      console.log('addressApp::', {addressMap}, {apiTicket}, {formData});
      /* ==============================
            FINAL NORMALIZED DATA
          ============================== */
      // ✅ CRITICAL FIX: Check temp_circuit first (contains "TEMP-85-ADN")
      // Then fall back to circuit_id_with_name, then apiTicket.circuitId
      const circuitId =
        parsedForm.temp_circuit ||
        parsedForm.circuit_id_with_name ||
        apiTicket.circuitId ||
        '';
      console.log('🔥 FINAL CIRCUIT ID:', circuitId);
      const normalized: TicketDetailsData = {
        id: apiTicket.id,
        transactionNo: apiTicket.transactionNo,
        company: parsedForm.select_company || 'GTPL',
        customerName: parsedForm.customer_name || apiTicket.customerName,
        // ✅ Task Type FIX (ValueStr of task_list → "New Connections")
        taskType: parsedForm.task_list || '',
        taskLocation: taskLocation,
        circuitId: circuitId,
        circuitFrom: parsedForm.circuit_from || apiTicket.circuitFrom,
        circuitTo: parsedForm.circuit_to || apiTicket.circuitTo,
        otdrFrom: parsedForm.otdr_from || '',
        natureOfFault: parsedForm.nature_of_fault || apiTicket.natureOfFault,
        modeOfComplaint:
          parsedForm.mode_of_complaint || apiTicket.modeOfComplaint,
        otdrLength: parsedForm.field_1 || apiTicket.otdrLength || '',
        remark: parsedForm.remark || apiTicket.remark,
        contactPersonName: parsedForm.field_2 || apiTicket.contactPersonName,
        contactPersonMobile:
          parsedForm.field_3 || apiTicket.contactPersonMobile,
        priority: apiTicket.priority ?? 'medium',
        status: apiTicket.status,
        isStarted: apiTicket.isStarted,
        assignedBy: apiTicket.assignedBy || formData?.assignedByName || '',
        assignedTo: apiTicket.assignedTo || '',
        createdDate: formData?.createdOn || '',
        rfo: formData?.rfo || '',
        irAttachment: parsedForm.ir_attachment || apiTicket.irAttachment,
        nocRemark: getLatestNocRemark(taskStatusHistories),
        closureRemark: parsedForm.closure_remark || '',
        assignedTaskId: formData.assignTaskId,
        fields: apiTicket.fields || [],
      };

      console.log('✅ FINAL NORMALIZED TICKET DETAILS:', {
        id: normalized.id,
        transactionNo: normalized.transactionNo,
        circuitId: normalized.circuitId,
        customerName: normalized.customerName,
      });

      setTicketDetails(normalized);
    } catch (e: any) {
      console.log('❌ useTicketDetails error', e);
      setError(e?.message || 'Failed to load ticket details');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (ticketId) loadTicketDetailsFromAPI();
  }, [ticketId]);
  return {
    ticketDetails,
    followUps,
    routeRows,
    routeAddressMap,
    error,
    loading,
    refetch: loadTicketDetailsFromAPI,
  };
};
