import { ethers } from 'ethers';
import * as vscode from 'vscode';
import { window } from 'vscode';
import { CompiledJSONOutput, getAbi, getByteCode } from '../types/output';
import { logger } from '../lib';
import { extractPvtKey } from './wallet';
import { INetworkQP } from '../types';
import { getConstructorInputs, getDeployedInputs, getFunctionInputs } from './functions';
import { errors } from '../config/errors';

const provider = ethers.providers;

const getConfiguration = () => {
  return vscode.workspace.getConfiguration('ethcode');
};

const getNetworkNames = (): Array<string> => {
  const networks = getConfiguration().get('networks') as object;
  return Object.keys(networks);
};

// Selected Network Configuratin Helper
const getSelectedNetwork = (context: vscode.ExtensionContext): string => {
  return context.workspaceState.get('selectedNetwork') as string;
};

const getSeletedRpcUrl = (context: vscode.ExtensionContext) => {
  const networks = getConfiguration().get('networks') as any;
  return networks[getSelectedNetwork(context)];
};

const updateSelectedNetwork = async (context: vscode.ExtensionContext) => {
  const quickPick = window.createQuickPick<INetworkQP>();

  quickPick.items = getNetworkNames().map((name) => ({
    label: name,
  }));
  quickPick.onDidChangeActive(() => {
    quickPick.placeholder = 'Select network';
  });
  quickPick.onDidChangeSelection((selection: Array<INetworkQP>) => {
    if (selection[0]) {
      const { label } = selection[0];
      context.workspaceState.update('selectedNetwork', label);
      quickPick.dispose();

      logger.success(`Selected network is ${label}`);
    }
  });
  quickPick.onDidHide(() => quickPick.dispose());
  quickPick.show();
};

const isValidHttpUrl = (url_: string): boolean => {
  let url;

  try {
    url = new URL(url_);
  } catch (_) {
    return false;
  }

  return url.protocol === 'http:' || url.protocol === 'https:';
};

const getSelectedProvider = (context: vscode.ExtensionContext) => {
  const rpc = getSeletedRpcUrl(context); // default providers have a name with less than 10 chars
  if (isValidHttpUrl(rpc)) return new provider.JsonRpcProvider(rpc);

  return provider.getDefaultProvider(rpc);
};

// Contract function calls
const displayBalance = async (context: vscode.ExtensionContext) => {
  const address: any = await context.workspaceState.get('account');

  try {
    getSelectedProvider(context)
      .getBalance(address)
      .then(async (value) => {
        const balance = ethers.utils.formatEther(value);
        context.workspaceState.update('balance', balance);

        const networkName: any = getSelectedNetwork(context);
        logger.success(`${address} has account Balance on ${networkName} network is: ${balance} Eth`);
      });
  } catch (_) {
    logger.error(new Error("Selected network RPC isn't supported."));
  }
};

const isTestingNetwork = (context: vscode.ExtensionContext) => {
  if (getSelectedNetwork(context) === 'Ganache Testnet')
    return true;

  if (getSelectedNetwork(context) === 'Hardhat Testnet')
    return true;

  return false;
}

const callContractMethod = async (context: vscode.ExtensionContext) => {
  try {
    const compiledOutput = (await context.workspaceState.get('contract')) as CompiledJSONOutput;
    if (compiledOutput == undefined)
      throw errors.ContractNotSelected;

    const abi = getAbi(compiledOutput);
    if (abi == undefined)
      throw new Error("Abi is not defined.");

    const abiItem = await getFunctionInputs(context);
    if (abiItem === undefined)
      throw new Error("Function is not defined.");

    const params_ = abiItem.inputs?.map((e: any) => e.value);
    const params = params_ === undefined ? [] : params_;

    logger.success(`Calling ${compiledOutput.name} : ${abiItem.name} -->`);

    const contractAddres = getDeployedInputs(context).address;
    if (contractAddres === undefined)
      throw new Error("Enter deployed address of selected contract.");

    if (abiItem.stateMutability === 'view') {
      const contract = new ethers.Contract(
        contractAddres,
        abi,
        getSelectedProvider(context),
      );

      const result = await contract[abiItem.name as string](...params);
      logger.success(`Calling ${compiledOutput.name} : ${abiItem.name} --> Success!`);
      logger.log(JSON.stringify(result));
    } else {
      const contract = await getSignedContract(context, contractAddres);
      const result = await contract[abiItem.name as string](...params);
      logger.success("Waiting for confirmation...");

      await result.wait();
      logger.success("Transaction confirmed!");
      logger.success(`Calling ${compiledOutput.name} : ${abiItem.name} --> Success!`);
    }
  } catch (err: any) {
    logger.error(err);
  }
}

/**
 * @dev deploy the contract using the compiled json output and signer wallet
 */
const deployContract = async (context: vscode.ExtensionContext) => {
  try {
    logger.success("Deploying contract...");

    const myContract = await getContractFactoryWithParams(context);
    const parameters = getConstructorInputs(context);
    const contract = await myContract.deploy(...parameters);

    context.workspaceState.update('contractAddress', contract.address);
    logger.success(`Contract deployed to ${contract.address}`);

  } catch (err) {
    logger.error(err);
  }
}

const getSignedContract = async (context: vscode.ExtensionContext, contractAddres: string): Promise<ethers.Contract> => {
  const compiledOutput = (await context.workspaceState.get('contract')) as CompiledJSONOutput;
  if (compiledOutput == undefined)
    throw errors.ContractNotSelected;

  const abi = getAbi(compiledOutput);
  if (abi == undefined)
    throw new Error("Abi is not defined.");

  const byteCode = getByteCode(compiledOutput);
  if (byteCode == undefined)
    throw new Error("ByteCode is not defined.");

  let contract;
  if (isTestingNetwork(context)) {
    // Deploy to ganache network
    const provider = getSelectedProvider(context) as ethers.providers.JsonRpcProvider;
    const signer = provider.getSigner()
    contract = new ethers.Contract(contractAddres, abi, signer);
  } else {
    const account = context.workspaceState.get('account') as string;
    const privateKey = await extractPvtKey(context.extensionPath, account);
    const wallet = new ethers.Wallet(privateKey);
    const provider = getSelectedProvider(context);
    const signingAccount = wallet.connect(provider);
    contract = new ethers.Contract(
      contractAddres,
      abi,
      signingAccount,
    );
  }
  return contract;
}

const getContractFactoryWithParams = async (context: vscode.ExtensionContext): Promise<ethers.ContractFactory> => {
  const compiledOutput = (await context.workspaceState.get('contract')) as CompiledJSONOutput;
  if (compiledOutput == undefined)
    throw errors.ContractNotSelected;

  const abi = getAbi(compiledOutput);
  if (abi == undefined)
    throw new Error("Abi is not defined.");

  const byteCode = getByteCode(compiledOutput);
  if (byteCode == undefined)
    throw new Error("ByteCode is not defined.");

  let myContract;
  if (isTestingNetwork(context)) {
    // Deploy to ganache network
    const provider = getSelectedProvider(context) as ethers.providers.JsonRpcProvider;
    const signer = provider.getSigner()
    myContract = new ethers.ContractFactory(abi, byteCode, signer);
  } else {
    // Deploy to ethereum network
    const account = context.workspaceState.get('account') as string;
    const privateKey = await extractPvtKey(context.extensionPath, account);
    const provider = getSelectedProvider(context);
    const wallet = new ethers.Wallet(privateKey);
    const signingAccount = wallet.connect(provider);
    myContract = new ethers.ContractFactory(abi, byteCode, signingAccount);
  }
  return myContract;
}

export {
  getNetworkNames,
  getSelectedNetwork,
  getSelectedProvider,
  updateSelectedNetwork,
  displayBalance,
  callContractMethod,
  deployContract,
  isTestingNetwork
};
