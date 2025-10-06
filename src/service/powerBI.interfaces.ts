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
    reports: Array<PBIReport>
    state: string;
    type: string;
    users: Array<PBIGroupUser>;
    workbooks: Array<any>; //TODO: PBIWorkbook
}

export interface PBIReport {
    id: string,
    reportType: string,
    name: string,
    webUrl: string,
    embedUrl: string,
    isFromPbix: boolean,
    isOwnedByMe: boolean,
    datasetId: string,
    users: Array<any>
}

export interface PBIReportPage {
    name: string,
    displayName: string,
    order: number
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
    dataSourceType: string,
    connectionDetails: string,
    dataSourceName: string,
    credentialDetails: PBICredentialDetails

}

export interface PBICredentialDetails {
    credentialType: PBICredentialTypeEnum;
    credentials: string
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

export interface PBICredentials {
    credentialData: Array<PBICredentialDataItem>;
}

export interface PBICredentialDataItem {
    name: string;
    value: string;
}

export interface PBICapacity {
    'id': string,
    'displayName': string,
    'admins': Array<string>,
    'sku': string,
    'state': string,
    'region': string,
    'capacityUserAccessRight': string
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
