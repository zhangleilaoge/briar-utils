import { Options } from "prettier"

export enum useEnum {
  Inject = "inject",
  Provide = "provide",
  Ref = "ref",
  ToRefs = "toRefs",
  Computed = "computed",
  Watch = "watch",
  OnBeforeMount = "onBeforeMount",
  OnMounted = "onMounted",
  OnBeforeUpdate = "onBeforeUpdate",
  OnUpdated = "onUpdated",
  OnBeforeUnmount = "onBeforeUnmount",
  OnUnmounted = "onUnmounted",
  OnErrorCaptured = "onErrorCaptured",
  OnRenderTracked = "onRenderTracked",
  OnRenderTriggered = "onRenderTriggered",
  OnActivated = "onActivated",
  OnDeactivated = "onDeactivated",
}

export enum Vue2LifecycleEnum {
  BeforeCreate = "beforeCreate",
  Created = "created",
  BeforeMount = "beforeMount",
  Mounted = "mounted",
  BeforeUpdate = "beforeUpdate",
  Updated = "updated",
  BeforeUnmount = "beforeUnmount",
  BeforeDestroy = "beforeDestroy",
  Destroyed = "destroyed",
  ErrorCaptured = "errorCaptured",
  RenderTracked = "renderTracked",
  RenderTriggered = "renderTriggered",
  Activated = "activated",
  Deactivated = "deactivated",
}

export enum IncompatibleSyntax {
  Mixins = "mixins",
  Extends = "extends",
  VuexModuleDecorators = "vuex-module-decorators",
  VuexClass = "vuex-class",
  SameName = "same-name",
}

export enum InputType {
  OptionStyle = "OptionStyle",
  DecorateStyle = "DecorateStyle",
  CompositionApi = "CompositionApi",
}

export interface IVuexParams {
  mapState: string
  mapActions: string
  mapGetters: string
  mapMutations: string
  moduleName?: string
}

export interface IConvertResult {
  // output: string;
  inputType: InputType
  warning?: string
}

export interface IConvertOptions {
  /** 设置为 true 时，开启非法语法告警 */
  strict?: boolean
  /** 设置输出结果的 prettier 格式化参数 */
  prettier?: Partial<Options>
}

export interface IMethodObj {
  async: "async" | ""
  type: string
  body: string
  parameters: string
}
