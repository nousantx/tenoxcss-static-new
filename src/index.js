export class TenoxUI {
  constructor({
    property = {},
    values = {},
    classes = {},
    aliases = {},
    breakpoints = [],
    reserveClass = []
  } = {}) {
    this.property = property
    this.values = values
    this.classes = classes
    this.aliases = aliases
    this.breakpoints = breakpoints
    this.reserveClass = reserveClass
    this.styleMap = new Map()
    if (this.reserveClass.length > 0) {
      this.processReservedClasses()
    }
  }

  processReservedClasses() {
    this.reserveClass.forEach(className => {
      this.processClassNames(className)
    })
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

  getParentClass(className) {
    return Object.keys(this.classes).filter(cssProperty =>
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
        .map(item => item.trim())

      const cssRules = items
        .map(item => {
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
        .map(prop => (value ? `${this.toKebabCase(prop)}: ${value}` : this.toKebabCase(prop)))
        .join('; ')
      this.styleMap.get(key).add(combinedRule)
    } else {
      this.styleMap.get(key).add(value ? `${cssRules}: ${value}` : cssRules)
    }
  }

  processAlias(className) {
    const alias = this.aliases[className]
    if (!alias) return null

    const aliasClasses = alias.split(' ')
    let combinedRules = []

    aliasClasses.forEach(aliasClass => {
      const parsed = this.parseClassName(aliasClass)
      if (!parsed) return

      const [prefix, type, value, unit, secValue, secUnit] = parsed
      const result = this.processShorthand(type, value, unit, prefix, secValue, secUnit)

      if (result) {
        if (Array.isArray(result.cssRules)) {
          result.cssRules.forEach(rule => {
            combinedRules.push(`${this.toKebabCase(rule)}: ${result.value}`)
          })
        } else {
          combinedRules.push(`${result.cssRules}: ${result.value}`)
        }
      }
    })

    console.log(className, combinedRules)
    return {
      className,
      cssRules: combinedRules.join('; '),
      value: null,
      prefix: undefined
    }
  }

  generateMediaQuery(breakpoint, className, rules) {
    const { name } = breakpoint
    const mediaKey = `@media-${name}`
    const ruleSet = `.${name}\\:${className} { ${rules} }`

    return {
      mediaKey,
      ruleSet
    }
  }

  processClassNames(classNames) {
    classNames.split(/\s+/).forEach(className => {
      if (!className) return

      const aliasResult = this.processAlias(className)
      if (aliasResult) {
        const { className: aliasClassName, cssRules } = aliasResult
        this.addStyle(aliasClassName, cssRules, null, undefined)
        return
      }

      const [rprefix, rtype] = className.split(':')
      const getType = rtype || rprefix
      const getPrefix = rtype ? rprefix : undefined

      const breakpoint = this.breakpoints.find(bp => bp.name === getPrefix)

      const shouldClasses = this.processCustomClass(getPrefix, getType)

      if (shouldClasses) {
        const { className, cssRules, prefix } = shouldClasses

        if (breakpoint) {
          const { mediaKey, ruleSet } = this.generateMediaQuery(breakpoint, className, cssRules)
          this.addStyle(mediaKey, ruleSet, null, null)
        } else {
          this.addStyle(className, cssRules, null, prefix)
        }
        return
      }

      const parsed = this.parseClassName(className)
      if (!parsed) return

      const [prefix, type, value, unit, secValue, secUnit] = parsed
      const result = this.processShorthand(type, value, unit, prefix, secValue, secUnit)

      if (result) {
        const { className, cssRules, value: ruleValue, prefix: rulePrefix } = result

        if (breakpoint) {
          const rules = Array.isArray(cssRules)
            ? cssRules.map(rule => `${this.toKebabCase(rule)}: ${ruleValue}`).join('; ')
            : `${cssRules}: ${ruleValue}`

          const { mediaKey, ruleSet } = this.generateMediaQuery(breakpoint, className, rules)
          this.addStyle(mediaKey, ruleSet, null, null)
        } else {
          this.addStyle(className, cssRules, ruleValue, rulePrefix)
        }
      }
    })
  }

  generateStylesheet() {
    this.processReservedClasses()
    let stylesheet = ''
    const mediaQueries = new Map()

    this.styleMap.forEach((rules, className) => {
      if (className.startsWith('@media-')) {
        const breakpointName = className.split('-')[1]
        const breakpoint = this.breakpoints.find(bp => bp.name === breakpointName)

        if (breakpoint) {
          let mediaQuery = ''
          if (breakpoint.min !== undefined && breakpoint.max !== undefined) {
            mediaQuery = `(min-width: ${breakpoint.min}px) and (max-width: ${breakpoint.max}px)`
          } else if (breakpoint.min !== undefined) {
            mediaQuery = `(min-width: ${breakpoint.min}px)`
          } else if (breakpoint.max !== undefined) {
            mediaQuery = `(max-width: ${breakpoint.max}px)`
          }

          if (!mediaQueries.has(mediaQuery)) {
            mediaQueries.set(mediaQuery, new Set())
          }
          rules.forEach(rule => {
            mediaQueries.get(mediaQuery).add(rule)
          })
        }
      } else {
        const styles = Array.from(rules).join('; ')
        stylesheet += `.${className} {\n  ${styles};\n}\n`
      }
    })

    mediaQueries.forEach((rules, query) => {
      stylesheet += `@media ${query} {\n`
      rules.forEach(rule => {
        stylesheet += `  ${rule}\n`
      })
      stylesheet += '}\n'
    })

    return stylesheet
  }
}
