import { nodeResolve } from '@rollup/plugin-node-resolve';

export default {
  input: 'js/main.js',
  output: {
    dir: 'dist',
    format: 'es',
    sourcemap: true
  },
  plugins: [nodeResolve()]
};