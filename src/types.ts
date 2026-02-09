import { IAzureAuthConfig } from './connectors/azure/interfaces';

export * from './connectors/azure/interfaces';
export * from './service/interfaces.pbi';
export * from './service/powerBI.interfaces';
export * from './service/dto/powerBiConfig.dto';

export interface PowerBiConfig {
  azureConfig: IAzureAuthConfig;
}

export interface DatasetRefreshInfo {
  allInFinalState: boolean;
  lastRefreshSuccessful: boolean;
}
