# webSpider

## 项目简介

本项目是一个使用 Node.js + Cheerio 实现的网站数据爬虫，支持将爬取到的数据存入 MongoDB（通过 mongoose 进行连接和操作）。主要用于批量抓取指定网站的列表、详情数据，并支持图片下载及失败重试。

## 功能特性

- 爬取目标网站的列表页面，抓取行政区划等基础信息
- 爬取详情页面，抓取更详细的内容
- 支持断点重试：自动读取失败日志，针对失败部分重新爬取
- 支持批量下载页面内图片到本地
- 爬取、解析、存储流程自动化，并有详细日志

## 依赖环境

- Node.js
- MongoDB（本地或远程均可）
- 主要依赖包：
  - axios
  - cheerio
  - mongoose
  - fs（内置模块）
  - readline（内置模块）
  - path（内置模块）

## 快速开始

1. **安装依赖**

   ```bash
   npm install axios cheerio mongoose
   ```

2. **配置数据库**

   默认连接本地 MongoDB 实例：
   ```
   mongodb://127.0.0.1:27017/scraping
   ```
   可根据实际环境调整连接参数。

3. **运行爬虫**

   - **爬取列表页数据：**
     在 `serve.js` 中找到相关入口，指定页码范围，执行爬取。
     ```js
     // 例如，解开如下注释启动列表爬取
     // (async function startScraping() {
     //   const startPage = 1;
     //   const endPage = 10; // 根据需要调整页数
     //   for (let i = startPage; i <= endPage; i++) {
     //     await scrapePage(i);
     //   }
     // })();
     ```

   - **爬取详情页：**
     ```js
     // getDetail();
     ```

   - **重试失败任务：**
     ```js
     // retryFailedScrapes('./failed_scrape_details.txt', scrapeDetailsById);
     ```

   - **下载图片：**
     ```js
     // scrapeImages('https://www.****.com.cn/h-col-115.html');
     ```

   > **注意**：请根据目标网站实际的 URL 填写 `BASE_URL` 和 `DETAIL_URL`，并合理设置爬取区间和参数。

4. **数据结构**

   - 列表数据存储于 `Region` 表，字段包括标准名称、所属市县、简称、别名等
   - 详情数据存储于 `RegionDetail` 表，字段包括罗马拼写、使用时间、全称、来历、概况、备注等

## 日志与重试机制

- 爬取失败会自动写入日志文件（如 `failed_scrapes.txt`、`failed_scrape_details.txt`）
- 可通过 `retryFailedScrapes` 函数重试失败的 ID

## 主要文件说明

- `serve.js`：核心爬虫逻辑，包含数据模型定义、爬虫主流程、图片下载等
- 其他依赖文件可根据实际需求补充

## 注意事项

- 请确保目标网站版权允许爬取，勿用于非法用途
- 大规模爬取时建议控制频率，避免对目标服务器造成压力
- 数据库写入时注意唯一索引和数据一致性

## License

暂无 License，需补充。

---

> 项目地址: [https://github.com/535601882/webSpider](https://github.com/535601882/webSpider)
