const { validateAdminArgs } = require('firebase-admin/data-connect');

const connectorConfig = {
  connector: 'torqueflow-connector',
  serviceId: 'torqueflow-service',
  location: 'southamerica-east1'
};
exports.connectorConfig = connectorConfig;

function listClients(dcOrOptions, options) {
  const { dc: dcInstance, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrOptions, options, undefined);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListClients', undefined, inputOpts);
}
exports.listClients = listClients;

