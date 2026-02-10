import type { IAzureAuthConfig } from './connectors/azure/interfaces';

export * from './connectors/azure/interfaces';
export * from './service/interfaces.pbi';
export * from './service/interfaces.fabric';
export * from './service/powerBI.interfaces';
export * from './service/dto/powerBiConfig.dto';
export * from './service/enums';

export interface PowerBiConfig {
  azureConfig: IAzureAuthConfig;
}

export interface DatasetRefreshInfo {
  allInFinalState: boolean;
  lastRefreshSuccessful: boolean;
}
