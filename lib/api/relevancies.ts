import { ApiResponse, type ApiError } from './client';

export interface RelevanciesResponse {
  [groupId: string]: number; // groupId -> rank
}

class RelevanciesService {
  async getRelevancies(
    groupIds: string[],
    authToken: string,
    userID: string,
    accountID: string
  ): Promise<ApiResponse<RelevanciesResponse>> {
    const response = await fetch('/api/v1/relevancies', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        groupIDs: groupIds.join(','),
        authToken,
        userID,
        accountID,
      }),
    });

    if (!response.ok) {
      let errorText = 'Failed to fetch relevancies';
      try {
        const errorData = await response.json();
        errorText = errorData.error || errorData.message || errorText;
      } catch {
        try {
          errorText = await response.text();
        } catch {
          errorText = `HTTP ${response.status}: ${response.statusText}`;
        }
      }
      
      const error: ApiError = {
        message: errorText,
        code: 'RELEVANCIES_FETCH_ERROR',
        status: response.status,
      };
      throw error;
    }

    let data;
    try {
      const rawData = await response.json();
      // Handle response structure: might be { data: {...} } or direct object
      if (rawData.data) {
        data = rawData.data;
      } else {
        data = rawData;
      }
    } catch (parseError) {
      const error: ApiError = {
        message: 'Invalid JSON response from relevancies API',
        code: 'RELEVANCIES_PARSE_ERROR',
        status: response.status,
      };
      throw error;
    }

    return {
      data,
      status: response.status,
    };
  }
}

export const relevanciesService = new RelevanciesService();

