import Geolocation from '@react-native-community/geolocation';
import {useEffect, useState} from 'react';
import {FollowUpWithIssuePayload, GeoLocation} from '../../types/issue-type';
import {log, showToast} from '../../utils/common';
import {ticketService} from '../../services';

interface TwoPhaseFollowUpPayload {
  basic: {
    assignTaskId: string;
    chamberId: string;
    chamberName: string;
    remark: string;
    primaryImage?: string;
    selectedChamber?: any;
  };

  issue?: {
    // Phase 2 - Only if issues found
    isIssueFound: boolean;
    issueCategory: string;
    issueId: string;
    issueImages: string[];
    issueRemarks: string;
  };

  common: {
    // Shared data
    ticketId: string;
    transactionNumber: string;
    companyCode: string;
    location: GeoLocation;
  };
}

export const useAddFollowUp = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (error) {
      showToast(error, 'short', 'bottom');
    }
  }, [error]);

  useEffect(() => {
    return () => {
      setLoading(false);
      setError(null);
    };
  }, []);

  // const addComplaintFollowUp = async (payload: FollowUpWithIssuePayload) => {
  //   return new Promise(resolve => {
  //     Geolocation.getCurrentPosition(async res => {
  //       try {
  //         setLoading(true);
  //         const response = await ticketService.addComplaintFollowUp(payload, {
  //           lat: res?.coords.latitude,
  //           lng: res?.coords.longitude,
  //         });
  //         setLoading(false);
  //         const isResponseSuccess = response?.success;
  //         if (isResponseSuccess) {
  //           resolve(response);
  //         } else {
  //           // notify on error
  //           setError(response?.message);
  //           resolve(null);
  //         }
  //       } catch (err: any) {
  //         setLoading(false);
  //         setError(err?.message || 'Failed to submit complaint follow-up');
  //         resolve(null);
  //       }
  //     });
  //   });
  // };

  const addFollowUp = async (payload: any) => {
    return new Promise(resolve => {
      Geolocation.getCurrentPosition(async res => {
        try {
          setLoading(true);
          const response = await ticketService.addFollowUp(
            payload.assignTaskId,
            payload.chamberId,
            payload.remark,
            payload.images,
            {lat: res?.coords.latitude, lng: res?.coords.longitude},
            payload.selectedChamber,
          );
          setLoading(false);
          const isResponseSuccess = response?.success;
          if (isResponseSuccess) {
            resolve(response);
          } else {
            setError(response?.message);
            resolve(null);
          }
        } catch (err: any) {
          setLoading(false);
          setError(err?.message || 'Failed to submit follow-up');
          resolve(null);
        }
      });
    });
  };

  // Two-phase submission that matches Android FollowUpGtplActivity flow
  const addTwoPhaseFollowUp = async (payload: TwoPhaseFollowUpPayload) => {
    return new Promise(resolve => {
      Geolocation.getCurrentPosition(async pos => {
        try {
          setLoading(true);

          const emp = ticketService.getEmployeeData(); // ✅ REAL EMP
          const location = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          };

          /* ========= PHASE 1 ========= */
          const basicRes = await ticketService.addFollowUp(
            payload.basic.assignTaskId,
            payload.basic.chamberId,
            payload.basic.remark,
            payload.basic.primaryImage ? [payload.basic.primaryImage] : [],
            location,
            payload.basic.selectedChamber,
          );

          if (!basicRes?.success) {
            setLoading(false);
            return resolve(null);
          }

          /* ========= NO ISSUE ========= */
          if (!payload.issue || !payload.issue.issueId) {
            setLoading(false);
            return resolve(basicRes);
          }

          /* ========= PHASE 2 ========= */
          const issuePayload: FollowUpWithIssuePayload = {
            complaintId: payload.basic.assignTaskId,
            chamberId: payload.basic.chamberId,
            chamberIdStr: payload.basic.selectedChamber?.chamberIdStr || '',
            chamberName: payload.basic.selectedChamber?.chamberName || '',
            isIssueFound: true,
            issueCategory: payload.issue.issueCategory,
            issueId: payload.issue.issueId,
            complaintFollowImage: payload.issue.issueImages.map(img => ({
              imageUrl: img.includes('base64,') ? img.split('base64,')[1] : img,
              imageExtention: 'jpg',
            })),
            lat: location.lat.toString(),
            lng: location.lng.toString(),
            gpsLocation:
              payload.basic.selectedChamber?.chamberName ||
              `${location.lat},${location.lng}`,
            remark: payload.issue.issueRemarks,
            empId: emp.empId.toString(), // ✅ REAL EMP ID
            companyCode: payload.common.companyCode,
          };

          const issueRes = await ticketService.addComplaintFollowUp(
            issuePayload,
            location,
            payload.basic.selectedChamber,
          );

          setLoading(false);
          resolve(issueRes);
        } catch (e) {
          setLoading(false);
          resolve(null);
        }
      });
    });
  };

  return {
    // addComplaintFollowUp,
    addFollowUp,
    addTwoPhaseFollowUp,
    loading,
    error,
  };
};
