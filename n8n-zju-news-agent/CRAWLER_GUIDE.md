# 🕷️ 数据抓取配置指南 (Tampermonkey & Notion)

本项目采用 **"网页抓取 -> Notion 暂存 -> n8n 处理"** 的流程。本指南将教你如何配置 Tampermonkey（油猴）脚本，将学校内网通知一键保存到 Notion 数据库。

---

## 🛠️ 第一步：准备 Notion 数据库

n8n 工作流依赖特定的数据库结构。请务必严格按照以下表格创建你的 Notion Database。

### 1. 创建数据库

在 Notion 中新建一个 **Database (Full page)**。

### 2. 设置字段 (Properties)

请确保列名（Name）和类型（Type）与下表**完全一致**（n8n 区分大小写）：

| 字段名称 (Column Name) | 类型 (Type)      | 必填  | 说明                         |
|:------------------ |:-------------- |:--- |:-------------------------- |
| **Name**           | `Text` (Title) | ✅   | 新闻标题 (默认的第一列，不要改名)         |
| **URL**            | `URL`          | ✅   | 新闻的具体链接                    |
| **PubDate**        | `Date`         | ✅   | 新闻发布日期                     |
| **Source**         | `Select`       | 选填  | 来源标签 (例如: 教务网, 就业网)        |
| **FetchTime**      | `Created time` | ✅   | **关键字段！** 用于 n8n 识别最新抓取的数据 |

> ⚠️ **注意**：`FetchTime` 字段不仅是记录时间，更是 n8n 里的**排序依据**。请确保类型选择为 **"Created time"** (创建时间)，它会自动生成，不需要手动填。

---

## 🔑 第二步：获取 Notion API 权限

为了让脚本能把数据写入 Notion，你需要创建一个“机器人”并授权。

1. **创建集成 (Integration)**:
   
   * 访问 [Notion My Integrations](https://www.notion.so/my-integrations)。
   * 点击 **+ New integration**。
   * **Type**: 选择 "Internal" (内部)。
   * **Name**: 随便填，例如 `ZJU-News-Crawler`。
   * 点击 **Submit**，复制生成的 **Internal Integration Secret** (以 `secret_` 开头的字符串)。

2. **连接数据库 (关键步骤！)**:
   
   * 回到你刚才创建的 Notion 数据库页面。
   * 点击右上角的 **... (三个点)**。
   * 找到 **Connections** (或 Connect to)。
   * 搜索并选择你刚才创建的 `ZJU-News-Crawler`。
   * **确认**：如果这一步不做，脚本会报错 `404 Not Found`。

3. **获取 Database ID**:
   
   * 查看数据库页面的 URL。
   * 它长这样：`https://www.notion.so/myworkspace/a8aec43384f44ac998ee1907bc8d7d88?v=...`
   * 中间那串 **32位字符** (`a8aec43384f44ac998ee1907bc8d7d88`) 就是你的 **Database ID**。

---

## 🐵 第三步：安装油猴脚本

### 1. 安装扩展

如果你还没有安装，请先在浏览器安装 [Tampermonkey (篡改猴)](https://www.tampermonkey.net/) 插件。

### 2. 新建脚本

1. 点击浏览器扩展栏的油猴图标 -> **添加新脚本**。
2. **删除** 编辑器里原本所有的默认代码。
3. **复制粘贴** 下面的完整代码。

### 3. 修改配置 (填空题)

在代码最上方的 `CONFIG` 区域，填入你在第二步获取的 `NOTION_TOKEN` 和 `DATABASE_ID`。

```javascript
// ==UserScript==
// @name         🎓 ZJU News to Notion (通用版)
// @namespace    [http://tampermonkey.net/](http://tampermonkey.net/)
// @version      1.0
// @description  一键抓取内网新闻发送到 Notion 数据库
// @author       ZJUer
// @match        *://*.zju.edu.cn/*
// @match        *://webvpn.zju.edu.cn/*
// @connect      api.notion.com
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @grant        GM_notification
// ==/UserScript==

(function() {
    'use strict';
    // ================= ⚙️ 配置区域 (请修改这里) =================
    const CONFIG = {
        // 1. 填入你的 Notion Secret (以 secret_ 开头)
        NOTION_TOKEN: "secret_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", 

        // 2. 填入你的 Database ID (32位字符)
        DATABASE_ID: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",    

        // 3. 默认来源标签
        DEFAULT_SOURCE: "网页抓取" 
    };
    // ===========================================================

    // --- UI: 创建悬浮按钮 ---
    const btn = document.createElement("button");
    btn.innerHTML = "🏷️ 抓取本页新闻";
    btn.style.cssText = "position:fixed;bottom:30px;right:30px;z-index:9999;padding:12px 20px;background:#003366;color:white;border:none;border-radius:8px;cursor:pointer;box-shadow:0 4px 10px rgba(0,0,0,0.3);font-weight:bold;font-size:14px;";
    btn.onmouseover = () => btn.style.transform = "scale(1.05)";
    btn.onmouseout = () => btn.style.transform = "scale(1)";
    document.body.appendChild(btn);

    // --- 主逻辑 ---
    btn.onclick = async () => {
        const originalText = btn.innerHTML;
        btn.innerHTML = "⏳ 分析中...";
        btn.disabled = true;
        btn.style.background = "#666";

        try {
            const newsList = parseNewsList(); // 解析网页

            if (newsList.length === 0) {
                alert("⚠️ 未找到新闻列表！\n请确认当前页面是否有新闻列表，或修改脚本中的选择器。");
                resetBtn();
                return;
            }

            // 确认弹窗
            const confirmMsg = `🔍 扫描到 ${newsList.length} 条新闻：\n\n1. ${newsList[0].title}\n2. ${newsList[1] ? newsList[1].title : '...'}\n...\n\n是否全部上传到 Notion？`;
            if (!confirm(confirmMsg)) {
                resetBtn();
                return;
            }

            // 开始上传
            let success = 0;
            let fail = 0;

            for (let i = 0; i < newsList.length; i++) {
                btn.innerHTML = `🚀 上传中 (${i + 1}/${newsList.length})`;
                try {
                    await sendToNotion(newsList[i]);
                    success++;
                } catch (err) {
                    console.error("上传失败:", err);
                    fail++;
                }
            }

            alert(`✅ 处理完成！\n成功: ${success} 条\n失败: ${fail} 条\n\n请去 Notion 查看，然后运行 n8n。`);

        } catch (e) {
            console.error(e);
            alert("❌ 发生脚本错误: " + e.message);
        } finally {
            resetBtn();
        }

        function resetBtn() {
            btn.innerHTML = originalText;
            btn.disabled = false;
            btn.style.background = "#003366";
        }
    };

    // === 🛠️ 网页解析器 (核心) ===
    // 如果你在某些特定网页抓不到，可能需要修改这里的选择器
    function parseNewsList() {
        const list = [];
        const today = new Date().toISOString().split('T')[0];

        // 定义常见的列表容器选择器 (根据学校网站调整)
        const selectors = [
            "li",           // 通用列表
            "tr",           // 表格行
            ".list-item",   // 常见类名
            ".news_list li"
        ];

        // 获取所有可能的元素
        const items = document.querySelectorAll(selectors.join(","));

        items.forEach(item => {
            // 1. 找链接 (必须有)
            const linkTag = item.querySelector("a");
            if (!linkTag) return;

            // 2. 提取标题
            const title = linkTag.innerText.trim() || linkTag.title;
            if (!title || title.length < 4) return; // 过滤掉“更多”、“首页”等短词

            // 3. 提取 URL (自动补全)
            let url = linkTag.href;
            if (!url.startsWith("http")) {
                url = window.location.origin + url;
            }

            // 4. 找日期 (尝试多种格式)
            let date = today; // 默认为今天

            // 策略A: 找内部的 .time, .date, span
            const dateTag = item.querySelector(".time, .date, span, td[align='right']");
            if (dateTag) {
                const text = dateTag.innerText;
                const match = text.match(/202\d[-/.]\d{1,2}[-/.]\d{1,2}/); // 匹配 202x-xx-xx
                if (match) {
                    date = match[0].replace(/\./g, "-").replace(/\//g, "-"); // 统一格式
                }
            }

            // 策略B: 如果标题里包含日期 (例如 "关于放假的通知(2026-01-01)")
            if (date === today) {
                 const titleMatch = title.match(/202\d[-/.]\d{1,2}[-/.]\d{1,2}/);
                 if (titleMatch) date = titleMatch[0].replace(/\./g, "-").replace(/\//g, "-");
            }

            list.push({ title, url, date });
        });

        // 简单的去重 (按 URL)
        const uniqueList = [];
        const seenUrls = new Set();
        for (const item of list) {
            if (!seenUrls.has(item.url)) {
                seenUrls.add(item.url);
                uniqueList.push(item);
            }
        }

        return uniqueList;
    }

    // === 📤 Notion API 发送器 ===
    function sendToNotion(data) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: "POST",
                url: "[https://api.notion.com/v1/pages](https://api.notion.com/v1/pages)",
                headers: {
                    "Authorization": "Bearer " + CONFIG.NOTION_TOKEN,
                    "Content-Type": "application/json",
                    "Notion-Version": "2022-06-28"
                },
                data: JSON.stringify({
                    "parent": { "database_id": CONFIG.DATABASE_ID },
                    "properties": {
                        "Name": { 
                            "title": [{ "text": { "content": data.title } }] 
                        },
                        "URL": { 
                            "url": data.url 
                        },
                        "PubDate": { 
                            "date": { "start": data.date } 
                        },
                        "Source": { 
                            "select": { "name": CONFIG.DEFAULT_SOURCE } 
                        }
                    }
                }),
                onload: function(response) {
                    if (response.status === 200) {
                        resolve(response);
                    } else {
                        reject("Notion Error: " + response.responseText);
                    }
                },
                onerror: function(err) {
                    reject(err);
                }
            });
        });
    }

})();


🚀 使用方法
-------

1. 保存上面的脚本，确保已启用。

2. 打开学校新闻列表页面（如教务网、就业网）。

3. 等待页面右下角出现蓝色的 **"🏷️ 抓取本页新闻"** 按钮。

4. 点击按钮，确认弹窗信息。

5. 等待脚本提示 "✅ 处理完成"。

6. **最后一步**：回到 n8n，点击 `Execute Workflow`，几分钟后你的邮箱就会收到最新的日报了！
