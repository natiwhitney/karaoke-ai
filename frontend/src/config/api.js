// Base URLs
export const API_BASE_URL = '/api';
export const WS_BASE_URL = `ws://${window.location.host}/ws`;
export const AUDIO_BASE_URL = '/audio';

// Helper function to clean paths
const cleanPath = (path) => {
    return path.replace(/^\/+|\/+$/g, '').replace(/\/+/g, '/');
};

// Helper functions to build URLs
export const buildApiUrl = (path) => {
    if (!path) return API_BASE_URL;
    return `${API_BASE_URL}/${cleanPath(path)}`;
};

export const buildWsUrl = (path) => {
    if (!path) return WS_BASE_URL;
    return `${WS_BASE_URL}/${cleanPath(path)}`;
};

export const buildAudioUrl = (path) => {
    if (!path) return AUDIO_BASE_URL;
    return `${AUDIO_BASE_URL}/${cleanPath(path)}`;
};