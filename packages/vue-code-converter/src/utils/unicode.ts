/**
 * 将字符串中所有 Unicode 编码的部分转换为对应的中文字符
 * @param {string} str - 包含 Unicode 编码的字符串
 * @returns {string} - 转换后的字符串
 */
export function unicodeToChinese(str: string) {
  // 匹配 Unicode 编码的正则表达式
  const unicodeRegex = /\\u([0-9a-fA-F]{4})/g;

  // 使用 replace 方法将所有匹配的 Unicode 编码转换为中文字符
  return str.replace(unicodeRegex, (_, code) => {
    return String.fromCharCode(parseInt(code, 16));
  });
}
