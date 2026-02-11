import { BaseAzureAuthClient } from './base-azure-auth.client';

const FABRIC_DEFAULTS = {
  AUTHORITY: 'https://login.microsoftonline.com',
  RESOURCE: 'https://api.fabric.microsoft.com',
};

/**
 * Fabric Client for Microsoft Fabric authentication and token management.
 * Handles authentication with Azure AD for Microsoft Fabric API access.
 */
export class FabricClient extends BaseAzureAuthClient {
  constructor(config: {
    tenantId: string;
    clientId: string;
    clientSecret: string;
    authority?: string;
    resource?: string;
    scopes?: Array<string>;
  }) {
    super({
      authority: config.authority || FABRIC_DEFAULTS.AUTHORITY,
      resource: config.resource || FABRIC_DEFAULTS.RESOURCE,
      ...config,
    });
  }
}
