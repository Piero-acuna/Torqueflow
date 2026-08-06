import { ListClientsData } from '../';
import { UseDataConnectQueryResult, useDataConnectQueryOptions} from '@tanstack-query-firebase/react/data-connect';
import { UseQueryResult} from '@tanstack/react-query';
import { DataConnect } from 'firebase/data-connect';
import { FirebaseError } from 'firebase/app';


export function useListClients(options?: useDataConnectQueryOptions<ListClientsData>): UseDataConnectQueryResult<ListClientsData, undefined>;
export function useListClients(dc: DataConnect, options?: useDataConnectQueryOptions<ListClientsData>): UseDataConnectQueryResult<ListClientsData, undefined>;
