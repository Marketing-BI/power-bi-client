export type PBIClientInitResultType = {
    workspaceId: string,
    dataRefreshed: boolean,
    name: string,
    datasetId: string,
    datasourceId: string,
    reports: Array<PBIClientInitReportType>,

}

export type PBIClientInitReportType = {
    id: string,
    name: string,
    embedUrl: string,
    webUrl: string,
    pages: Array<ReportPageType>;
}

export type ReportPageType = {
    name: string,
    displayName: string,
    order: number
}

export type GenerateTokenResponseType = {
    'token': string,
    'tokenId': string,
    'expiration': string,
}

export type PBIGenerateTokenResponseType = {
    '@odata.context': string,
    'token': string,
    'tokenId': string,
    'expiration': string,
}

export type PBIRefresh = {
    endTime: string,
    refreshType: PBIRefreshTypeEnum,
    requestId: string,
    serviceExceptionJson: string,
    startTime: string,
    status: PBIRefreshStatusEnum,
}

export type PBIRefreshSchedule = {
    notifyOption?: PBIScheduleNotifyOption; //The notification option on termination of a scheduled refresh
    days?: Array<string>; //The days on which to execute the refresh
    enabled?: boolean; //Whether the refresh is enabled
    localTimeZoneId?: string;//The ID of the time zone to use. For more information, see Time zone info.
    times?: Array<string>; //The times of day to execute the refresh


}


export enum PBIRefreshTypeEnum {
    OnDemand = 'OnDemand',
    Scheduled = 'Scheduled',
    ViaApi = 'ViaApi',
}

export enum PBIScheduleNotifyOption {
    MailOnFailure = 'MailOnFailure',
    NoNotification = 'NoNotification',
}

export enum PBIRefreshStatusEnum {
    Unknown = 'Unknown',
    Completed = 'Completed',
    Failed = 'Failed',
    Disabled = 'Disabled',
}
