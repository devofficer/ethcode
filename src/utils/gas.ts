import * as vscode from 'vscode';
import { window } from 'vscode';
import { logger } from '../lib';
import { IGasStrategyQP } from '../types';
import Web3 from 'web3'
import { getSelectedProvider } from './networks';
import { JsonRpcProvider } from '@ethersproject/providers';

const getGasStrategies = (): Array<string> => {
  const networks = vscode.workspace.getConfiguration('ethcode').get('gas.strategies') as object;
  return Object.keys(networks);
};

const updateGasStrategy = async (context: vscode.ExtensionContext) => {
  const quickPick = window.createQuickPick<IGasStrategyQP>();
  
  const gas = await estimateGas(context);
  logger.success(gas.fast.toString());

  quickPick.items = getGasStrategies().map((name) => ({
    label: name,
  }));
  quickPick.onDidChangeActive(() => {
    quickPick.placeholder = 'Select gas strategy';
  });
  quickPick.onDidChangeSelection((selection: Array<IGasStrategyQP>) => {
    if (selection[0]) {
      const { label } = selection[0];
      context.workspaceState.update('selectedGasStrategy', label);
      quickPick.dispose();

      logger.success(`Selected gas strategy is ${label}`);
    }
  });
  quickPick.onDidHide(() => quickPick.dispose());
  quickPick.show();
};

const historicalBlocks = 20;

const formatFeeHistory = (result: any, includePending: boolean) => {
  let blockNum = result.oldestBlock;
  let index = 0;
  const blocks = [];
  while (blockNum < result.oldestBlock + historicalBlocks) {
    blocks.push({
      number: blockNum,
      baseFeePerGas: Number(result.baseFeePerGas[index]),
      gasUsedRatio: Number(result.gasUsedRatio[index]),
      priorityFeePerGas: result.reward[index].map((x: string) => Number(x)),
    });
    blockNum += 1;
    index += 1;
  }
  if (includePending) {
    blocks.push({
      number: "pending",
      baseFeePerGas: Number(result.baseFeePerGas[historicalBlocks]),
      gasUsedRatio: NaN,
      priorityFeePerGas: [],
    });
  }
  return blocks;
}

function avg(arr: any) {
  const sum = arr.reduce((a: number, v: number) => a + v);
  return Math.round(sum / arr.length);
}

const estimateGas = async (context: vscode.ExtensionContext) => {
  const provider = getSelectedProvider(context);;

  const feeHistory = await (provider as JsonRpcProvider).feeHistory(historicalBlocks, "pending", [1, 50, 99]);
  const blocks = formatFeeHistory(feeHistory, false);

  const slow = avg(blocks.map(b => b.priorityFeePerGas[0]));
  const average = avg(blocks.map(b => b.priorityFeePerGas[1]));
  const fast = avg(blocks.map(b => b.priorityFeePerGas[2]));

  const pendingBlock = await provider.getBlock(await provider.getBlockNumber());
  const baseFeePerGas = Number(pendingBlock.baseFeePerGas);
  return {
    slow: slow + baseFeePerGas,
    average: average + baseFeePerGas,
    fast: fast + baseFeePerGas,
  };
}

export {
  updateGasStrategy,
  estimateGas
}