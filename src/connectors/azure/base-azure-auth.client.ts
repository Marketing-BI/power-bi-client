import { ConfidentialClientApplication, type Configuration, LogLevel } from '@azure/msal-node';
import { AuthenticationResult } from '@azure/msal-common';
import { AzureAccessToken } from './dto/AzureAccessToken';
import { AzureError } from './dto/errors/AzureError';
import { logger } from '../../configuration';
import { IAzureAuthConfig } from './interfaces';

const DEFAULTS = {
  AUTHORITY: 'https://login.microsoftonline.com',
  RESOURCE: 'https://analysis.windows.net/powerbi/api',
};

const TIME_SHIFT_CONSTANT = 5 * 60 * 1000;

/**
 * Abstract base class for Azure authentication clients.
 * Handles common authentication logic for Power BI and Fabric clients.
 */
export abstract class BaseAzureAuthClient {
  protected readonly _tenantId: string;
  protected readonly _clientId: string;
  protected readonly _clientSecret: string;
  protected readonly _authority: string;
  protected readonly _resource: string;
  protected readonly _scopes: Array<string>;

  constructor(config: Readonly<IAzureAuthConfig>) {
    this._tenantId = config.tenantId;
    this._clientId = config.clientId;
    this._clientSecret = config.clientSecret;
    this._authority = `${config.authority ?? DEFAULTS.AUTHORITY}/${config.tenantId}`;
    this._resource = config.resource ?? DEFAULTS.RESOURCE;
    this._scopes = config.scopes || [`${this._resource}/.default`];
  }

  /**
   * Get a new access token from Azure AD.
   */
  public async getToken(): Promise<AuthenticationResult> {
    const config: Configuration = {
      auth: {
        clientId: this._clientId,
        authority: this._authority,
        clientSecret: this._clientSecret,
      },
      system: {
        loggerOptions: {
          loggerCallback(_, message) {
            logger.debug(message);
          },
          piiLoggingEnabled: false,
          logLevel: LogLevel.Verbose,
        },
      },
    };

    const cca = new ConfidentialClientApplication(config);
    const scopes: Array<string> = this._scopes?.length ? this._scopes : [this._resource + '/.default'];

    const clientCredentialRequest = {
      scopes: scopes,
    };

    try {
      const response = await cca.acquireTokenByClientCredential(clientCredentialRequest);
      if (!response || !response.accessToken) {
        throw new Error('Failed to acquire access token');
      }
      return response;
    } catch (error) {
      const errorMsg = JSON.stringify(error);
      logger.error(errorMsg);
      throw new AzureError(AzureError.ERROR_CODE.GENERATING_ACCESS_TOKEN_EXCEPTION, null, errorMsg);
    }
  }

  /**
   * Generate a valid access token.
   * Reuses existing token if valid, otherwise generates a new one.
   */
  public async generateValidToken(currentToken?: AzureAccessToken | null): Promise<AzureAccessToken> {
    let token: AzureAccessToken;
    if (currentToken && isValidToken(currentToken)) {
      logger.info('Azure token is valid. Reuse existing token with expiration: %s.', currentToken.expireAt);
      token = currentToken;
    } else {
      logger.info('Azure token is invalid or missing. Generating new token.');
      const tokenData = await this.getToken();
      const expireAt = tokenData.expiresOn?.getTime() || tokenData.extExpiresOn?.getTime();
      token = new AzureAccessToken(tokenData.accessToken, expireAt!);
    }

    return token;
  }
}

/**
 * Check if a token is still valid.
 * A token is valid if it expires at least TIME_SHIFT_CONSTANT ms in the future.
 */
export const isValidToken = (token: Readonly<AzureAccessToken>): boolean => {
  return !!token.accessToken && Date.now() + TIME_SHIFT_CONSTANT < token.expireAt;
};
