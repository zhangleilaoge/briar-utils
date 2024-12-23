import { getCompleteContent } from "../utils/jsx"
import {
  removeScriptComments,
  removeVueTemplateComments,
} from "../utils/string"
import { parseComponent, SFCBlock } from "vue-template-compiler"

interface IGlobalData {
  script?: SFCBlock
  template?: SFCBlock
  style: SFCBlock[]
  warnings: string[]
}
const globalData: IGlobalData = {
  script: undefined,
  template: undefined,
  style: [],
  warnings: [],
}

// get
export const getGlobalScript = () => {
  return globalData.script
}

export const getGlobalTemplate = () => {
  return globalData.template
}

export const getGlobalStyle = () => {
  return globalData.style
}

export const getFileCode = () => {
  return getCompleteContent(
    getGlobalTemplate(),
    getGlobalScript(),
    getGlobalStyle()
  )
}

// set
export const initFileCode = (code: string) => {
  let script: SFCBlock | undefined
  let template: SFCBlock | undefined
  let styles: SFCBlock[] = []

  let codes = code.split("</script>")
  codes = codes.map((item, index) => {
    if (index !== codes.length - 1) {
      return item + "</script>"
    }

    return item
  })

  codes.forEach((item) => {
    const parsed = parseComponent(item)
    const { script: _script, styles: _styles, template: _template } = parsed
    _script && (script = _script)
    _styles && (styles = [...styles, ..._styles])
    _template && (template = _template)
  })

  setGlobalScript({
    ...script,
    content: removeScriptComments(script?.content || ""),
  } as SFCBlock)
  setGlobalTemplate({
    ...template,
    content: removeVueTemplateComments(template?.content || ""),
  } as SFCBlock)
  setGlobalStyle(styles as SFCBlock[])
}

export const setGlobalScript = (data: Partial<SFCBlock>) => {
  globalData.script = { ...globalData.script, ...data } as SFCBlock
}

export const setGlobalTemplate = (data: Partial<SFCBlock>) => {
  globalData.template = { ...globalData.template, ...data } as SFCBlock
}

export const setGlobalStyle = (data: SFCBlock[]) => {
  globalData.style = [...data]
}
