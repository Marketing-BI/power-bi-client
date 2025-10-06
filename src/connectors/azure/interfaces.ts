export interface IAzureConfig {
    tenantId: string;
    clientId: string;
    clientSecret: string;
    authority?: string;
    resource?: string;
    scopes?: Array<string>
}
