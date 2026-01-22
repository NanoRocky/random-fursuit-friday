# 随机毛五 API

[![MIT License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

Bilibili 话题随机图片重定向 API，适配腾讯云 EdgeOne 边缘函数。

## 使用

### 参数说明

| 参数 | 说明 | 示例 |
|------|------|------|
| `type=pc` | 返回横图（宽 > 高），默认值 | `?type=pc` |
| `type=phone` | 返回竖图（宽 ≤ 高） | `?type=phone` |
| `type=mobile` | 返回竖图，同 phone | `?type=mobile` |
| `type=all` | 不限比例，任意图片 | `?type=all` |
| `type=info` | 返回 HTML 说明页面 | `?type=info` |

## 部署

### 腾讯云 EdgeOne 边缘函数

1. 在 EdgeOne 控制台创建边缘函数
2. 复制 `randfurfriday.js` 的全部代码到函数编辑器
3. 点击发布
4. 设置触发规则绑定到域名

### 配置

```javascript
const PAGE_SIZE = 54;              // 单页加载动态数
const MAX_RETRY_ITEMS = 32;        // 每页检查的最大动态数
const MAX_RANDOM_PAGE = 7;         // 最多翻页数
```


## 许可证

[MIT License](LICENSE)

---
&nbsp;<a title="CDN" target="_blank" href="https://cdnjs.com/"><img src="https://img.shields.io/badge/CDN-Tencent EdgeOne-blue"></a>&nbsp;<a title="Copyright" target="_blank" href="https://nanorocky.top/"><img src="https://img.shields.io/badge/Copyright%20%C2%A9%202023--2025-酪灰-red"></a>
