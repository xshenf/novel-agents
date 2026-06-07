/**
 * 通用通知函数：当前封装 alert，后续可替换为 toast 组件。
 * 提供统一的调用入口，方便日后迁移。
 */
export function showNotification(message: string, type: 'info' | 'error' | 'warning' = 'info') {
  console.log(`[${type}] ${message}`);
  alert(message);
}
