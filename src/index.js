const config = {
  property: {
    bg: 'background',
    text: 'color',
    'my-bg': {
      property: ['background', 'color'],
      value: 'rgb({0})'
    }
  },
  values: {
    primary: '#ccf654'
  },
  classes: {
    display: {
      center: 'flex',
      block: 'block'
    },
    justifyContent: {
      center: 'center'
    },
    alignItems: {
      center: 'center'
    }
  }
}

class TenoxUI {
  constructor({ property = {}, values = {}, classes = {}, aliases = {}, breakpoints = [] } = {}) {
    this.property = property
    this.values = values
    this.classes = classes
    this.aliases = aliases
    this.breakpoints = breakpoints
    this.styleMap = new Map()
  }

  toCamelCase(str) {
    return str.replace(/-([a-z])/g, g => g[1].toUpperCase())
  }

  toKebabCase(str) {
    const prefixes = ['webkit', 'moz', 'ms', 'o']
    for (const prefix of prefixes) {
      if (str.toLowerCase().startsWith(prefix)) {
        return (
          `-${prefix}` +
          str.slice(prefix.length).replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)
        )
      }
    }
    // Handle regular camelCase to kebab-case
    return str.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)
  }

  escapeCSSSelector(str) {
    return str.replace(/([ #.;?%&,@+*~'"!^$[\]()=>|])/g, '\\$1')
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

  processValue(type, value, unit) {
    const properties = this.property[type]
    const valueRegistry = this.values[value]
    // let resolvedValue = valueRegistry || value

    const replaceWithValueRegistry = text => {
      return text.replace(/\{([^}]+)\}/g, (match, key) => {
        return this.values[key].toString() || match
      })
    }

    if (valueRegistry) {
      return valueRegistry
    } else if (value.startsWith('$')) {
      return `var(--${value.slice(1)})`
    } else if (value.startsWith('[') && value.endsWith(']')) {
      const cleanValue = value.slice(1, -1).replace(/_/g, ' ')

      if (cleanValue.includes('{')) {
        const replacedValue = replaceWithValueRegistry(cleanValue)

        return replacedValue
      } else {
        return cleanValue.startsWith('--') ? `var(${cleanValue})` : cleanValue
      }

      // return 'hello'
    }

    return value + unit
  }

  processShorthand(type, value, unit, prefix, secondValue, secondUnit) {
    const properties = this.property[type]
    const classes = this.classes
    const finalValue = this.processValue(type, value, unit)

    if (type.startsWith('[') && type.endsWith(']')) {
      const items = type
        .slice(1, -1)
        .split(',')
        .map(item => item.trim())

      const properties = items
        .map(item => {
          const prop = this.property[item]

          if (Array.isArray(prop)) {
            return prop.map(p => `${this.toKebabCase(String(p))}: ${finalValue}`).join('; ')
          }

          const property = prop || item

          // console.log(property)

          const finalProperty = property.startsWith('--')
            ? property // if css variable, don't do anything
            : this.toKebabCase(String(property)) // process regular properties

          return `${finalProperty}: ${finalValue}`
        })
        .join('; ')

      return [`[${type.slice(1, -1)}]-${value}`, `${properties};`, null, prefix]
    } else if (properties) {
      console.log(type, value, unit)
      if (typeof properties === 'object' && properties.value !== undefined && properties.property) {
        const property = properties.property
        const template = properties.value
        const processedValue = template
          ? template.replace(/\{0}/g, finalValue).replace(/\{1}/g, secondValue)
          : value

        return Array.isArray(property)
          ? property.map(prop => [type, prop, processedValue, prefix])
          : [type, property, processedValue, prefix]
      } else {
        console.log(type)
      }
    }
  }

  processClassNames(classNames) {
    classNames.split(/\s+/).forEach(className => {
      const parsedClassName = this.parseClassName(className)

      const [prefix, type, value, unit, secValue, secUnit] = parsedClassName

      // const finalValue = this.processValue(type, value, unit)

      const rule = this.processShorthand(type, value, unit)
      console.log(rule)
      
      return this.generateRule(type, rule, value, prefix)
    })
  }

  generateRule(className, cssRule, value, prefix) {
    const rules = value ? `${cssRule}: ${value}` : cssRule

    return `.${className}${prefix ? `:${prefix}` : ''} { ${rules} }`
  }
}

const tenoxui = new TenoxUI(config)

console.log(tenoxui.processClassNames('my-bg-[255_0_0]'))

// const stylesheet = tenoxui.processShorthand('[background,--red]', 'red', '', '')
// console.log(stylesheet)
