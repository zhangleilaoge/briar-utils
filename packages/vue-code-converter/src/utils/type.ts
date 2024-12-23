export const tsTypeToVuePropType = (type?: string) => {
  /* vue type
    String
    Number
    Boolean
    Array
    Object
    Date
    Function
    Symbol
    */

  if (type == null) {
    return { expression: `null` };
  }

  if (/^(string|number|boolean)$/.test(type)) {
    return { expression: type.charAt(0).toUpperCase() + type.slice(1) };
  }

  if (/.+\[\]$/.test(type)) {
    return {
      use: 'PropType',
      expression: `Array as Proptype<${type}>`,
    };
  }
  return {
    use: 'PropType',
    expression: `Object as PropType<${type}>`,
  };
};
