import { ethers } from 'ethers';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { window, InputBoxOptions } from 'vscode';
import { logger } from '../lib';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const keythereum = require('keythereum');

import { toChecksumAddress } from '../lib/hash/util';
import { Account, LocalAddressType } from '../types';
import { getSelectedNetwork, getSelectedProvider, isTestingNetwork } from './networks';

// list all local addresses
const listAddresses = async (context: vscode.ExtensionContext, keyStorePath: string): Promise<string[]> => {
  try {
    let localAddresses: LocalAddressType[];

    if (isTestingNetwork(context)) {
      const provider = getSelectedProvider(context) as ethers.providers.JsonRpcProvider;
      const account = await provider.listAccounts();
      return account;
    }

    if (!fs.existsSync(`${keyStorePath}/keystore`)) {
      fs.mkdirSync(`${keyStorePath}/keystore`);
    }

    const files = fs.readdirSync(`${keyStorePath}/keystore`);

    localAddresses = files.map((file) => {
      const arr = file.split('--');
      return {
        pubAddress: `0x${arr[arr.length - 1]}`,
        checksumAddress: toChecksumAddress(`0x${arr[arr.length - 1]}`),
      };
    });

    return localAddresses.map(e => e.pubAddress);
  } catch (err) {
    logger.error(err);
    return [];
  }
}

// create keypair
const createKeyPair = (context: vscode.ExtensionContext, path: string, pswd: string) => {
  const params = { keyBytes: 32, ivBytes: 16 };
  const bareKey = keythereum.create(params);
  const options = {
    kdf: 'scrypt',
    cipher: 'aes-128-ctr',
  };
  const keyObject = keythereum.dump(Buffer.from(pswd, 'utf-8'), bareKey.privateKey, bareKey.salt, bareKey.iv, options);
  const account: Account = { pubAddr: keyObject.address, checksumAddr: toChecksumAddress(keyObject.address) };
  logger.success('Account created!');
  logger.log(JSON.stringify(account));

  if (!fs.existsSync(`${path}/keystore`)) {
    fs.mkdirSync(`${path}/keystore`);
  }
  keythereum.exportToFile(keyObject, `${path}/keystore`);
  listAddresses(context, path);
}

// delete privateKey against address
const deleteKeyPair = async (context: vscode.ExtensionContext) => {
  try {
    const pubkeyInp: InputBoxOptions = {
      ignoreFocusOut: true,
      placeHolder: 'Public key',
    };
    const publicKey = await window.showInputBox(pubkeyInp);
    if (publicKey == undefined)
      throw new Error('Please input public address');

    fs.readdir(`${context.extensionPath}/keystore`, (err, files) => {
      if (err) throw new Error(`Unable to scan directory: ${err}`);

      files.forEach((file) => {
        if (file.includes(publicKey.replace('0x', ''))) {
          fs.unlinkSync(`${context.extensionPath}/keystore/${file}`);
          listAddresses(context, context.extensionPath);
          logger.log('Account deleted!');
        }
      });
    });
  } catch (error) {
    logger.error(error);
  }
}

// extract privateKey against address
const extractPvtKey = async (keyStorePath: string, address: string) => {
  try {
    const pwdInpOpt: vscode.InputBoxOptions = {
      ignoreFocusOut: true,
      password: true,
      placeHolder: 'Password',
    };
    const password = await window.showInputBox(pwdInpOpt);

    const keyObject = keythereum.importFromFile(address, keyStorePath);
    return keythereum.recover(Buffer.from(password || '', 'utf-8'), keyObject);
  } catch (e) {
    throw new Error("Password is wrong or such address doesn't exist in wallet lists");
  }
}

const selectAccount = async (context: vscode.ExtensionContext) => {

  const addresses = await listAddresses(context, context.extensionPath);

  const quickPick = window.createQuickPick();

  quickPick.items = addresses.map((account) => ({
    label: account,
    description: isTestingNetwork(context) ? getSelectedNetwork(context) : 'Local account',
  }));

  quickPick.onDidChangeActive(() => {
    quickPick.placeholder = 'Select account';
  });

  quickPick.onDidChangeSelection((selection) => {
    if (selection[0]) {
      const { label } = selection[0];
      context.workspaceState.update('account', label);
      logger.success(`Account ${label} is selected.`);
      quickPick.dispose();
    }
  });

  quickPick.onDidHide(() => quickPick.dispose());
  quickPick.show();
}

export {
  listAddresses,
  createKeyPair,
  deleteKeyPair,
  extractPvtKey,
  selectAccount
}
