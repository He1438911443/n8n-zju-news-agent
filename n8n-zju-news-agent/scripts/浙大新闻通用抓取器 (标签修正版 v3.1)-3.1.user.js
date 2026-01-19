// ==UserScript==
// @name         浙大新闻通用抓取器 (标签修正版 v3.1)
// @namespace    http://tampermonkey.net/
// @version      3.1
// @description  修复在WebVPN下教务通知被误判为交流项目的问题
// @author       ZJUer
// @match        *://*.zju.edu.cn/*
// @match        https://webvpn.zju.edu.cn/*
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(function() {
    'use strict';

    // 🔴 你的 n8n Webhook 地址
    const WEBHOOK_URL = "http://localhost:5678/webhook/zju-edu-news";

    const btnStyle = "position:fixed;top:150px;right:20px;z-index:9999;padding:10px 20px;background:#003366;color:white;border:none;border-radius:5px;cursor:pointer;font-weight:bold;box-shadow:0 2px 5px rgba(0,0,0,0.3);";

    const btn = document.createElement("button");
    btn.innerHTML = "🏷️ 抓取 (已修正标签)";
    btn.style = btnStyle;
    document.body.appendChild(btn);

    btn.onclick = function() {
        btn.innerHTML = "⏳ 正在分析...";
        btn.style.background = "#666";

        let items = [];
        const candidates = document.querySelectorAll("li, tr, div");

        candidates.forEach(row => {
            const linkTag = row.querySelector("a");
            if (!linkTag) return;

            const fullText = row.innerText.trim();
            const title = linkTag.getAttribute("title") || linkTag.innerText.trim();

            // 1. 垃圾过滤
            if (/^(首页|更多|More|第一页|上一页|下一页|尾页|跳转|Go|行政文件|日历活动|最新通知|重点提示|公示公告)$/i.test(title)) return;
            if (title.length < 5) return;

            // 2. 日期必须存在
            const dateMatch = fullText.match(/(\d{4}[-/.年]\d{1,2}[-/.月]\d{1,2})/);
            if (!dateMatch) return;

            let date = dateMatch[0].replace(/[.年月]/g, "-").replace(/日/g, "");

            // 3. 链接处理
            let link = linkTag.getAttribute("href");
            if (link && !link.startsWith("http") && !link.startsWith("javascript")) {
                link = window.location.origin + (link.startsWith("/") ? "" : "/") + link;
            }
            if (!link || link.startsWith("javascript")) return;

            // === 🔥 核心修改：标签判断逻辑修正 ===
            let prefix = "";
            const currentUrl = window.location.href;

            // 优先匹配“教务/教学”的特征词 (zhfw, bksy, jyjx)
            // 即使在 webvpn 下，只要包含这些词，就认为是教务通知
            if (currentUrl.includes("zhfw") || currentUrl.includes("bksy") || currentUrl.includes("jyjx")) {
                prefix = "【教务/教学】";
            }
            // 然后再匹配“交流”的特征词 (ugrs, dwjl)
            else if (currentUrl.includes("ugrs") || currentUrl.includes("dwjl")) {
                prefix = "【交流/留学】";
            }
            // 最后如果啥都没匹配到，但是是 webvpn，才给个通用标签
            else if (currentUrl.includes("webvpn")) {
                prefix = "【校内通知】";
            }

            // 存入列表
            const isDuplicate = items.some(i => i.link === link);
            if (!isDuplicate) {
                items.push({
                    title: prefix + title, // 现在的标题会是【教务/教学】xxx
                    link: link,
                    date: date
                });
            }
        });

        if (items.length === 0) {
            alert("⚠️ 未找到有效新闻，请检查页面是否正确");
            btn.innerHTML = "❌ 0 条";
            return;
        }

        console.log("抓取数据:", items);

        GM_xmlhttpRequest({
            method: "POST",
            url: WEBHOOK_URL,
            headers: { "Content-Type": "application/json" },
            data: JSON.stringify({ items: items }),
            onload: function(response) {
                if (response.status === 200) {
                    btn.innerHTML = "✅ 推送成功 " + items.length + " 条";
                    btn.style.background = "#28a745";
                    setTimeout(() => { btn.style.display = "none"; }, 3000);
                } else {
                    alert("发送失败");
                }
            }
        });
    };
})();