// ==UserScript==
// @name         浙大 WebVPN 交流项目抓取器
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  自动抓取 WebVPN 页面下的交流项目通知发送给 n8n
// @author       ZJUer
// @match        https://webvpn.zju.edu.cn/https/*
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(function() {
    'use strict';

    // 🔴 请替换为你自己的 n8n Production Webhook 地址 (和之前的一样)
    // 注意：不要带 -test 后缀
    const WEBHOOK_URL = "http://localhost:5678/webhook/zju-edu-news";

    // 按钮样式
    const btnStyle = "position:fixed;top:100px;right:20px;z-index:9999;padding:10px 20px;background:#003366;color:white;border:none;border-radius:5px;cursor:pointer;font-weight:bold;box-shadow:0 2px 5px rgba(0,0,0,0.3);";

    // 创建抓取按钮
    const btn = document.createElement("button");
    btn.innerHTML = "📡 推送交流新闻到 n8n";
    btn.style = btnStyle;
    document.body.appendChild(btn);

    btn.onclick = function() {
        btn.innerHTML = "⏳ 正在抓取...";
        btn.style.background = "#666";

        // === 1. 定义抓取逻辑 (针对 WebVPN 结构) ===
        // 查找新闻列表的容器 (通常是 ul.cg-news-list 或类似的)
        // 这里的选择器是根据你之前的 Exchange Code 节点推测的
        let items = [];

        // 尝试查找所有的 li 标签，寻找包含日期的
        const listItems = document.querySelectorAll("li");

        listItems.forEach(li => {
            const linkTag = li.querySelector("a");
            const dateTag = li.querySelector("span"); // 通常日期在 span 里

            if (linkTag && dateTag) {
                let title = linkTag.getAttribute("title") || linkTag.innerText.trim();
                let link = linkTag.getAttribute("href");
                let date = dateTag.innerText.trim();

                // 简单的有效性判断
                if (title.length > 5 && date.match(/\d{4}-\d{2}-\d{2}/)) {

                    // 补全 WebVPN 的链接前缀
                    if (link && !link.startsWith("http")) {
                        // 如果是相对路径，直接基于当前 WebVPN 域名拼接
                        link = window.location.origin + link;
                    }

                    // 给标题加个标签，方便你在日报里区分
                    title = "【交流项目】" + title;

                    items.push({
                        title: title,
                        link: link, // 这里发过去的是 WebVPN 的链接，校外也能点！
                        date: date
                    });
                }
            }
        });

        if (items.length === 0) {
            alert("❌ 未找到新闻列表，请确认你是否在列表页？");
            btn.innerHTML = "❌ 抓取失败";
            return;
        }

        console.log("抓取到的数据:", items);

        // === 2. 发送到 n8n ===
        GM_xmlhttpRequest({
            method: "POST",
            url: WEBHOOK_URL,
            headers: { "Content-Type": "application/json" },
            data: JSON.stringify({ items: items }), // 打包发送
            onload: function(response) {
                if (response.status === 200) {
                    btn.innerHTML = "✅ 推送成功 (" + items.length + "条)";
                    btn.style.background = "#28a745";
                    setTimeout(() => { btn.style.display = "none"; }, 3000);
                } else {
                    btn.innerHTML = "❌ 失败: " + response.status;
                    alert("发送失败，请检查 n8n 是否开启了 Active");
                }
            },
            onerror: function(err) {
                btn.innerHTML = "❌ 网络错误";
                alert("无法连接 n8n，请检查 Webhook 地址是否正确");
            }
        });
    };
})();