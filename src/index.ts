import type { Property, Values, Classes, Aliases, Breakpoint } from '@tenoxui/types'

class TenoxUI {
  constructor({ property = {}, values = {}, classes = {}, aliases = {}, breakpoints = [] } = {}): CoreConfig {
    this.property = property
    this.values = values
    this.classes = classes
    this.aliases = aliases
    this.breakpoints = breakpoints
  }

  generateClassNameRegEx() {
    const typePrefixes = Object.keys(this.property)
      .sort((a, b) => b.length - a.length)
      .join('|')

    return new RegExp(
      `(?:([a-zA-Z0-9-]+):)?(${typePrefixes}|\\[[^\\]]+\\])-(-?(?:\\d+(?:\\.\\d+)?)|(?:[a-zA-Z0-9_]+(?:-[a-zA-Z0-9_]+)*(?:-[a-zA-Z0-9_]+)*)|(?:#[0-9a-fA-F]+)|(?:\\[[^\\]]+\\])|(?:\\$[^\\s]+))([a-zA-Z%]*)(?:\\/(-?(?:\\d+(?:\\.\\d+)?)|(?:[a-zA-Z0-9_]+(?:-[a-zA-Z0-9_]+)*(?:-[a-zA-Z0-9_]+)*)|(?:#[0-9a-fA-F]+)|(?:\\[[^\\]]+\\])|(?:\\$[^\\s]+))([a-zA-Z%]*))?`
    )
  }

  parseClassName(className) {
    const classNameRegEx = this.generateClassNameRegEx()
    const match = className.match(classNameRegEx)
    if (!match) return null

    const [, prefix, type, value, unit, secValue, secUnit] = match
    return [prefix, type, value, unit, secValue, secUnit]
  }

  processClassNames(classNames) {
    classNames.split(/\s+/).forEach(className => {
      console.log(this.parseClassName(className))
    })
  }
}

const tenoxui = new TenoxUI()

tenoxui.processClassNames('[background]-primary [color]-red')
