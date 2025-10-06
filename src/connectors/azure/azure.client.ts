import { ConfidentialClientApplication, LogLevel } from '@azure/msal-node'
import {AuthenticationResult} from '@azure/msal-common'
import { AzureAccessToken } from './dto/AzureAccessToken';
import { AzureError } from './dto/errors/AzureError';
import { logger } from '../../configuration';
import { IAzureConfig } from './interfaces';

const DEFAULTS = {
    AUTHORITY: 'https://login.microsoftonline.com',
    RESOURCE: 'https://analysis.windows.net/powerbi/api',
}
const TIME_SHIFT_CONSTANT = 5 * 60 * 1000;

export class AzureClient {

    private readonly _tenantId: string;
    private readonly _clientId: string;
    private readonly _clientSecret: string;
    private readonly _authority: string;
    private readonly _resource: string;
    private readonly _scopes: Array<string>;

    constructor(config: IAzureConfig) {
        this._authority = config.authority ? `${config.authority}/${config.tenantId}` : `${DEFAULTS.AUTHORITY}/${config.tenantId}`;
        this._clientSecret = config.clientSecret;
        this._clientId = config.clientId;
        this._clientSecret = config.clientSecret;
        this._resource = config.resource ? config.resource : DEFAULTS.RESOURCE;
        this._scopes = config.scopes;
        this._tenantId = config.tenantId;

    }

    public async getToken(): Promise<AuthenticationResult> {

        const config = {
            auth: {
                clientId: this._clientId,
                authority: this._authority,
                clientSecret: this._clientSecret
            },
            system: {
                loggerOptions: {
                    loggerCallback(loglevel, message, containsPii) {
                        logger.debug(message);
                    },
                    piiLoggingEnabled: false,
                    logLevel: LogLevel.Verbose,
                }
            }
        };

        const cca = new ConfidentialClientApplication(config);
        const scopes: Array<string> = this._scopes?.length ? this._scopes : [
            this._resource + '/.default'
        ]
        const clientCredentialRequest = {
            scopes: scopes,
        };
        return cca.acquireTokenByClientCredential(clientCredentialRequest).then((response) => {
            return response;

        }).catch((error) => {
            const errorMsg = JSON.stringify(error);
            logger.error(errorMsg);
            throw new AzureError(AzureError.ERROR_CODE.GENERATING_ACCESS_TOKEN_EXCEPTION, null, errorMsg)
        });
    }

    public async generateValidToken(currentToken: AzureAccessToken): Promise<AzureAccessToken> {
        let token: AzureAccessToken;
        if (currentToken && isValidToken(currentToken)){
            logger.info('Azure token is valid. Reuse existingToken with expiration: %s.', currentToken.expireAt);
            token = currentToken;
        } else {
            logger.info('Azure token is Invalid or missing. Generating new new token.')
            const tokenData = await this.getToken();
            token = new AzureAccessToken(tokenData.accessToken, new Date(tokenData.expiresOn.toISOString()).getTime());
        }

        return token;
    }

}

export const isValidToken = (token: AzureAccessToken): boolean => {
    return token.accessToken && (Date.now() + TIME_SHIFT_CONSTANT) < token.expireAt;
}
