import { ConnectorConfig, DataConnect, QueryRef, QueryPromise, ExecuteQueryOptions, DataConnectSettings } from 'firebase/data-connect';

export const connectorConfig: ConnectorConfig;
export const dataConnectSettings: DataConnectSettings;

export type TimestampString = string;
export type UUIDString = string;
export type Int64String = string;
export type DateString = string;




export interface Client_Key {
  id: UUIDString;
  __typename?: 'Client_Key';
}

export interface ExternalJob_Key {
  id: UUIDString;
  __typename?: 'ExternalJob_Key';
}

export interface GetUsersDropdownData {
  userProfiles: ({
    id: string;
    name: string;
  } & UserProfile_Key)[];
}

export interface Mechanic_Key {
  id: UUIDString;
  __typename?: 'Mechanic_Key';
}

export interface OrderPart_Key {
  id: UUIDString;
  __typename?: 'OrderPart_Key';
}

export interface OrderService_Key {
  id: UUIDString;
  __typename?: 'OrderService_Key';
}

export interface Part_Key {
  id: UUIDString;
  __typename?: 'Part_Key';
}

export interface ServiceCategory_Key {
  id: UUIDString;
  __typename?: 'ServiceCategory_Key';
}

export interface StockMovement_Key {
  id: UUIDString;
  __typename?: 'StockMovement_Key';
}

export interface UserProfile_Key {
  id: string;
  __typename?: 'UserProfile_Key';
}

export interface Vehicle_Key {
  id: UUIDString;
  __typename?: 'Vehicle_Key';
}

export interface WorkOrder_Key {
  id: UUIDString;
  __typename?: 'WorkOrder_Key';
}

export interface WorkshopService_Key {
  id: UUIDString;
  __typename?: 'WorkshopService_Key';
}

interface GetUsersDropdownRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<GetUsersDropdownData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<GetUsersDropdownData, undefined>;
  operationName: string;
}
export const getUsersDropdownRef: GetUsersDropdownRef;

export function getUsersDropdown(options?: ExecuteQueryOptions): QueryPromise<GetUsersDropdownData, undefined>;
export function getUsersDropdown(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<GetUsersDropdownData, undefined>;

