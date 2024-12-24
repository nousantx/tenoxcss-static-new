const defaultConfig = {
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
    '--my-ctr': {
      center: '1s'
    },
    webkitAnimation: {
      center: 'var(--my-ctr)'
    },
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
    return str.replace(/-([a-z])/g, (g) => g[1].toUpperCase())
  }

  toKebabCase(str) {
    const prefixes = ['webkit', 'moz', 'ms', 'o']
    for (const prefix of prefixes) {
      if (str.toLowerCase().startsWith(prefix)) {
        return (
          `-${prefix}` +
          str.slice(prefix.length).replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
        )
      }
    }

    return str.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
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

    const replaceWithValueRegistry = (text) => {
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

  getParentClass(className) {
    return Object.keys(this.classes).filter((cssProperty) =>
      Object.prototype.hasOwnProperty.call(this.classes[cssProperty], className)
    )
  }

  processShorthand(type, value, unit = '', prefix, secondValue, secondUnit) {
    const properties = this.property[type]
    const finalValue = this.processValue(type, value, unit)

    if (type.startsWith('[') && type.endsWith(']')) {
      const items = type
        .slice(1, -1)
        .split(',')
        .map((item) => item.trim())

      const cssRules = items
        .map((item) => {
          const prop = this.property[item] || item
          const finalProperty = prop.startsWith('--') ? prop : this.toKebabCase(String(prop))
          return `${finalProperty}: ${finalValue}`
        })
        .join('; ')

      return {
        className: `${this.escapeCSSSelector(`[${type.slice(1, -1)}]-${value}${unit}`)}`,
        cssRules,
        value: null,
        prefix
      }
    }

    if (properties) {
      if (typeof properties === 'object' && properties.value !== undefined && properties.property) {
        const property = properties.property
        const template = properties.value
        const processedValue = template
          ? template.replace(/\{0}/g, finalValue).replace(/\{1}/g, secondValue || '')
          : finalValue

        if (Array.isArray(property)) {
          return {
            className: `${type}-${value}${unit}`,
            cssRules: property,
            value: processedValue,
            prefix
          }
        }

        return {
          className: `${type}-${value}${unit}`,
          cssRules: this.toKebabCase(properties),
          value: processedValue,
          prefix
        }
      }

      return {
        className: `${type}-${value}${unit}`,
        cssRules: this.toKebabCase(String(properties)),
        value: finalValue,
        prefix
      }
    }

    return null
  }
  processCustomClass(prefix, className) {
    // Get all properties that have this className defined
    const properties = Object.entries(this.classes)
      .filter(([, classObj]) => classObj.hasOwnProperty(className))
      .reduce((acc, [propKey, classObj]) => {
        acc[this.toKebabCase(propKey)] = classObj[className]
        return acc
      }, {})

    if (Object.keys(properties).length > 0) {
      const rules = Object.entries(properties)
        .map(([prop, value]) => `${prop}: ${value}`)
        .join('; ')

      return {
        className: this.escapeCSSSelector(className),
        cssRules: rules,
        value: null,
        prefix
      }
    }

    return null
  }
  addStyle(className, cssRules, value, prefix) {
    const key = prefix ? `${prefix}\\:${className}:${prefix}` : className
    if (!this.styleMap.has(key)) {
      this.styleMap.set(key, new Set())
    }

    if (Array.isArray(cssRules)) {
      const combinedRule = cssRules
        .map((prop) => (value ? `${this.toKebabCase(prop)}: ${value}` : this.toKebabCase(prop)))
        .join('; ')
      this.styleMap.get(key).add(combinedRule)
    } else {
      this.styleMap.get(key).add(value ? `${cssRules}: ${value}` : cssRules)
    }
  }

  processClassNames(classNames) {
    classNames.split(/\s+/).forEach((className) => {
      if (!className) return

      const [rprefix, rtype] = className.split(':')
      const getType = rtype || rprefix
      const getPrefix = rtype ? rprefix : undefined

      const shouldClasses = this.processCustomClass(getPrefix, getType)

      if (shouldClasses) {
        const { className, cssRules, prefix } = shouldClasses

        this.addStyle(className, cssRules, null, prefix)
        return
      }

      const parsed = this.parseClassName(className)
      if (!parsed) return

      const [prefix, type, value, unit, secValue, secUnit] = parsed
      const result = this.processShorthand(type, value, unit, prefix, secValue, secUnit)

      if (result) {
        const { className, cssRules, value, prefix: rulePrefix } = result

        this.addStyle(className, cssRules, value, rulePrefix)
      }
    })
  }
  generateStylesheet() {
    let stylesheet = ''

    this.styleMap.forEach((rules, className) => {
      const styles = Array.from(rules).join('; ')

      stylesheet += `.${className} {\n  ${styles};\n}\n`
    })

    return stylesheet
  }
}

const tenoxui2 = new TenoxUI(defaultConfig)

// tenoxui.processClassNames('hover:bg-primary text-[#fff] hover:my-bg-[255_0_0]')
// console.log(tenoxui.generateStylesheet())

tenoxui2.processClassNames(
  'hover:bg-primary [color]-[{primary}] hover:my-bg-[255_0_0] bg-red center'
)

console.log('real stylesheet', tenoxui2.generateStylesheet())
