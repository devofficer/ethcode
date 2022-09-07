import * as vscode from 'vscode';
import { window } from 'vscode';
import { logger } from '../lib';
import { IGasStrategyQP } from '../types';
import { createAlchemyWeb3 } from "@alch/alchemy-web3";
import { getSeletedRpcUrl } from './networks';
import { getGasStrategyNames, HISTORICAL_BLOCKS } from './config';


const formatFeeHistory = (result: any, includePending: boolean)
  : Array<{
    baseFeePerGas: number,
    gasUsedRatio: number,
    priorityFeePerGas: Array<number>
  }> => {
  const blocks = result.reward.map((x: Array<string>, idx: number) => ({
    baseFeePerGas: Number(result.baseFeePerGas[idx]),
    gasUsedRatio: Number(result.gasUsedRatio[idx]),
    priorityFeePerGas: x.map((v: string) => Number(v)),
  }));

  if (includePending) {
    blocks.push({
      number: "pending",
      baseFeePerGas: Number(result.baseFeePerGas[HISTORICAL_BLOCKS]),
      gasUsedRatio: NaN,
      priorityFeePerGas: [],
    });
  }
  return blocks;
}

const avg = (arr: Array<number>) => {
  const sum = arr.reduce((a: number, v: number) => a + v);
  return Math.round(sum / arr.length);
}

const updateEstimatedGasFee = async (context: vscode.ExtensionContext) => {
  const web3 = createAlchemyWeb3(getSeletedRpcUrl(context));

  const feeHistory = await web3.eth.getFeeHistory(HISTORICAL_BLOCKS, "pending", [1, 50, 99]);
  const blocks = formatFeeHistory(feeHistory, false);

  const low = avg(blocks.map(b => b.priorityFeePerGas[0]));
  const medium = avg(blocks.map(b => b.priorityFeePerGas[1]));
  const high = avg(blocks.map(b => b.priorityFeePerGas[2]));

  const pendingBlock = await web3.eth.getBlock("pending");
  const baseFeePerGas = Number(pendingBlock.baseFeePerGas);

  const estimatedGasFee = {
    low: low + baseFeePerGas,
    medium: medium + baseFeePerGas,
    high: high + baseFeePerGas,
  };

  context.workspaceState.update('estimatedGasFee', estimatedGasFee);

  return estimatedGasFee;
}

const updateGasStrategy = async (context: vscode.ExtensionContext) => {
  const quickPick = window.createQuickPick<IGasStrategyQP>();

  const gas = await updateEstimatedGasFee(context);
  logger.success(gas.high.toString());

  quickPick.items = getGasStrategyNames().map((name) => ({
    label: name,
  }));
  quickPick.onDidChangeActive(() => {
    quickPick.placeholder = 'Select gas strategy';
  });
  quickPick.onDidChangeSelection((selection: readonly IGasStrategyQP[]) => {
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

export {
  updateGasStrategy,
  updateEstimatedGasFee
}