import libheif from 'libheif-js/wasm-bundle.js';

import lib from './lib.ts';

const { one, all } = lib(libheif);

const decode: typeof one & { all: typeof all } = one as any;
decode.all = all;

export default decode;
