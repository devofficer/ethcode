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