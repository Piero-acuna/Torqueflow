import { queryRef, executeQuery, validateArgsWithOptions, validateArgs } from 'firebase/data-connect';

export const connectorConfig = {
  connector: 'torqueflow-connector',
  service: 'torqueflow-service',
  location: 'southamerica-east1'
};
export const listClientsRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListClients');
}
listClientsRef.operationName = 'ListClients';

export function listClients(dcOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrOptions, options, undefined,false, false);
  return executeQuery(listClientsRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}

