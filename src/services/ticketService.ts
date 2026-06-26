// // src/services/ticketService.ts - ENHANCED with Issue Types
// import { APIs, URLs } from '../apis';
// import { Common, Preferences } from '@utils';
// import axios from 'axios';
// import { getAddressFromCoordinates, postRequestWithJson } from '../apis/apis';
// import { BASE_URL, BASE_URL_2, BASE_URL_4, BASE_URL_6 } from '../apis/urls';
// import { ApiResponse, GeoLocation } from 'src/types/data-types';
// import {
//   FollowUpDataGtpl,
//   GetTicketsRequest,
//   ParsedFormData,
//   RawTicketData,
//   TicketAPIResponse,
//   TicketData,
//   TicketDataGtpl,
// } from '../types/ticket.types';
// import {
//   BasicFollowUpPayload,
//   FollowUpWithIssuePayload,
//   IssueTypesResponse,
//   IssueWorkTypesResponse,
// } from '../types/issue-type';
// const API_ENDPOINTS = {
//   GTPL_SUPPORT: {
//     BASE_URL: BASE_URL_4,
//     ADD_FOLLOW_UP: 'Complaint/AddFollowUps',
//     GET_FOLLOW_UP_LIST: 'Tickets/FollowUpList',
//     GET_COMPLAINT_BY_ID: 'Complaint/GetComplaintById',
//   },
//   GTPL_FLEET: {
//     BASE_URL: BASE_URL_2,
//     ADD_COMPLAINT_FOLLOW_UP: 'Complaint/AddComplaintFollowUp',
//     GET_TYPE_DD: 'TypeOfWork/GetTypeDD',
//     GET_TYPE_OF_WORK_DD: 'TypeOfWork/GetTypeOfWorkDD',
//   },
//   GIGATEL_MAIN: {
//     BASE_URL: BASE_URL_6,
//     GET_NEAREST_CHAMBERS: 'Chamber/GetNearestChambersList',
//   },
// };
// class TicketService {
//   public getEmployeeData() {
//     try {
//       const authToken = Preferences.getData('API_AUTH_TOKEN');
//       const loginResponse = Preferences.getData('LOGIN_RESPONSE');
//       console.log('loginResponse', loginResponse);
//       return {
//         empId: loginResponse.employeeId,
//         companyId: loginResponse.companyId,
//         userId: loginResponse.userId,
//         fullName: loginResponse.UserFullName,
//       };
//     } catch (error) {
//       Common.error('❌ Error parsing JWT token:', error);
//       throw error;
//     }
//   }
//   private parseFormData(dataString: string): ParsedFormData {
//     try {
//       const formFields = JSON.parse(dataString);
//       const parsed: any = {};

//       // Map to final output
//       const finalOutput = formFields.map((f: any) => ({
//         fieldId: f.FieldId,
//         fieldKey: f.FieldIdStr,
//         label: f.LableName,
//         value: f.Value, // prefer ValueStr if 
//         type: f.Type,
//       }));
//       formFields.forEach((field: any) => {
//         switch (field.FieldIdStr) {
//           case 'customer_name':
//             parsed.customerName = field.ValueStr || field.Value || '';
//             break;
//             case 'circuit_id_with_name':
//               // ✅ Complaint list must show readable circuit name
//               parsed.circuitId = field.ValueStr || field.Value || '';
//               break;
//           case 'circuit_from':
//             parsed.circuitFrom = field.Value || '';
//             break;
//           case 'circuit_to':
//             parsed.circuitTo = field.Value || '';
//             break;
//           case 'otdr_length':
//             parsed.otdrLength = field.Value || '';
//             break;
//           case 'nature_of_fault':
//             parsed.natureOfFault = field.ValueStr || field.Value || '';
//             break;
//           case 'mode_of_complaint':
//             parsed.modeOfComplaint = field.ValueStr || field.Value || '';
//             break;
//           case 'field_2':
//             parsed.contactPersonName = field.Value || '';
//             break;
//           case 'field_3':
//             parsed.contactPersonMobile = field.Value || '';
//             break;
//           case 'remark':
//             parsed.remark = field.Value || '';
//             break;
//           case 'otdr_available':
//             parsed.otdrAvailable = field.ValueStr || field.Value || '';
//             break;

//           case 'ir_attachment':
//             parsed.irAttachment = field.Value || '';
//             break;
//         }
//       });

//       parsed.fields = finalOutput;
//       return parsed as ParsedFormData;
//     } catch (error) {
//       Common.error('Error parsing form data:', error);
//       return {} as ParsedFormData;
//     }
//   }
//   async addBasicFollowUp(
//     payload: BasicFollowUpPayload,
//     location: GeoLocation,
//   ): Promise<ApiResponse> {
//     try {
//       const address =
//         (await getAddressFromCoordinates(
//           location.coords.latitude,
//           location.coords.longitude,
//         )) || `${location.coords.latitude}, ${location.coords.longitude}`;

//       const requestData = {
//         ...payload,
//         lat: location.coords.latitude.toString(),
//         lng: location.coords.longitude.toString(),
//         address,
//       };

//       Common.log('🚀 Phase 1: Basic Follow-up', requestData);

//       const response = await postRequestWithJson({
//         path: `${API_ENDPOINTS.GTPL_SUPPORT.BASE_URL}${API_ENDPOINTS.GTPL_SUPPORT.ADD_FOLLOW_UP}`,
//         params: requestData,
//         isAuth: true,
//         checkNetSpeed: false,
//       });

//       return {
//         success: response.status === '200',
//         status: response.status || 500,
//         message: response.message || 'Basic follow-up submitted',
//         data: response.data,
//       };
//     } catch (error: any) {
//       Common.error('❌ Basic Follow-up Error:', error);
//       return {
//         success: false,
//         status: 500,
//         message:
//           (error?.message as string) || 'Failed to submit basic follow-up',
//         data: null,
//       };
//     }
//   }
//    // Get issue categories (Chamber, Enclosure, Tiffin)
//   async getTypeDD(): Promise<IssueTypesResponse> {
//     try {
//       Common.log('🏷️ Getting Issue Categories (TypeDD)');

//       const res = await fetch(
//         `${URLs.getChamberOtherMaintenance}`,
//         {
//           method: 'GET',
//           headers: {
//             'Content-Type': 'application/json',
//             Authorization: `Bearer ${Preferences.getData('API_AUTH_TOKEN')}`,
//           },
//         },
//       );
//       if (!res.ok) {
//         const txt = await res.text();
//         throw new Error(`HTTP ${res.status}: ${txt.slice(0, 120)}…`);
//       }
//       const data = await res.json();
//       Common.log('✅ Issue Categories fetch success:', data);
//       return {
//         status: data?.status || '200',
//         success: !!(data && data.success),
//         data: data?.data ?? [],
//         message: data?.message || 'Issue categories loaded successfully',
//       };
//     } catch (error: any) {
//       Common.error('❌ Issue Categories Error:', error);
//       return {
//         status: '500',
//         success: false,
//         data: [],
//         message: 'Failed to load issue categories',
//       };
//     }
//   }

//   // Phase 2: Follow-up with Issues (Conditional - only if issues found)
//   async addComplaintFollowUpWithIssue(
//     payload: FollowUpWithIssuePayload,
//     location: GeoLocation,
//   ): Promise<ApiResponse> {
//     try {
//       const requestData = {
//         ...payload,
//         lat: location.coords.latitude.toString(),
//         lng: location.coords.longitude.toString(),
//         gpsLocation: `${location.coords.latitude},${location.coords.longitude}`,
//       };
//       Common.log('🔧 Phase 2: Issue Follow-up', requestData);
//       const response = await postRequestWithJson({
//         path: `${BASE_URL}${API_ENDPOINTS.GTPL_SUPPORT.ADD_FOLLOW_UP}`,
//         params: requestData,
//         isAuth: true,
//         checkNetSpeed: false,
//       });
//       return {
//         success: response.status === '200' && response.success,
//         status: response.status || 500,
//         message: response.message || 'Issue follow-up submitted',
//         data: response.data,
//       };
//     } catch (error: any) {
//       Common.error('❌ Issue Follow-up Error:', error);
//       return {
//         success: false,
//         status: 500,
//         message: (error?.message as string) || 'Failed to submit issue details',
//         data: null,
//       };
//     }
//   }
//   // ✅ Enhanced transformation with chamber detection
//   private transformTicketData(rawTicket: RawTicketData): TicketData {
//   Common.log('🔍 rawTicket:', rawTicket);

//   const isTask = rawTicket.moduleName === 'TASK';

//   // ===============================
//   // ✅ COMPLAINT → old logic as-is
//   // ===============================
//   let formData: ParsedFormData = {} as ParsedFormData;

//   if (!isTask) {
//     // ⚠️ COMPLAINT FLOW – DO NOT CHANGE
//     formData = this.parseFormData(rawTicket.data);
//   }

//   // ===============================
//   // ✅ TASK → SAFE MANUAL PARSE
//   // ===============================
//   // ===============================
//   // ✅ TASK → SAFE MANUAL PARSE
//   // ===============================
//   let taskForm: any = {};
//   let taskFields: any[] = [];

//   if (isTask && rawTicket.data) {
//     try {
//       const arr = JSON.parse(rawTicket.data);
//       if (Array.isArray(arr)) {
//         arr.forEach(f => {
//           const key = f.FieldIdStr;
//           if (!key) return;

//           const vStr =
//             f.ValueStr !== null && f.ValueStr !== undefined
//               ? String(f.ValueStr).trim()
//               : '';
//           const v =
//             f.Value !== null && f.Value !== undefined
//               ? String(f.Value).trim()
//               : '';

//           // 🔹 key-value object
//           taskForm[key] = vStr || v;

//           // 🔹 fields array (TicketDetailsScreen ke liye)
//           taskFields.push({
//             fieldKey: key,
//             label: f.LableName,
//             value: vStr || v,
//             type: f.Type,
//           });
//         });
//       }
//     } catch (e) {
//       Common.log('❌ TASK formData parse failed');
//     }
//   }


//   // ===============================
//   // ✅ TASK TYPE + CHAMBERS
//   // ===============================
//   const ticketType = isTask ? 'task' : 'complaint';

//   let taskType: 'circuit' | 'route' | 'miscellaneous' | undefined;
//   let hasChamber = false;
//   let chamberCount = 0;

//   if (isTask) {
//     // Route task
//     if (rawTicket.routeData && rawTicket.routeData !== '[]') {
//       try {
//         const routeData = JSON.parse(rawTicket.routeData);
//         if (Array.isArray(routeData) && routeData.length > 0) {
//           chamberCount = routeData.length;
//           hasChamber = true;
//           taskType = 'route';
//         }
//       } catch {}
//     }

//     // Circuit task
//     if (
//       rawTicket.circuitChamberData &&
//       rawTicket.circuitChamberData !== '[]'
//     ) {
//       try {
//         JSON.parse(rawTicket.circuitChamberData);
//         chamberCount = 1;
//         hasChamber = true;
//         taskType = 'circuit';
//       } catch {}
//     }

//     if (!taskType) taskType = 'miscellaneous';
//   }

//   // ===============================
//   // ✅ CIRCUIT ID (MAIN FIX)
//   // ===============================
//   const circuitId = isTask
//     ? taskForm.temp_circuit ||
//       taskForm.circuit_id_with_name ||
//       ''
//     : formData.circuitId || '';

//   // ===============================
//   // ✅ FINAL RETURN (SAFE)
//   // ===============================
//   return {
//     id: rawTicket.id.toString(),
//     ticketNo: rawTicket.transactionNo,
//     transactionNo: rawTicket.transactionNo,
//     description: isTask
//       ? taskForm.remark || 'No description available'
//       : formData.remark || 'No description available',
//     assignedDate: rawTicket.assignedOn,
//     priority: this.determinePriority(
//       isTask ? '' : formData.natureOfFault,
//     ),
//     status: this.mapStatus(rawTicket.status),
//     ticketEndTime: rawTicket.ticketEndTime,
//     customerName: isTask
//       ? taskForm.customer_name || rawTicket.taskGroupName || 'N/A'
//       : formData.customerName || 'Unknown Customer',
//     customerMobile: isTask
//       ? taskForm.field_3 || ''
//       : formData.contactPersonMobile || '',
//     ticketType,
//      taskType: isTask
//       ? taskForm.task_list || rawTicket.taskGroupName || 'Task'
//       : undefined,
//         hasChamber,
//         chamberCount,
//     // Location
//     circuitFrom: isTask ? '' : formData.circuitFrom || '',
//     circuitTo: isTask ? '' : formData.circuitTo || '',
//     circuitId,    // Assignment
//     assignedTo: rawTicket.assignedTo || '',
//     assignedBy: rawTicket.assignedByName || '',
//     // Contact
//     contactPersonName: isTask
//       ? taskForm.field_2 || ''
//       : formData.contactPersonName || '',
//     contactPersonMobile: isTask
//       ? taskForm.field_3 || ''
//       : formData.contactPersonMobile || '',
//     // Technical
//     natureOfFault: isTask ? '' : formData.natureOfFault || '',
//     modeOfComplaint: isTask ? '' : formData.modeOfComplaint || '',
//     otdrLength: isTask ? '' : formData.otdrLength || '',
//     remark: isTask ? taskForm.remark || '' : formData.remark || '',
//     // Status
//     isStarted: rawTicket.isStartedByEmp || false,
//     startTime: rawTicket.ticketStartTime,
//     endTime: rawTicket.ticketEndTime,

//     // Raw
//     rawData: rawTicket,
// formData: isTask
//   ? { ...taskForm, fields: taskFields }
//   : formData,
//   };
// }
 
//   //  ticketEndTime: rawTicket.ticketEndTime,


//   private determinePriority(natureOfFault: string): 'high' | 'medium' | 'low' {
//     const faultLower = natureOfFault?.toLowerCase() || '';
//     if (
//       faultLower.includes('cut') ||
//       faultLower.includes('down') ||
//       faultLower.includes('outage')
//     ) {
//       return 'high';
//     }
//     if (
//       faultLower.includes('slow') ||
//       faultLower.includes('intermittent') ||
//       faultLower.includes('partial')
//     ) {
//       return 'medium';
//     }
//     return 'low';
//   }

//   private mapStatus(
//     apiStatus: string,
//   ): 'assigned' | 'in-progress' | 'completed' | 'closed' {
//     switch (apiStatus?.toLowerCase()) {
//       case 'assigned':
//         return 'assigned';
//       case 'in progress':
//       case 'inprogress':
//       case 'started':
//         return 'in-progress';
//       case 'completed':
//       case 'finished':
//         return 'completed';
//       case 'closed':
//         return 'closed';
//       default:
//         return 'assigned';
//     }
//   }
//   async getTickets(request: Partial<GetTicketsRequest> = {}) {
//     try {
//       const employeeData = this.getEmployeeData();
//       console.log('employeeData', employeeData);
//       console.log('request', request);
//       const requestPayload: GetTicketsRequest = {
//         moduleName: 'COMPLAINTS',
//         ...request,
//         formId: 0,
//         empId: employeeData.empId,
//         date: request.date || '2025-08-13',
//         companyId: employeeData.companyId,
//       };
//       Common.log('🎫 API Request:', requestPayload);
//       const response = (await postRequestWithJson({
//         path: URLs.getEmpComplaintsOfDate,
//         params: requestPayload,
//         isAuth: true,
//       })) as TicketAPIResponse;
//       Common.log('🎫 API Response:', response);
//       if (response && response.data && Array.isArray(response.data)) {
//         const transformedTickets = response.data.map(rawTicket =>
//           this.transformTicketData(rawTicket),
//         );
//         return {
//           status: 'success',
//           message: `Loaded ${transformedTickets.length} tickets`,
//           data: transformedTickets,
//           success: true,
//         };
//       } else {
//         return {
//           status: 'error',
//           message: 'No tickets found',
//           data: [],
//           success: false,
//         };
//       }
//     } catch (error) {
//       Common.error('❌ Get Tickets Error:', error);
//       return {
//         status: 'error',
//         message: 'Failed to fetch tickets',
//         data: [],
//         success: false,
//       };
//     }
//   }
//   // FIXED: getTicketDetails method to preserve followUps data
//   // FIXED: getTicketDetails method to preserve followUps data
//   async getTicketDetails(ticketId: string) {
//   try {
//     const response = await APIs.getRequestWithQuery({
//       path: `${URLs.getComplaintById}${ticketId}`,
//       isAuth: true,
//     });

//     if (response && response.data) {
//       return {
//         status: 'success',
//         success: true,
//         data: {
//           // ✅ PASS FULL RAW OBJECT
//           ...this.transformTicketData(response.data),

//           // preserve extras
//           followUps: response.data.followUps || [],
//           taskStatusHistories: response.data.taskStatusHistories || [],
//           taskEmps: response.data.taskEmps || [],
//         },
//       };
//     }

//     return {
//       status: 'error',
//       success: false,
//       data: null,
//     };
//   } catch (error) {
//     Common.error('❌ getTicketDetails error:', error);
//     return {
//       status: 'error',
//       success: false,
//       data: null,
//     };
//   }
// }


//   async getCustomerListAPI() {
//     try {
//       const apiUrl = `${URLs.getCustomerListMob}?requestFrom=customer_portal`;

//       Common.log('📡 Fetching Customer List:', apiUrl);

//       const response = await APIs.getRequestWithQuery({
//         path: apiUrl,
//         isAuth: true,
//       });

//       Common.log('🎫 Customer List Response:', response);

//       if (response?.success && Array.isArray(response.data)) {
//         return {
//           success: true,
//           message: 'Customer list loaded',
//           data: response.data,
//         };
//       }



//       return {
//         success: false,
//         message: 'No customers found',
//         data: [],
//       };
//     } catch (error: any) {
//       Common.error('❌ Customer List API Error:', error);
//       return {
//         success: false,
//         message: error?.message || 'Failed to load customer list',
//         data: [],
//       };
//     }
//   }

//   async getCircuitListAPI(customerId: number) {
//     try {
//       const apiUrl = `${URLs.getCircuitListByCustomerMob}?customerCompanyId=${customerId}`;

//       Common.log('📡 Fetching Circuit List:', apiUrl);

//       const response = await APIs.getRequestWithQuery({
//         path: apiUrl,
//         isAuth: true,
//       });

//       Common.log('🎫 Circuit List Response:', response);

//       if (response?.success && Array.isArray(response.data)) {
//         return {
//           success: true,
//           message: 'Circuit list loaded',
//           data: response.data,
//         };
//       }
//       return {
//         success: false,
//         message: 'No circuit found',
//         data: [],
//       };
//     } catch (error: any) {
//       Common.error('❌ Circuit List API Error:', error);
//       return {
//         success: false,
//         message: error?.message || 'Failed to load circuit list',
//         data: [],
//       };
//     }
//   }
//   async get(customerId: number) {
//     try {
//       const apiUrl = `${URLs.getCircuitListByCustomerMob}?customerCompanyId=${customerId}`;

//       Common.log('📡 Fetching Circuit List:', apiUrl);

//       const response = await APIs.getRequestWithQuery({
//         path: apiUrl,
//         isAuth: true,
//       });

//       Common.log('🎫 Circuit List Response:', response);

//       if (response?.success && Array.isArray(response.data)) {
//         return {
//           success: true,
//           message: 'Circuit list loaded',
//           data: response.data,
//         };
//       }
//       return {
//         success: false,
//         message: 'No circuit found',
//         data: [],
//       };
//     } catch (error: any) {
//       Common.error('❌ Circuit List API Error:', error);
//       return {
//         success: false,
//         message: error?.message || 'Failed to load circuit list',
//         data: [],
//       };
//     }
//   }
//   async getNearestChamberList(circuitId: string) {
//     try {
//       if (!circuitId) {
//         return {
//           success: false,
//           message: 'Circuit ID is missing',
//           data: [],
//         };
//       }
//       const apiUrl = `${URLs.getNearestChamberListAPI}?circuitId=${circuitId}`;
//       Common.log('📡 Fetching Nearest Chamber List:', apiUrl);
//       const response = await APIs.getRequestWithQuery({
//         path: apiUrl,
//         isAuth: true,
//       });
//       Common.log('🎫 Nearest Chamber Response:', response);
//       if (response?.success && Array.isArray(response.data)) {
//         return {
//           success: true,
//           message: 'Chamber list loaded',
//           data: response.data,
//         };
//       }
//       return {
//         success: false,
//         message: 'No chambers found',
//         data: [],
//       };
//     } catch (error: any) {
//       Common.error('❌ Nearest Chamber API Error:', error);
//       return {
//         success: false,
//         message: error?.message || 'Failed to load nearest chambers',
//         data: [],
//       };
//     }
//   }
//   async getFollowUps(ticketId: string) {
//     try {
//       const employeeData = this.getEmployeeData();
//       const requestPayload = {
//         empId: employeeData.empId,
//         ticketId: ticketId,
//       };
//       const response = await APIs.postRequestWithJson({
//         path: 'Tickets/FollowUpList',
//         params: requestPayload,
//         isAuth: true,
//       });
//       if (response && response.data && Array.isArray(response.data)) {
//         return {
//           status: 'success',
//           message: `Loaded ${response.data.length} follow-ups`,
//           data: response.data,
//           success: true,
//         };
//       } else {
//         return {
//           status: 'success',
//           message: 'No follow-ups found',
//           data: [],
//           success: true,
//         };
//       }
//     } catch (error) {
//       Common.log('❌ Get Follow-ups Error (non-critical):', error);
//       return {
//         status: 'success', // Don't fail the whole screen
//         message: 'Follow-ups not available',
//         data: [],
//         success: true,
//       };
//     }
//   }

//   // Get ticket details (matching getTicketDetailsGTPL)
//   async getTicketDetailsGtpl(ticketId: string) {
//     try {
//       const response = await APIs.getRequestWithQuery({
//         path: `Complaint/GetComplaintById?id=${ticketId}`,
//         isAuth: true,
//       });

//       if (response?.data?.formData) {
//         return {
//           status: 'success',
//           success: true,
//           data: response.data.formData as TicketDataGtpl,
//         };
//       }

//       return { status: 'error', success: false, data: null };
//     } catch (error) {
//       Common.error('Get ticket details error:', error);
//       return { status: 'error', success: false, data: null };
//     }
//   }

//   // Get follow-ups (matching followUpList)
//   async getFollowUpsGtpl(ticketId: string) {
//     try {
//       const employeeData = this.getEmployeeData();
//       const payload = {
//         empId: employeeData.empId,
//         ticketId: ticketId,
//       };

//       const response = await APIs.postRequestWithJson({
//         path: 'Tickets/FollowUpList',
//         params: payload,
//         isAuth: true,
//       });

//       if (response?.data) {
//         return {
//           status: 'success',
//           success: true,
//           data: response.data as FollowUpDataGtpl[],
//         };
//       }

//       return { status: 'error', success: false, data: [] };
//     } catch (error) {
//       Common.error('Get follow-ups error:', error);
//       return { status: 'error', success: false, data: [] };
//     }
//   }

//   // Get RFO reasons (matching getRfoList)
//   async getRfoReasons() {
//     try {
//       const response = await APIs.getRequestWithQuery({
//         path: 'RFOMaster/GetRFOMasterDD',
//         isAuth: true,
//       });

//       if (response?.data) {
//         return {
//           success: true,
//           data: response.data,
//         };
//       }

//       return { success: false, data: [] };
//     } catch (error) {
//       Common.error('Get RFO reasons error:', error);
//       return { success: false, data: [] };
//     }
//   }

//   // Update RFO status (matching updateRfoStatus)
//   async updateRfoStatus(
//     ticketId: string,
//     rfoId: string,
//     comment: string,
//     status: string = 'Task Complete',
//   ) {
//     try {
//       const employeeData = this.getEmployeeData();
//       const payload = {
//         rfoId: 0,
//         formDataId: ticketId,
//         comment: comment,
//         status: status,
//         empId: employeeData.empId,
//       };

//       const response = await APIs.postRequestWithJson({
//         path: 'Complaint/UpdateTaskRFO',
//         params: payload,
//         isAuth: true,
//       });

//       if (response?.status === '200') {
//         return {
//           success: true,
//           message: 'Status updated successfully',
//         };
//       }

//       return { success: false, message: 'Failed to update status' };
//     } catch (error) {
//       Common.error('Update RFO status error:', error);
//       return { success: false, message: 'Failed to update status' };
//     }
//   }

//   // If fetch works, update your service
//   async getComplaintById(ticketId: string) {
//   try {
//     if (!ticketId) {
//       throw new Error('Ticket ID missing');
//     }

//     const token = Preferences.getData('API_AUTH_TOKEN');
//     const apiUrl = `${URLs.getComplaintById}${ticketId}`;

//     Common.log('📡 Fetching Complaint By ID:', apiUrl);

//     const response = await fetch(apiUrl, {
//       method: 'GET',
//       headers: {
//         'Content-Type': 'application/json',
//         Authorization: `Bearer ${token}`,
//       },
//     });

//     if (!response.ok) {
//       const txt = await response.text();
//       throw new Error(`HTTP ${response.status}: ${txt.slice(0, 120)}…`);
//     }

//     const apiResponse = await response.json();
//     Common.log('✅ getComplaintById response:', apiResponse);

//     if (!apiResponse?.success || !apiResponse?.data) {
//       throw new Error('Invalid API response');
//     }

//     const formData = apiResponse.data.formData;
//     const parsedFormFields = this.parseFormData(formData?.data);

//     // ✅ IMPORTANT: taskStatusHistories EXTRACT
//     const taskStatusHistories =
//       apiResponse.data.taskStatusHistories || [];

//     // ✅ Latest Status
//     const latestStatus =
//       [...taskStatusHistories]
//         .sort(
//           (a, b) =>
//             new Date(b.statusUpdatedOn).getTime() -
//             new Date(a.statusUpdatedOn).getTime(),
//         )[0]?.status || 'assigned';

//     return {
//       success: true,
//       status: 'success',
//       message: 'Complaint loaded successfully',

//       // 🔥 RAW API DATA
//       raw: apiResponse.data,

//       // 🔥 FORM DATA
//       formData: formData,

//       // 🔥 VERY IMPORTANT (FOR NOC REMARK)
//       taskStatusHistories: taskStatusHistories,

//       // 🔥 MAIN NORMALIZED DATA
//       data: {
//         id: formData.id.toString(),
//         transactionNo: formData.transactionNo,
//         customerName: parsedFormFields.customerName || '',
//         circuitId: parsedFormFields.circuitId || '',
//         circuitFrom: parsedFormFields.circuitFrom || '',
//         circuitTo: parsedFormFields.circuitTo || '',
//         natureOfFault: parsedFormFields.natureOfFault || '',
//         status: latestStatus,
//         contactPersonName: parsedFormFields.contactPersonName || '',
//         contactPersonMobile: parsedFormFields.contactPersonMobile || '',
//         assignedTo: formData.assignedTo || '',
//         assignedBy: formData.assignedByName || '',
//         assignedDate: formData.assignedOn || '',
//         remark: parsedFormFields.remark || '',
//         priority: this.determinePriority(parsedFormFields.natureOfFault),
//         isStarted: latestStatus === 'In Progress',
//         rfo: formData.rfo || '',
//         irAttachment: parsedFormFields.irAttachment || '',
//         fields: parsedFormFields.fields || [],
//       },
//     };
//   } catch (error: any) {
//     Common.error('❌ getComplaintById failed:', error);
//     return {
//       success: false,
//       status: 'error',
//       message: error?.message || 'Failed to fetch complaint',
//     };
//   }
// }
//   async getNearestChambers(
//     companyCode = 'GTPL',
//     latitude?: number,
//     longitude?: number,
//     range?: number,
//   ) {
//     const url =
//       `${URLs.getTicketDropDown}`
//     const params = { companyCode, latitude, longitude, range };
//     const token = Preferences.getData('API_AUTH_TOKEN');
//     Common.log('getTicketDropDown:',{params})
//     Common.log('Token:', token);
//     const axiosOpts: any = { params };
//     if (token) {
//       axiosOpts.headers = { Authorization: `Bearer ${token}` };
//     }
//     Common.log('➡️  Chamber params', params);
//     const { data } = await axios.get(url, axiosOpts);
//     Common.log('🔑 Axios opts:', axiosOpts,url);
//     Common.log('⬅️  Chamber resp', data);
//     return {
//       success: data?.success === true,
//       data: Array.isArray(data?.data) ? data.data.slice(0, 12) : [],
//     };
//   }
//   // Add Follow-Up (with pictures)
// // Updated addFollowUp method in ticketService.ts

// async addFollowUp(
//   ticketId: string,
//   chamberId: string,
//   remark: string,
//   images: string[],
//   gpsLocation?: { lat: number; lng: number },
//   selectedChamber?: any,
// ) {
//   try {
//     const emp = this.getEmployeeData();

//     const requestPayload = {
//       assignTaskId: Number(ticketId),

//       // ✅ numeric id
//       chamberId: Number(selectedChamber?.id || chamberId),

//       // ✅ STRING ID (IMPORTANT)
//       chamberIdStr: selectedChamber?.chamberIdStr || '',

//       // ✅ REAL CHAMBER NAME
//       chamberName: selectedChamber?.chamberName || '',

//       // ✅ ADDRESS SAME AS JAVA
//       address:
//         selectedChamber?.chamberName ||
//         `${gpsLocation?.lat},${gpsLocation?.lng}`,

//       remark,
//       empId: Number(emp.empId),

//       lat: gpsLocation?.lat?.toString(),
//       lng: gpsLocation?.lng?.toString(),

//       image:
//         images?.length > 0
//           ? {
//               imageData: images[0].includes('base64,')
//                 ? images[0].split('base64,')[1]
//                 : images[0],
//               imageExtention: 'jpg',
//             }
//           : null,
//     };

//     Common.log('🟢 BASIC FOLLOW-UP PAYLOAD:', requestPayload);

//     const res = await fetch(`${URLs.addFollowUps}`, {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json',
//         Authorization: `Bearer ${Preferences.getData('API_AUTH_TOKEN')}`,
//       },
//       body: JSON.stringify(requestPayload),
//     });

//     const data = await res.json();
//     return {
//       success: !!data?.success,
//       data,
//     };
//   } catch (e) {
//     Common.error('❌ addFollowUp error', e);
//     return { success: false };
//   }
// }
//   // Get specific work types for a selected category
//   async getTypeOfWorkDD(typeId: string): Promise<IssueWorkTypesResponse> {
//     try {
//       Common.log('🔧 Getting Work Types for category:', typeId);

//       const res = await fetch(

//         `${URLs.getTypeOfWorkDD}?id=${typeId}`,
//         {
//           method: 'GET',
//           headers: {
//             'Content-Type': 'application/json',
//             Authorization: `Bearer ${Preferences.getData('API_AUTH_TOKEN')}`,
//           },
//         },
//       );
//       if (!res.ok) {
//         const txt = await res.text();
//         throw new Error(`HTTP ${res.status}: ${txt.slice(0, 120)}…`);
//       }
//       const data = await res.json();
//       Common.log('✅ Work Types fetch success:', data);
//       return {
//         status: data?.status || '200',
//         success: !!(data && data.success),
//         data: data?.data ?? [],
//         message: data?.message || 'Work types loaded successfully',
//       };
//     } catch (error: any) {
//       Common.error('❌ Work Types Error:', error);
//       return {
//         status: '500',
//         success: false,
//         data: [],
//         message: 'Failed to load work types',
//       };
//     }
//   } 
// async addComplaintFollowUp(
//   payload: FollowUpWithIssuePayload,
//   gpsLocation?: { lat: number; lng: number },
//   selectedChamber?: any,
// ) {
//   try {
//     const emp = this.getEmployeeData();

//     const requestPayload = {
//       // ✅ REAL COMPLAINT ID (NOT assignTaskId)
//       complaintId: Number(payload.complaintId),

//       // ✅ REAL CHAMBER DATA
//       chamberId: Number(selectedChamber?.id),
//       chamberIdStr: selectedChamber?.chamberIdStr || '',
//       chamberName: selectedChamber?.chamberName || '',

//       remark: payload.remark || '',

//       employeeId: Number(emp.empId),
//       companyCode: payload.companyCode || 'GTPL',

//       // ✅ LOCATION
//       lat:
//         payload.lat ??
//         gpsLocation?.lat?.toString() ??
//         '',
//       lng:
//         payload.lng ??
//         gpsLocation?.lng?.toString() ??
//         '',

//       gpsLocation:
//         payload.gpsLocation ||
//         selectedChamber?.chamberName ||
//         (gpsLocation
//           ? `${gpsLocation.lat},${gpsLocation.lng}`
//           : ''),

//       createdOn: new Date().toISOString(),
//       isOffline: false,

//       // ✅ ISSUE DATA (ONLY IF FOUND)
//       ...(payload.isIssueFound
//         ? {
//             isIssueFound: true,
//             issueCategory: payload.issueCategory
//               ? Number(payload.issueCategory)
//               : undefined,
//             issueId: payload.issueId
//               ? Number(payload.issueId)
//               : undefined,
//             complaintFollowImage:
//               payload.complaintFollowImage || [],
//           }
//         : {
//             isIssueFound: false,
//           }),
//     };

//     Common.log('🟢 COMPLAINT FOLLOW-UP PAYLOAD:', requestPayload);

//     const res = await fetch(URLs.addComplaintFollowUp2, {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json',
//         Authorization: `Bearer ${Preferences.getData(
//           'API_AUTH_TOKEN',
//         )}`,
//       },
//       body: JSON.stringify(requestPayload),
//     });

//     const data = await res.json();

//     return {
//       success: !!data?.success,
//       data,
//     };
//   } catch (e) {
//     Common.error('❌ addComplaintFollowUp error', e);
//     return {success: false};
//   }
// }
//  // ================================
//   // 🆕 Get Chamber Name List By Name
//   // ================================
//   async getChamberNameListByName(name: string) {
//     try {
//       if (!name) {
//         return {
//           success: false,
//           message: "Chamber name is missing",
//           data: [],
//         };
//       }
//       const apiUrl = `${URLs.getChamberListByName}?name=${encodeURIComponent(
//         name,
//       )}`;
//       Common.log("📡 Fetching Chamber Name List:", apiUrl);
//       const response = await APIs.getRequestWithQuery({
//         path: apiUrl,
//         isAuth: true,
//       });
//       Common.log("🎫 Chamber Name List Response:", response);
//       // Normalize output
//       let list: any[] = [];
//       if (Array.isArray(response?.data)) {
//         list = response.data;
//       } else if (response?.data?.data) {
//         list = response.data.data;
//       } else if (response?.data) {
//         list = [response.data];
//       }
//       return {
//         success: true,
//         message: "Chamber name list loaded",
//         data: list,
//       };
//     } catch (error: any) {
//       Common.error("❌ Chamber Name List API Error:", error);
//       return {
//         success: false,
//         message: error?.message || "Failed to load chamber name list",
//         data: [],
//       };
//     }
//   }
//   // ================================
//   // 🆕 Chamber Report API
//   // ================================
//   // ================================
//   // 🆕 Get Chamber Report By chamberNo + routeId
//   // ================================
//   async getChamberReport(chamberNo: string, routeId: string) {
//     try {
//       if (!chamberNo || !routeId) {
//         return {
//           success: false,
//           message: "Chamber No or Route ID missing",
//           data: [],
//         };
//       }
//       console.log('getChamberreport:', { chamberNo }, { routeId })

//       const apiUrl = `${URLs.getChamberReport}?chamberNo=${encodeURIComponent(
//         chamberNo,
//       )}&routeId=${encodeURIComponent(routeId)}`;

//       Common.log("📡 Fetching Chamber Report:", apiUrl);

//       const response = await APIs.getRequestWithQuery({
//         path: apiUrl,
//         isAuth: true,
//       });
//       Common.log("🎫 Chamber Report API Response:", response);
//       // Normalize response
//       let list: any[] = [];
//       if (Array.isArray(response?.data)) {
//         list = response.data;
//       } else if (response?.data?.data) {
//         list = response.data.data;
//       } else if (response?.data) {
//         list = [response.data];
//       }

//       return {
//         success: true,
//         data: list,
//         message: "Chamber report loaded",
//       };
//     } catch (error: any) {
//       Common.error("❌ Chamber Report API Error:", error);
//       return {
//         success: false,
//         message: error?.message || "Failed to load chamber report",
//         data: [],
//       };
//     }
//   }


//   async getFollowUpList(ticketId: string) {
//     try {
//       Common.log('📋 Getting Follow-Up List for:', ticketId);

//       const response = await fetch(
//         `${URLs.followUpList}?ticketId=${ticketId}`,
//         {
//           method: 'GET',
//           headers: {
//             'Content-Type': 'application/json',
//             Authorization: `Bearer ${Preferences.getData('API_AUTH_TOKEN')}`,
//           },
//         },
//       );

//       if (!response.ok) {
//         const txt = await response.text();
//         throw new Error(`HTTP ${response.status}: ${txt.slice(0, 120)}…`);
//       }

//       const data = await response.json();
//       Common.log('✅ Follow-Up List success:', data);

//       return {
//         success: !!(data && data.success),
//         message: data?.message || 'Follow-ups loaded',
//         data: data?.data || [],
//       };
//     } catch (error: any) {
//       Common.error('❌ Get Follow-Up List Error:', error);
//       return {
//         success: false,
//         message: 'Failed to load follow-ups',
//         data: [],
//       };
//     }
//   }
//   async getCircuitInfoList(circuitId: string) {
//     try {
//       if (!circuitId) {
//         return {
//           success: false,
//           message: "Circuit ID is missing",
//           data: [],
//         };
//       }

//       const requestPayload = { circuitId };
//       console.log('payoaodticketService:', { requestPayload })

//       const response = await APIs.postRequestWithJson({
//         path: `${URLs.getcircuitInfoList}`,
//         params: requestPayload,
//         isAuth: true,
//       });

//       console.log("🔥 Circuit Info API Raw Response:", response);
//       let list: any[] = [];
//       if (Array.isArray(response?.data)) {
//         list = response.data;
//       } else if (response?.data?.data) {
//         list = response.data.data;
//       } else if (response?.data) {
//         list = [response.data];
//       }
//       return {
//         success: true,
//         message: "Circuit info loaded",
//         data: list,
//       };
//     } catch (error: any) {
//       console.error("❌ Circuit Info API Error:", error);
//       return {
//         success: false,
//         message: error?.message || "Failed to load circuit info",
//         data: [],
//       };
//     }
//   }
//   async getCustomerName(searchText: string) {
//     try {
//       Common.log("CustomerNameTxt:", searchText);
//       const requestPayload = { companyName: searchText };
//       const response = await APIs.postRequestWithJson({
//         path: `${URLs.getCustomerSearchByName}`,
//         params: requestPayload,
//         isAuth: true,
//       });
//       console.log("🔥 FULL API RESPONSE:", response);
//       let list: any[] = [];
//       if (Array.isArray(response?.data)) {
//         list = response.data;
//       } else if (response?.data?.formData) {
//         list = [response.data.formData];
//       } else if (response?.data?.data) {
//         list = response.data.data;
//       } else if (response?.data) {
//         list = [response.data];
//       }
//       console.log("📌 Extracted LIST:", list);
//       const normalized = list.map((c: any) => ({
//         ...c,
//         companyName:
//           c.companyName ||
//           c.CompanyName ||
//           c.companyname ||
//           c.customerName ||
//           c.name ||
//           "",
//       }));
//       console.log("✅ normalizedData:", normalized);
//       return {
//         success: true,
//         data: normalized,
//       };
//     } catch (error) {
//       Common.error("❌ Customer Name API Error:", error);
//       return { success: false, data: [] };
//     }
//   }



//   async getRFOMasterDD() {
//     try {
//       Common.log('📋 Getting RFO Master Dropdown...');

//       const response = await fetch(`${URLs.getRFOMasterDD}`,
//         {
//           method: 'GET',
//           headers: {
//             'Content-Type': 'application/json',
//             Authorization: `Bearer ${Preferences.getData('API_AUTH_TOKEN')}`,
//           },
//         },
//       );

//       if (!response.ok) {
//         const txt = await response.text();
//         throw new Error(`HTTP ${response.status}: ${txt.slice(0, 120)}…`);
//       }

//       const data = await response.json();
//       Common.log('✅ RFO Master DD success:', data);

//       return {
//         success: !!(data && data.success),
//         message: data?.message || 'RFO options loaded',
//         data: data?.data || [],
//       };
//     } catch (error: any) {
//       Common.error('❌ Get RFO Master DD Error:', error);
//       return {
//         success: false,
//         message: 'Failed to load closure reasons',
//         data: [],
//       };
//     }
//   }
//   async updateTaskRFO(payload: any) {
//   try {
//     const emp = this.getEmployeeData(); // Get employee data
//     const primaryImage = payload.closureImages && payload.closureImages.length > 0
//       ? {
//           imageData: payload.closureImages[0].includes('base64,') 
//             ? payload.closureImages[0].split('base64,')[1] 
//             : payload.closureImages[0],
//           imageExtention: 'jpg',
//         }
//       : null;
//     const requestPayload: any = {
//       formDataId: parseInt(payload.ticketId),
//       rfoId: payload.rfoId ? parseInt(payload.rfoId) : 0,
//       comment: payload.closureRemarks || '',
//       status: payload.status || 'Task Complete',
//       empId: parseInt(emp.empId),
//     };
//     if (primaryImage) {
//       requestPayload.image = primaryImage;
//     }
//     // ✅ Add location if available
//     if (payload.location) {
//       requestPayload.lat = payload.location.lat?.toString();
//       requestPayload.lng = payload.location.lng?.toString();
//       requestPayload.gpsLocation = `${payload.location.lat},${payload.location.lng}`;
//     }
//     Common.log('🔒 Updating Task RFO with payload:', JSON.stringify(requestPayload, null, 2));
//     const response = await fetch(`${URLs.updateTaskRFO}`, {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json',
//         Authorization: `Bearer ${Preferences.getData('API_AUTH_TOKEN')}`,
//       },
//       body: JSON.stringify(requestPayload),
//     });
//     if (!response.ok) {
//       const txt = await response.text();
//       Common.error('❌ API Error Response:', txt);
//       throw new Error(`HTTP ${response.status}: ${txt.slice(0, 120)}…`);
//     }
//     const data = await response.json();
//     Common.log('✅ Update Task RFO success:', data);
//     return {
//       success: !!(data && data.success),
//       message: data?.message || 'Ticket closed successfully',
//       data: data?.data,
//     };
//   } catch (error: any) {
//     Common.error('❌ Update Task RFO Error:', error);
//     return {
//       success: false,
//       message: error?.message || 'Failed to close ticket',
//     };
//   }
// }
//   async getOldIRList(ticketId: string) {
//     try {
//       const response = await fetch(`${URLs.getOldIRList}`,
//         {
//           method: 'POST',
//           headers: {
//             'Content-Type': 'application/json',
//           },
//           body: JSON.stringify({ ticketId }),
//         },
//       );
//       console.log('response', response);
//       if (!response.ok) {
//         throw new Error(`HTTP error! status: ${response.status}`);
//       }
//       const data = await response.json();
//       return {
//         success: true,
//         data: data.data || data,
//         message: 'Old IR list loaded successfully',
//       };
//     } catch (error: any) {
//       console.error('Error fetching Old IR list:', error);
//       return {
//         success: false,
//         data: [],
//         message: error.message || 'Failed to load Old IR list',
//       };
//     }
//   }
//   async createNewIR(irData: any) {
//     try {
//       const response = await fetch(
//         `${URLs.createNewIR}`,
//         {
//           method: 'POST',
//           headers: {
//             'Content-Type': 'application/json',
//           },
//           body: JSON.stringify(irData),
//         },
//       );
//       if (!response.ok) {
//         throw new Error(`HTTP error! status: ${response.status}`);
//       }
//       const data = await response.json();
//       return {
//         success: true,
//         data: data.data || data,
//         message: 'New IR created successfully',
//       };
//     } catch (error: any) {
//       console.error('Error creating New IR:', error);
//       return {
//         success: false,
//         message: error.message || 'Failed to create New IR',
//       };
//     }
//   }
// }

// export const ticketService = new TicketService();
