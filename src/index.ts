import libheif from 'libheif-js/wasm-bundle.js';

import lib from './lib.ts';

const { one, all } = lib(libheif);

type DecodeWithAll = typeof one & { all: typeof all };

const decode: DecodeWithAll = one as DecodeWithAll;
decode.all = all;

export default decode;
