// O app não faz parte dos workspaces da raiz (o Next usa outra versão do React),
// então o @thaix/core chega como link "file:". O Metro precisa observar a pasta
// do pacote para empacotar o TypeScript dele e recarregar quando ele mudar.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);
const corePath = path.resolve(__dirname, '../../packages/core');

config.watchFolders = [...(config.watchFolders ?? []), corePath];

module.exports = config;
