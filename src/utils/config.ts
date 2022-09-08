import * as vscode from 'vscode';

export const HISTORICAL_BLOCKS = 20;

export const getConfiguration = () => {
  return vscode.workspace.getConfiguration('ethcode');
};

export const getNetworkNames = (): Array<string> => {
  const networks = getConfiguration().get('networks') as object;
  return Object.keys(networks);
};

export const getGasStrategyNames = (): Array<string> => {
  const networks = getConfiguration().get('gas.strategies') as object;
  return Object.keys(networks);
};

// Selected Network Configuratin Helper
export const getSelectedNetwork = (context: vscode.ExtensionContext): string => {
  return context.workspaceState.get('selectedNetwork') as string;
};

export const getSeletedRpcUrl = (context: vscode.ExtensionContext) => {
  const networks = getConfiguration().get('networks') as { [key: string]: string };
  return networks[getSelectedNetwork(context)];
};

export const getSelectedAlchemy = (context: vscode.ExtensionContext) => {
  const networks = getConfiguration().get('networks') as { [key: string]: string };
  return networks[getSelectedNetwork(context)];
};
