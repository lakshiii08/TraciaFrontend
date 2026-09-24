/**
 * TRACIA System Configuration
 * Manages environment toggles and API base URLs.
 */

export const config = {
  /**
   * Whether the app should use local mock data.
   * Defaults to false so live/empty states are used unless explicitly enabled.
   */
  useMockData: process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true",

  /**
   * Base URL for the backend API (FastAPI / Node microservices).
   */
  apiBaseUrl:
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.FASTAPI_BACKEND_URL ||
    "",

  /**
   * GraphRAG LLM service URL.
   */
  graphragLlmUrl:
    process.env.GRAPHRAG_LLM_URL ||
    "",

  /**
   * Blockchain RPC / Node service URL.
   */
  blockchainRpcUrl:
    process.env.BLOCKCHAIN_RPC_URL ||
    process.env.NEXT_PUBLIC_BLOCKCHAIN_RPC_URL ||
    "",

  /**
   * Terminal / Region identifier.
   */
  terminalId: process.env.NEXT_PUBLIC_TERMINAL_ID || "ALPHA_77",
  regionId: process.env.NEXT_PUBLIC_REGION_ID || "REGION-04",

  /**
   * Mapbox access token for tactical spatial intelligence.
   */
  mapboxToken: process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "",
};

export const isMockEnabled = (): boolean => {
  return config.useMockData;
};

export const getApiBaseUrl = (): string => {
  return config.apiBaseUrl;
};
