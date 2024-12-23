## 更新日志

### 0.0.10 (2024/08/13)

- [feat] 去掉多余的 toRef 声明
- [fix] 修复 style 数据在转换时不刷新的问题
- [fix] 兼容多 style 场景

### 0.0.8 (2024/07/22)

- [feat] 如果响应式变量没有被任何地方所消费，则直接删掉
- [fix] 仅在存在 template 模版场景才去做 setup 返回判断(老版本在无 template 场景，setup 函数不会返回任何值)
- [fix] watch 的首位参数现使用监听函数写法，避免出现在 composition-api 中直接监听非影响式数据
- [fix] 修复 @Model 解析 propName 错误的问题
- [feat] 将永不修改的 ref 变量降级，降级为普通变量，或者删除变量将代码中的使用指向修改为 ref 变量的初始赋值

### 0.0.10 beta (2024/07/22)

- [feat] 如果模版不消费，则 setup 不 return 相关 data

### 0.0.9 beta (2024/07/11)

- [feat] safeConverter 可处理普通变量和响应式变量同名的场景

### 0.0.8 beta（2024/07/10）

- [feat] 初版，支持 option -> composition 和 decorator -> composition 这两种代码转换能力
