const { queryRef, executeQuery, validateArgsWithOptions, validateArgs } = require('firebase/data-connect');

const connectorConfig = {
  connector: 'torqueflow-connector',
  service: 'torqueflow-service',
  location: 'southamerica-east1'
};
exports.connectorConfig = connectorConfig;

const listClientsRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListClients');
}
listClientsRef.operationName = 'ListClients';
exports.listClientsRef = listClientsRef;

exports.listClients = function listClients(dcOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrOptions, options, undefined,false, false);
  return executeQuery(listClientsRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;
