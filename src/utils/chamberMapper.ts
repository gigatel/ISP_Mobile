import {ChamberData} from '../types/ticket.types';

// utils/chamberMapper.ts
export interface ChamberUIData {
  title: string;
  address: string;
}


export const mapChamberApiToUI = (c: ChamberData): ChamberUIData => ({
  title: c.chamberName,
  address: c.address || 'Address not available',
});
