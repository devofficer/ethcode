# Ethereum IDE in VSCode

## System support
* Linux, Mac - latest
* Windows - unknown

## Usage instructions
`ctrl+alt+e` - activate the plugin.
![Screenshot from 2019-09-28 23-04-40](https://user-images.githubusercontent.com/13261372/65820327-15ed3a00-e245-11e9-9836-606bb1a71de6.png)

`ctrl+alt+c` - compile contracts.
![Screenshot from 2019-09-28 23-05-13](https://user-images.githubusercontent.com/13261372/65820336-33ba9f00-e245-11e9-9918-3d210c52297e.png)

**Note:** *compilation with latest/default version is faster. compilation with any other selected version can be slower as it loads the compiler version from web.*

## Help
Please help ethcode developers continue their work.

Ethereum donation address: 0xd22fE4aEFed0A984B1165dc24095728EE7005a36

## Development
Run following commands in the terminal

```shell
yarn install
yarn run build
```
And then press F5, in Extension Development Host session, run `Ethereum: Solidity compile` command from command palette.

## Packaging
```shell
vsce package --yarn
```

## Publishing
```
vsce login mathcody
vsce publish 0.0.1 -p <access token> --yarn
```
Find extension at - https://marketplace.visualstudio.com/items?itemName=mathcody.ethcode

## Under the hood

Things we did on top of Create React App TypeScript template

* We inline `index.html` content in `ext-src/extension.ts` when creating the webview
* We set strict security policy for accessing resources in the webview.
  * Only resources in `/build` can be accessed
  * Only resources whose scheme is `vscode-resource` can be accessed.
* For all resources we are going to use in the webview, we change their schemes to `vscode-resource`
* Since we only allow local resources, absolute path for styles/images (e.g., `/static/media/logo.svg`) will not work. We add a `.env` file which sets `PUBLIC_URL` to `./` and after bundling, resource urls will be relative.
* We add baseUrl `<base href="${vscode.Uri.file(path.join(this._extensionPath, 'build')).with({ scheme: 'vscode-resource' })}/">` and then all relative paths work.

## References
* https://github.com/Microsoft/vscode-go/wiki/Building,-Debugging-and-Sideloading-the-extension-in-Visual-Studio-Code
* https://code.visualstudio.com/api/working-with-extensions/bundling-extension
* https://stackoverflow.com/questions/50885128/how-can-i-debug-a-child-process-fork-process-from-visual-studio-code
* https://code.visualstudio.com/docs/nodejs/nodejs-debugging#_automatically-attach-debugger-to-nodejs-subprocesses