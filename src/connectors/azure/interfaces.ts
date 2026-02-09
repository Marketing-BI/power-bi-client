/**
 * Configuration interface for Azure authentication.
 *
 * @interface IAzureAuthConfig
 * @description Defines the required and optional parameters for authenticating with Azure services.
 *
 * @property {string} tenantId - The Azure AD tenant ID where the application is registered.
 * @property {string} clientId - The client ID (also known as application ID) of the registered Azure AD application.
 * @property {string} clientSecret - The client secret (password) associated with the Azure AD application. Should be stored securely.
 * @property {string} [authority] - Optional. The authority URL for token acquisition. Defaults to Azure public cloud authority if not provided.
 * @property {string} [resource] - Optional. The resource/API identifier for which the token should be requested.
 * @property {Array<string>} [scopes] - Optional. An array of OAuth 2.0 scopes required for the requested access. Used in modern MSAL flows.
 *
 * @example
 * const config: IAzureAuthConfig = {
 *   tenantId: 'your-tenant-id',
 *   clientId: 'your-client-id',
 *   clientSecret: 'your-client-secret',
 *   scopes: ['https://graph.microsoft.com/.default']
 * };
 */
export interface IAzureAuthConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  authority?: string;
  resource?: string;
  scopes?: Array<string>;
}
