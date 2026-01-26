/**
 * Bilibili 随机毛五 API
 * 适配腾讯云 EdgeOne 边缘函数
 * by NanoRocky
 */

async function handleRequest(event) {
    const { request } = event;
    const url = new URL(request.url);
    /* 获取参数，默认为 pc。【可用参数：pc、phone、mobile、all】 */
    const type = url.searchParams.get('type') || 'pc';
    /* tc=1 时使用代获取模式 */
    const tc = url.searchParams.get('tc') || '0';
    /* 允许使用代理模式的来源列表，留空则允许所有 */
    const ALLOW_REFERRERS = [];
    const TOPIC_ID = "9064";
    /* 每页请求数量（最大 54） */
    const PAGE_SIZE = 54;
    /* 最大尝试检查的动态数量，防止死循环 */
    const MAX_RETRY_ITEMS = 86;
    /* 随机翻页的最大深度（建议不要太大，否则边缘函数会超时） */
    const MAX_RANDOM_PAGE = 48;
    /* 是否启用接口缓存 */
    const USE_CACHE = true;
    /* 是否启用调试模式 */
    const DEBUG_MODE = false;

    const commonHeaders = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36 Edg/144.0.0.0",
        "Referer": "https://www.bilibili.com/",
        "Origin": "https://www.bilibili.com",
        "Accept": "application/json",
        "Accept-Encoding": "gzip, deflate, br, zstd",
        "Accept-Language": "zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7"
    };

    try {
        /* 请求说明模式：返回使用帮助 */
        if (type === 'info') {
            return new Response(Documentation(request.url), {
                status: 200,
                headers: {
                    'Content-Type': 'text/html; charset=utf-8',
                    'Cache-Control': 'public, max-age=0, s-maxage=0'
                },
            });
        };

        const reqReferer = request.headers.get('referer') || '';
        const normReferer = normalizeReferer(reqReferer);
        const allowProxy = ALLOW_REFERRERS.length === 0 || ALLOW_REFERRERS.includes(normReferer);

        if (tc === '1' && !allowProxy) {
            return new Response("当前不允许使用代获取模式", {
                status: 403,
                headers: {
                    'Content-Type': 'text/plain; charset=utf-8',
                    'Cache-Control': 'public, max-age=0, s-maxage=0'
                },
            });
        };

        let currentOffset = "";
        let foundImageUrl = null;
        let checkedCount = 0;

        /* 1. 随机决定起始页并跳过 */
        const flipPages = Math.floor(Math.random() * MAX_RANDOM_PAGE);
        if (DEBUG_MODE) console.log(`[调试] 随机翻页深度: ${flipPages}`);
        for (let p = 0; p < flipPages; p++) {
            let apiUrl = `https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/topic?topic_id=${TOPIC_ID}&sort_by=3&page_size=${PAGE_SIZE}`;
            if (currentOffset) apiUrl += `&offset=${currentOffset}`;

            // --- 使用缓存函数 ---
            const json = await fetchWithCache(event, apiUrl, commonHeaders, USE_CACHE, DEBUG_MODE);

            if (json.code !== 0 || !json.data?.topic_card_list) {
                throw new Error("BiliAPI_Error");
            };
            currentOffset = json.data.topic_card_list.offset;
            if (!json.data.topic_card_list.has_more) break;
        };

        /* 2. 从随机起始页开始查找，若未找到则继续翻页，最多 MAX_RANDOM_PAGE 页 */
        for (let p = flipPages; p < MAX_RANDOM_PAGE && !foundImageUrl; p++) {
            let apiUrl = `https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/topic?topic_id=${TOPIC_ID}&sort_by=3&page_size=${PAGE_SIZE}`;
            if (currentOffset) apiUrl += `&offset=${currentOffset}`;
            // --- 使用缓存函数 ---
            const json = await fetchWithCache(event, apiUrl, commonHeaders, USE_CACHE, DEBUG_MODE);
            if (json.code !== 0 || !json.data?.topic_card_list) {
                throw new Error("BiliAPI_Error");
            };
            const items = json.data.topic_card_list.items;
            currentOffset = json.data.topic_card_list.offset;
            /* 随机打乱当前页的 items */
            items.sort(() => Math.random() - 0.5);
            for (const item of items) {
                if (checkedCount >= MAX_RETRY_ITEMS) break;
                const opus = item.dynamic_card_item?.modules?.module_dynamic?.major?.opus;
                if (opus && opus.pics && opus.pics.length > 0) {
                    /* 将该动态的所有图片打乱顺序后逐一尝试，直到匹配或耗尽 */
                    const shuffledPics = [...opus.pics].sort(() => Math.random() - 0.5);
                    for (const pic of shuffledPics) {
                        const w = pic.width;
                        const h = pic.height;
                        const isHorizontal = w > h; /* 宽 > 高 为横屏 */
                        if ((type === 'pc' && isHorizontal) || (type === 'phone' && !isHorizontal) || (type === 'mobile' && !isHorizontal) || (type === 'all')) {
                            foundImageUrl = pic.url;
                            if (foundImageUrl.startsWith('http://')) {
                                foundImageUrl = foundImageUrl.replace('http://', 'https://');
                            };
                            break;
                        };
                    }
                };
                if (foundImageUrl) break; // 找到后退出 item 循环
                checkedCount++;
            };
            if (!json.data.topic_card_list.has_more) break;
        };
        if (foundImageUrl) {
            /* tc=1 时代理返回图片内容 */
            if (tc === '1' && allowProxy) {
                const imgResp = await fetch(foundImageUrl, {
                    headers: {
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36 Edg/144.0.0.0",
                        "Referer": "https://www.bilibili.com/",
                        "Origin": "https://www.bilibili.com",
                        "Accept-Encoding": "gzip, deflate, br, zstd",
                        "Accept-Language": "zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7"
                    },
                });
                return new Response(imgResp.body, {
                    headers: {
                        'Content-Type': imgResp.headers.get('Content-Type') || 'image/jpeg',
                        'Cache-Control': 'public, max-age=0, s-maxage=0'
                    },
                });
            };
            /* 默认 302 重定向模式 */
            return Response.redirect(foundImageUrl, 302);
        };
        return new Response("ERROR", { status: 200 });
    } catch (e) {
        if (DEBUG_MODE) console.log(`[调试] 发生错误: ${e.message}`);
        return new Response("ERROR", { status: 200 });
    };
};

/**
 * 缓存处理辅助函数
 */
async function fetchWithCache(event, apiUrl, headers, useCache, debugMode) {
    /* TODO: 好奇怪，直接访问测试速度确实有明显提升，但控制台输出日志全是未命中缓存... 为什么呢... */
    const cache = await caches.open("rdfurfri");
    const cacheKey = new Request(apiUrl);
    if (useCache) {
        const cachedResponse = await cache.match(cacheKey);
        if (cachedResponse) {
            if (debugMode) console.log(`[调试] 命中缓存: ${apiUrl}`);
            return await cachedResponse.json();
        };
    };
    if (debugMode) console.log(`[调试] 缓存未命中，回源请求: ${apiUrl}`);
    const response = await fetch(apiUrl, { headers });
    const data = await response.json();
    if (useCache && data.code === 0) {
        const responseToCache = new Response(JSON.stringify(data));
        /* 设置 s-maxage 为 28800 (8小时) */
        responseToCache.headers.append('Cache-Control', 's-maxage=28800');
        event.waitUntil(cache.put(cacheKey, responseToCache.clone()));
        if (debugMode) console.log(`[调试] 已存入新缓存，有效期 8 小时`);
    };
    return data;
};

function normalizeReferer(referer) {
    try {
        const u = new URL(referer);
        return `${u.protocol}//${u.host}/`;
    } catch (e) {
        return '';
    };
};

function Documentation(currentUrl) {
    return [
        `<!DOCTYPE html>
        <html lang="zh-CN">
        <head>
            <meta charset="utf-8" content="text/html" />
            <title>随机毛五 API</title>
        </head>
        <body>
            <div id="aplayer"></div>
            <h1>随机毛五 API</h1>
            <h2>参数说明</h2>
            &nbsp;&nbsp;&nbsp;type: 类型
            <br />
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;pc  横屏图片(默认)<br />
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;phone  竖屏图片<br />
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;all  全部<br />
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;info  显示说明<br />
            <br />
            &nbsp;&nbsp;&nbsp;tc: 代获取模式
            <br />
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;0  禁用(默认)<br />
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;1  启用<br />
            <br /><br />
            Github:&nbsp;&nbsp;<a href="https://github.com/NanoRocky/random-fursuit-friday">random-fursuit-friday</a>
            <br /><br />
            <p>Powered by NanoRocky</p>
        </body>
        </html>`
    ].join('');
};

addEventListener('fetch', event => {
    event.respondWith(handleRequest(event));
});