import { ConnectorConfig, DataConnect, QueryRef, QueryPromise, ExecuteQueryOptions } from 'firebase/data-connect';

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

interface ListClientsRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListClientsData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<ListClientsData, undefined>;
  operationName: string;
}
export const listClientsRef: ListClientsRef;

export function listClients(options?: ExecuteQueryOptions): QueryPromise<ListClientsData, undefined>;
export function listClients(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<ListClientsData, undefined>;

