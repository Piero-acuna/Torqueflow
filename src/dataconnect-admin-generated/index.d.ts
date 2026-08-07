import { ConnectorConfig, DataConnect, OperationOptions, ExecuteOperationResponse } from 'firebase-admin/data-connect';

export const connectorConfig: ConnectorConfig;

export type TimestampString = string;
export type UUIDString = string;
export type Int64String = string;
export type DateString = string;


export interface Client_Key {
  id: UUIDString;
  __typename?: 'Client_Key';
}

export interface ListClientsData {
  clients: ({
    id: UUIDString;
    name: string;
  } & Client_Key)[];
}

export interface Vehicle_Key {
  id: UUIDString;
  __typename?: 'Vehicle_Key';
}

/** Generated Node Admin SDK operation action function for the 'ListClients' Query. Allow users to execute without passing in DataConnect. */
export function listClients(dc: DataConnect, options?: OperationOptions): Promise<ExecuteOperationResponse<ListClientsData>>;
/** Generated Node Admin SDK operation action function for the 'ListClients' Query. Allow users to pass in custom DataConnect instances. */
export function listClients(options?: OperationOptions): Promise<ExecuteOperationResponse<ListClientsData>>;

