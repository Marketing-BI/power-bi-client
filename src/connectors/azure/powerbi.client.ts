import { BaseAzureAuthClient } from './base-azure-auth.client';
import type { IAzureAuthConfig } from './interfaces';

const POWERBI_DEFAULTS = {
  AUTHORITY: 'https://login.microsoftonline.com',
  RESOURCE: 'https://analysis.windows.net/powerbi/api',
};

/**
 * Power BI Client for authentication and token management.
 * Handles authentication with Azure AD for Power BI API access.
 */
export class PowerBiClient extends BaseAzureAuthClient {
  constructor(config: Readonly<IAzureAuthConfig>) {
    super({
      authority: config.authority || POWERBI_DEFAULTS.AUTHORITY,
      resource: config.resource || POWERBI_DEFAULTS.RESOURCE,
      ...config,
    });
  }
}
