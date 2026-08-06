import { validateAdminArgs } from 'firebase-admin/data-connect';

export const connectorConfig = {
  connector: 'torqueflow-connector',
  serviceId: 'torqueflow-service',
  location: 'southamerica-east1'
};

export function listClients(dcOrOptions, options) {
  const { dc: dcInstance, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrOptions, options, undefined);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListClients', undefined, inputOpts);
}

