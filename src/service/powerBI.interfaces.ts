export interface PBIResponse<T> {
  '@odata.context': string;
  value: T;
}

export interface PBIGroup {
  capacityId: string;
  dashboards: Array<any>; //TODO: PBIDashboard
  dataflowStorageId: string;
  dataflows: Array<any>; //TODO: PBIDataflow
  datasets: Array<any>; //TODO: PBIDataset
  description: string;
  id: string;
  isOnDedicatedCapacity: boolean;
  isReadOnly: boolean;
  name: string;
  pipelineId: string;
  reports: Array<PBIReport>;
  state: string;
  type: string;
  users: Array<PBIGroupUser>;
  workbooks: Array<any>; //TODO: PBIWorkbook
}

export interface PBIDataset {
  id: string;
  name: string;
  addRowsAPIEnabled: boolean;
  configuredBy: string;
  isRefreshable: boolean;
  isEffectiveIdentityRequired: boolean;
  isEffectiveIdentityRolesRequired: boolean;
  isOnPremGatewayRequired: boolean;
  webUrl: string;
}

export interface PBIImport {
  id: string;
  importState: 'Failed' | 'Publishing' | 'Succeeded';
  createdDateTime: string;
  updatedDateTime: string;
  name: string;
  datasets: Array<PBIImportDataset>;
  reports: Array<PBIImportReport>;
  error?: PBIImportError;
}

export interface PBIImportError {
  // TODO: Define error structure based on Power BI API documentation
}

export type PBIImportDataset = Pick<PBIDataset, 'id' | 'name' | 'webUrl'>;

export type PBIImportReport = Pick<PBIReport, 'id' | 'name' | 'webUrl' | 'embedUrl'>;

export interface PBIReport {
  id: string;
  reportType: string;
  name: string;
  webUrl: string;
  embedUrl: string;
  isFromPbix: boolean;
  isOwnedByMe: boolean;
  datasetId: string;
  users: Array<any>;
}

export interface PBIReportPage {
  name: string;
  displayName: string;
  order: number;
}

export interface PBIGroupUser {
  displayName: string;
  emailAddress: string;
  graphId: string;
  groupUserAccessRight: PBIGroupUserAccessRightEnum;
  identifier: string;
  principalType: PBIPrincipalTypeEnum; // PrincipalType
}

export interface PBICreateDataSourceRequest {
  dataSourceType: string;
  connectionDetails: string;
  dataSourceName: string;
  credentialDetails: PBICredentialDetails;
}

export interface PBIDatasource {
  datasourceType: string;
  datasourceId: string;
  gatewayId: string;
  connectionDetails: Record<string, string>;
}

export interface PBICredentialDetails {
  credentialType: PBICredentialTypeEnum;
  credentials: string;
  encryptedConnection: PBIEncryptedConnectionEnum;
  encryptionAlgorithm: PBIEncryptionAlgorithmEnum;
  privacyLevel: PBIPrivacyLevelEnum;
  useCallerAADIdentity?: boolean;
  useEndUserOAuth2Credentials: boolean;
}

export interface PBIDatasourceParam {
  name: string;
  newValue: string;
}

export interface SourceSystemValues {
  pathToTemplateFile: string;
  templateGroupId: string;
}

export interface PBICredentialsData {
  credentialData: Array<PBICredentialDataItem>;
}

export type PBICredentials = PBICredentialsData | string;

export interface PBICredentialDataItem {
  name: 'username' | 'password';
  value: string;
}

export interface PBICapacity {
  id: string;
  displayName: string;
  admins: Array<string>;
  sku: string;
  state: string;
  region: string;
  capacityUserAccessRight: string;
}

/**
 * Enumns
 */

export enum PBIGroupUserAccessRightEnum {
  Admin = 'Admin',
  Contributor = 'Contributor',
  Member = 'Member',
  None = 'None',
  Viewer = 'Viewer',
}

export enum PBIPrincipalTypeEnum {
  App = 'App',
  Group = 'Group',
  None = 'None',
  User = 'User',
}

export enum PBICredentialTypeEnum {
  Anonymous = 'Anonymous',
  Basic = 'Basic',
  Key = 'Key',
  OAuth2 = 'OAuth2',
  Windows = 'Windows',
}

export enum PBIEncryptedConnectionEnum {
  Encrypted = 'Encrypted',
  NotEncrypted = 'NotEncrypted',
}

export enum PBIEncryptionAlgorithmEnum {
  None = 'None',
  'RSA-OAEP' = 'RSA-OAEP',
}

export enum PBIPrivacyLevelEnum {
  None = 'None',
  Organizational = 'Organizational',
  Private = 'Private',
  Public = 'Public',
}

export enum PBICapacityState {
  Active = 'Active',
  Deleted = 'Deleted',
  Deleting = 'Deleting',
  Invalid = 'Invalid',
  NotActivated = 'NotActivated',
  PreSuspended = 'PreSuspended',
  ProvisionFailed = 'ProvisionFailed',
  Provisioning = 'Provisioning',
  Suspended = 'Suspended',
  UpdatingSku = 'UpdatingSku',
}
