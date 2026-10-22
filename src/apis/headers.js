export const API_HEADERS = {
  appType: 'app',
  ProjectName: 'ISP',
};

export const logApiRequest = (method, url, headers) => {
  if (__DEV__) {
    const appType =
      typeof headers?.get === 'function'
        ? headers.get('appType')
        : headers?.appType;
    const ProjectName =
      typeof headers?.get === 'function'
        ? headers.get('ProjectName')
        : headers?.ProjectName;
    console.log('[API REQUEST]', {
      method: method.toUpperCase(),
      url: String(url).split(/[?#]/)[0],
      headers: {appType, ProjectName},
    });
  }
};

export const fetchWithAppHeaders = (url, options = {}) => {
  const headers = new Headers(options.headers);
  Object.entries(API_HEADERS).forEach(([name, value]) => {
    headers.set(name, value);
  });
  logApiRequest(options.method || 'GET', url, headers);
  return fetch(url, {...options, headers});
};

export const applyXhrAppHeaders = (xhr, method, url) => {
  Object.entries(API_HEADERS).forEach(([name, value]) => {
    xhr.setRequestHeader(name, value);
  });
  logApiRequest(method, url, API_HEADERS);
};

export const getDownloadHeaders = (url, headers = {}) => {
  const requestHeaders = {...headers, ...API_HEADERS};
  logApiRequest('GET', url, requestHeaders);
  return requestHeaders;
};
