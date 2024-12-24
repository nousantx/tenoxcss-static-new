import TenoxUICLI from './cli.js'
import config from './tenoxui.config.js'

const cli = new TenoxUICLI(config)
cli.generate({
  input: ['index.html', 'src/**/*.{jsx,tsx}'],
  output: 'dist/styles.css',
  watch: true,
  // minify: true,
  // sourceMap: true
})