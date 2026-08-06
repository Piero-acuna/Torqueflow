const { validateAdminArgs } = require('firebase-admin/data-connect');

const connectorConfig = {
  connector: 'example',
  serviceId: 'torqueflow-connector',
  location: 'southamerica-east1'
};
exports.connectorConfig = connectorConfig;

function getUsersDropdown(dcOrOptions, options) {
  const { dc: dcInstance, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrOptions, options, undefined);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetUsersDropdown', undefined, inputOpts);
}
exports.getUsersDropdown = getUsersDropdown;

