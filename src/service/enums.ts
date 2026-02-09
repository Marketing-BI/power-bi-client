export const PBIRefreshTypeEnum = {
  OnDemand: 'OnDemand',
  Scheduled: 'Scheduled',
  ViaApi: 'ViaApi',
} as const;

export const PBIScheduleNotifyOption = {
  MailOnFailure: 'MailOnFailure',
  NoNotification: 'NoNotification',
} as const;

export const PBIRefreshStatusEnum = {
  Unknown: 'Unknown',
  Completed: 'Completed',
  Failed: 'Failed',
  Disabled: 'Disabled',
} as const;

export type PBIRefreshType = (typeof PBIRefreshTypeEnum)[keyof typeof PBIRefreshTypeEnum];
export type PBIScheduleNotify = (typeof PBIScheduleNotifyOption)[keyof typeof PBIScheduleNotifyOption];
export type PBIRefreshStatus = (typeof PBIRefreshStatusEnum)[keyof typeof PBIRefreshStatusEnum];
