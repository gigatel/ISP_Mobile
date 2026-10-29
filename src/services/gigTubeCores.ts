import {APIs, URLs} from '@apis';

export type GigTubeCore = {
  coreId: number;
  coreName: string;
  isUsed: boolean;
};

export async function getGigTubeCores(
  fiberMappingId: number,
  tubeNo: number,
): Promise<GigTubeCore[]> {
  const response = await APIs.getRequestWithQuery({
    path: URLs.getFiberTubeCoreColorForSplitter,
    params: `?fiberMappingId=${encodeURIComponent(
      fiberMappingId,
    )}&tubeNo=${encodeURIComponent(tubeNo)}&appType=app`,
    isAuth: true,
  });
  if (
    response?.success === false ||
    (response?.success !== true && Number(response?.status) !== 200)
  ) {
    throw new Error(response?.message || 'Could not load cores. Please retry.');
  }
  if (
    !Array.isArray(response.data) ||
    response.data.some(
      (row: any) =>
        !row ||
        !Number.isSafeInteger(Number(row.coreId)) ||
        Number(row.coreId) <= 0 ||
        typeof row.isUsed !== 'boolean',
    )
  ) {
    throw new Error('Invalid core availability response. Please retry.');
  }
  return response.data.map((row: any) => ({
    coreId: Number(row.coreId),
    coreName: String(row.coreName ?? '').trim(),
    isUsed: row.isUsed,
  }));
}
